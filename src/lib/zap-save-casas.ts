import { mapZapItemToCasa, type ZapListingItem } from '@/lib/apify-zap';
import { fetchPaginasAnuncioViaApify } from '@/lib/listings/fetch-paginas-anuncio-apify';
import {
  inferirStatusAnuncioPorHtml,
  verificarStatusLinkAnuncioDireto,
} from '@/lib/listings/verificar-status-link-anuncio';
import { normalizeAccessRole } from '@/lib/authz';
import { parseDecimalInput, parseIntegerInput } from '@/lib/condominios';
import { isSupabaseMissingColumnError } from '@/lib/kanban/kanban-card-select-cols';
import { casaMapaPertenceCondominio } from '@/lib/kanban/mapa-competidores-condominio';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

export const LISTINGS_CASAS_SELECT_MAPA =
  'id, cidade, foto_url, status, condominio, localizacao_condominio, quartos, banheiros, vagas, piscina, marcenaria, preco, area_casa_m2, preco_m2, estado, compatibilidade_moni, data_publicacao, data_despublicado, link, manual';

export const LISTINGS_CASAS_SELECT_MAPA_FULL = `${LISTINGS_CASAS_SELECT_MAPA}, importado`;

/** Carrega listagens do processo; tolera ausência da coluna `importado` (migration 373). */
export async function fetchListingsCasasPorProcesso(
  supabase: SupabaseServer,
  processoId: string,
): Promise<{ data: Record<string, unknown>[]; error: string | null }> {
  const withImportado = await supabase
    .from('listings_casas')
    .select(LISTINGS_CASAS_SELECT_MAPA_FULL)
    .eq('processo_id', processoId)
    .order('created_at', { ascending: false });
  if (!withImportado.error) {
    return { data: (withImportado.data ?? []) as Record<string, unknown>[], error: null };
  }
  if (!isSupabaseMissingColumnError(withImportado.error.message)) {
    return { data: [], error: withImportado.error.message };
  }
  const base = await supabase
    .from('listings_casas')
    .select(LISTINGS_CASAS_SELECT_MAPA)
    .eq('processo_id', processoId)
    .order('created_at', { ascending: false });
  if (base.error) return { data: [], error: base.error.message };
  return { data: (base.data ?? []) as Record<string, unknown>[], error: null };
}

async function persistListingCasa(
  supabase: SupabaseServer,
  mode: 'insert' | 'update',
  payload: Record<string, unknown>,
  id?: string,
): Promise<{ ok: true; id?: string } | { ok: false; error: string }> {
  const run = async (row: Record<string, unknown>) => {
    if (mode === 'update' && id) {
      return supabase.from('listings_casas').update(row).eq('id', id);
    }
    return supabase.from('listings_casas').insert(row).select('id').maybeSingle();
  };

  let res = await run(payload);
  if (!res.error) {
    const insertedId =
      mode === 'insert' && res.data && typeof res.data === 'object' && 'id' in res.data
        ? String((res.data as { id?: string }).id ?? '')
        : undefined;
    return { ok: true, id: insertedId || id };
  }
  if (!isSupabaseMissingColumnError(res.error.message) || payload.importado === undefined) {
    return { ok: false, error: res.error.message };
  }
  const { importado: _omit, ...semImportado } = payload;
  res = await run(semImportado);
  if (res.error) return { ok: false, error: res.error.message };
  const insertedId =
    mode === 'insert' && res.data && typeof res.data === 'object' && 'id' in res.data
      ? String((res.data as { id?: string }).id ?? '')
      : undefined;
  return { ok: true, id: insertedId || id };
}

/** Cliente com bypass de RLS para escrita em `listings_casas` após autorização explícita. */
function supabaseWriteClientForProcesso():
  | { ok: true; supabase: SupabaseServer }
  | { ok: false; error: string } {
  try {
    const admin = createAdminClient();
    return { ok: true, supabase: admin as unknown as SupabaseServer };
  } catch {
    return { ok: false, error: 'Serviço indisponível.' };
  }
}

async function processoStepOneExists(
  supabase: SupabaseServer,
  pid: string,
): Promise<boolean> {
  const { data: processo } = await supabase
    .from('processo_step_one')
    .select('id')
    .eq('id', pid)
    .maybeSingle();
  return Boolean(processo);
}

export async function verifyProcessoCasasAccess(
  processoId: string,
): Promise<
  | { ok: true; supabase: SupabaseServer }
  | { ok: false; error: string; supabase?: undefined }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const pid = String(processoId ?? '').trim();
  if (!pid) return { ok: false, error: 'Processo inválido.' };

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const accessRole = normalizeAccessRole((profile as { role?: string } | null)?.role);

  if (accessRole === 'admin' || accessRole === 'team') {
    try {
      const admin = createAdminClient();
      if (!(await processoStepOneExists(admin as unknown as SupabaseServer, pid))) {
        return { ok: false, error: 'Processo não encontrado.' };
      }
      return { ok: true, supabase: admin as unknown as SupabaseServer };
    } catch {
      return { ok: false, error: 'Serviço indisponível.' };
    }
  }

  const { data: processo } = await supabase
    .from('processo_step_one')
    .select('id')
    .eq('id', pid)
    .eq('user_id', user.id)
    .maybeSingle();

  let authorized = Boolean(processo);

  if (!authorized) {
    const { data: card } = await supabase
      .from('kanban_cards')
      .select('id')
      .or(`processo_step_one_id.eq.${pid},projeto_id.eq.${pid}`)
      .eq('franqueado_id', user.id)
      .limit(1)
      .maybeSingle();
    authorized = Boolean(card);
  }

  if (!authorized) return { ok: false, error: 'Processo não encontrado.' };

  const writeClient = supabaseWriteClientForProcesso();
  if (!writeClient.ok) return writeClient;

  if (!(await processoStepOneExists(writeClient.supabase, pid))) {
    return { ok: false, error: 'Processo não encontrado.' };
  }

  // RLS de listings_casas exige processo_step_one.user_id = auth.uid(); cards do Funil
  // podem ter processo vinculado com outro user_id — admin após checagem de permissão.
  return { ok: true, supabase: writeClient.supabase };
}

/**
 * Aplica atualização ZAP na listagem de casas (upsert por link + despublicar ausentes).
 * Não altera registros manuais nem importados de planilha.
 */
function listingProtegidoContraZap(row: {
  manual?: boolean | null;
  importado?: boolean | null;
}): boolean {
  return row.manual === true || row.importado === true;
}

export async function applyZapCasasUpdate(
  supabase: SupabaseServer,
  processoId: string,
  items: ZapListingItem[],
  cidade: string,
  estado: string,
  opts?: { condominioVinculo?: string },
): Promise<{ inserted: number; updated: number; despublicados: number }> {
  const itemsList = items ?? [];
  const cidadeNorm = cidade.trim();
  const estadoNorm = estado.trim().slice(0, 2).toUpperCase();
  const vinculo = opts?.condominioVinculo?.trim() || null;
  const mapped = itemsList
    .filter(
      (i) =>
        i?.url || i?.listingUrl || i?.link || i?.pageUrl || i?.canonicalUrl,
    )
    .map((i) => mapZapItemToCasa(i as ZapListingItem, cidadeNorm, estadoNorm));
  const validos = mapped.filter((r) => r.link);
  const rows = validos.map((r) => (vinculo ? { ...r, condominio: vinculo } : r));

  const linksFromZap = new Set(rows.map((r) => normalizeListingLink(r.link as string)));

  const existingFull = await supabase
    .from('listings_casas')
    .select('id, link, manual, importado, condominio')
    .eq('processo_id', processoId);
  let existing: Array<{
    id: string;
    link: string | null;
    manual?: boolean | null;
    importado?: boolean | null;
    condominio?: string | null;
  }> | null = (existingFull.data ?? null) as typeof existing;
  if (existingFull.error && isSupabaseMissingColumnError(existingFull.error.message)) {
    const fallback = await supabase
      .from('listings_casas')
      .select('id, link, manual, condominio')
      .eq('processo_id', processoId);
    existing = (fallback.data ?? null) as typeof existing;
  } else if (existingFull.error) {
    existing = [];
  }

  let despublicados = 0;
  const now = new Date().toISOString().slice(0, 10);
  for (const row of existing ?? []) {
    if (listingProtegidoContraZap(row)) continue;
    const link = row.link as string | null;
    if (!link || linksFromZap.has(normalizeListingLink(link))) continue;
    // Mapa por condomínio: só despublica listagens da sessão atual, não de outras abas.
    if (vinculo && !casaMapaPertenceCondominio({ condominio: row.condominio ?? null }, vinculo)) {
      continue;
    }
    const { error: upErr } = await supabase
      .from('listings_casas')
      .update({ status: 'despublicado', data_despublicado: now })
      .eq('id', row.id);
    if (!upErr) despublicados++;
  }

  const existingByLink = new Map<string, { id: string }>();
  const linksProtegidos = new Set<string>();
  for (const row of existing ?? []) {
    if (!row.link) continue;
    const linkNorm = normalizeListingLink(row.link);
    if (listingProtegidoContraZap(row)) {
      linksProtegidos.add(linkNorm);
      existingByLink.set(linkNorm, { id: row.id });
      continue;
    }
    existingByLink.set(linkNorm, { id: row.id });
  }

  let inserted = 0;
  let updated = 0;
  for (const r of rows) {
    const linkRaw = r.link as string | null;
    if (!linkRaw) continue;
    const linkNorm = normalizeListingLink(linkRaw);
    if (linksProtegidos.has(linkNorm)) continue;

    const payload = {
      processo_id: processoId,
      manual: false,
      cidade: r.cidade,
      estado: r.estado,
      status: 'a_venda' as const,
      condominio: r.condominio,
      localizacao_condominio: r.localizacao_condominio,
      quartos: r.quartos,
      banheiros: r.banheiros,
      vagas: r.vagas,
      piscina: r.piscina,
      marcenaria: r.marcenaria,
      preco: r.preco,
      area_casa_m2: r.area_casa_m2,
      preco_m2: r.preco_m2,
      link: linkRaw,
      foto_url: r.foto_url,
      data_publicacao: r.data_publicacao,
    };
    const existingRow = existingByLink.get(linkNorm) ?? null;
    if (existingRow) {
      const { error: upErr } = await supabase
        .from('listings_casas')
        .update({ ...payload, data_despublicado: null })
        .eq('id', existingRow.id);
      if (!upErr) updated++;
    } else {
      const { error: insErr } = await supabase.from('listings_casas').insert(payload);
      if (!insErr) inserted++;
    }
  }

  return { inserted, updated, despublicados };
}

export type PlanilhaCasaMappedRow = {
  cidade: string | null;
  quartos: number | null;
  banheiros: number | null;
  vagas: number | null;
  preco: number;
  area_casa_m2: number | null;
  preco_m2: number | null;
  piscina: boolean;
  marcenaria: boolean;
  link: string | null;
  localizacao_condominio: string | null;
  foto_url: string | null;
};

export type PlanilhaCasasImportResult = {
  inserted: number;
  updated: number;
  erros: string[];
};

type PlanilhaCasaField = keyof PlanilhaCasaMappedRow;

/** Normaliza cabeçalho de coluna: minúsculas, sem acento, separadores unificados. */
export function normalizePlanilhaHeaderKey(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/²/g, '2')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Normaliza URL de anúncio para upsert (http(s), host minúsculo, sem query/hash). */
export function normalizeListingLink(link: string): string {
  const trimmed = link.trim();
  if (!trimmed) return '';
  try {
    const u = new URL(trimmed);
    u.hash = '';
    u.search = '';
    const path = u.pathname.replace(/\/+$/, '') || '/';
    return `${u.protocol}//${u.host.toLowerCase()}${path}`;
  } catch {
    return trimmed.toLowerCase().replace(/\/+$/, '');
  }
}

const PLANILHA_COLUMN_ALIASES: Record<string, PlanilhaCasaField> = {
  cidade: 'cidade',
  city: 'cidade',
  quartos: 'quartos',
  bedrooms: 'quartos',
  banheiros: 'banheiros',
  bathrooms: 'banheiros',
  vagas: 'vagas',
  parking: 'vagas',
  preco: 'preco',
  price: 'preco',
  valor: 'preco',
  area: 'area_casa_m2',
  m2: 'area_casa_m2',
  m_2: 'area_casa_m2',
  area_m2: 'area_casa_m2',
  area_m_2: 'area_casa_m2',
  area_casa_m2: 'area_casa_m2',
  area_util: 'area_casa_m2',
  area_total: 'area_casa_m2',
  area_construida: 'area_casa_m2',
  metragem: 'area_casa_m2',
  metragem_privativa: 'area_casa_m2',
  metragem_total: 'area_casa_m2',
  tamanho: 'area_casa_m2',
  tamanho_m2: 'area_casa_m2',
  metros_quadrados: 'area_casa_m2',
  m2_area: 'area_casa_m2',
  preco_m2: 'preco_m2',
  preco_m_2: 'preco_m2',
  r_m2: 'preco_m2',
  r_m_2: 'preco_m2',
  rs_m2: 'preco_m2',
  preco_m: 'preco_m2',
  piscina: 'piscina',
  pool: 'piscina',
  marcenaria: 'marcenaria',
  moveis_planejados: 'marcenaria',
  moveis_planejado: 'marcenaria',
  movel_planejado: 'marcenaria',
  link: 'link',
  url: 'link',
  endereco: 'localizacao_condominio',
  localizacao: 'localizacao_condominio',
  localizacao_condominio: 'localizacao_condominio',
  foto: 'foto_url',
  foto_url: 'foto_url',
  imagem: 'foto_url',
};

function resolvePlanilhaColumnField(header: string): PlanilhaCasaField | null {
  const key = normalizePlanilhaHeaderKey(header);
  return PLANILHA_COLUMN_ALIASES[key] ?? null;
}

function cellToString(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'number' && Number.isFinite(val)) return String(val);
  return String(val).trim();
}

function parsePlanilhaBoolean(val: unknown): boolean | null {
  if (val == null || val === '') return null;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  const s = String(val).trim().toLowerCase();
  if (['sim', 's', 'true', '1', 'yes'].includes(s)) return true;
  if (['nao', 'n', 'false', '0', 'no'].includes(s)) return false;
  return null;
}

function parsePlanilhaNumber(val: unknown): number | null {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  let s = cellToString(val);
  if (!s) return null;
  s = s
    .replace(/\s*m\s*[²2]?\b/gi, '')
    .replace(/\bm²\b/gi, '')
    .replace(/\bmetros?\s*quadrados?\b/gi, '')
    .trim();
  const fromDecimal = parseDecimalInput(s);
  if (fromDecimal != null) return fromDecimal;
  const compact = s.replace(/[^\d,.-]/g, '');
  if (!compact) return null;
  return parseDecimalInput(compact);
}

function parsePlanilhaInteger(val: unknown): number | null {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && Number.isFinite(val)) return Math.trunc(val);
  return parseIntegerInput(cellToString(val));
}

/** Converte registro bruto (cabeçalho → valor) para campos de `listings_casas`. */
export function mapPlanilhaRecordToCasaRow(
  raw: Record<string, unknown>,
): Partial<PlanilhaCasaMappedRow> | null {
  const out: Partial<PlanilhaCasaMappedRow> = {};

  for (const [header, val] of Object.entries(raw)) {
    const field = resolvePlanilhaColumnField(header);
    if (!field) continue;

    switch (field) {
      case 'cidade': {
        const s = cellToString(val);
        if (s) out.cidade = s;
        break;
      }
      case 'quartos':
      case 'banheiros':
      case 'vagas':
        out[field] = parsePlanilhaInteger(val);
        break;
      case 'preco': {
        const n = parsePlanilhaNumber(val);
        if (n != null) out.preco = n;
        break;
      }
      case 'area_casa_m2':
      case 'preco_m2': {
        const n = parsePlanilhaNumber(val);
        out[field] = n;
        break;
      }
      case 'piscina':
      case 'marcenaria': {
        const b = parsePlanilhaBoolean(val);
        if (b != null) out[field] = b;
        break;
      }
      case 'link':
      case 'localizacao_condominio':
      case 'foto_url': {
        const s = cellToString(val);
        if (s) out[field] = s;
        break;
      }
      default:
        break;
    }
  }

  if (out.preco == null || !Number.isFinite(out.preco) || out.preco <= 0) return null;

  if (
    (out.preco_m2 == null || !Number.isFinite(out.preco_m2)) &&
    out.area_casa_m2 != null &&
    out.area_casa_m2 > 0
  ) {
    out.preco_m2 = out.preco / out.area_casa_m2;
  }

  return out;
}

function buildPlanilhaImportPayload(
  mapped: Partial<PlanilhaCasaMappedRow>,
  ctx: {
    processoId: string;
    vinculo: string;
    cidadePadrao: string | null;
    estadoPadrao: string | null;
    suportaColunaImportado: boolean;
    mode: 'insert' | 'update';
  },
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    processo_id: ctx.processoId,
    manual: true,
    status: 'a_venda' as const,
    condominio: ctx.vinculo,
    preco: mapped.preco,
    link: mapped.link?.trim() || null,
    data_despublicado: null,
  };

  const setNullable = (
    key: string,
    value: string | number | boolean | null | undefined,
    defaultInsert: string | number | boolean | null,
  ) => {
    if (value !== undefined && value !== null) {
      payload[key] = value;
    } else if (ctx.mode === 'insert') {
      payload[key] = defaultInsert;
    }
  };

  setNullable('cidade', mapped.cidade ?? ctx.cidadePadrao, ctx.cidadePadrao);
  setNullable('estado', ctx.estadoPadrao, ctx.estadoPadrao);
  setNullable('quartos', mapped.quartos, null);
  setNullable('banheiros', mapped.banheiros, null);
  setNullable('vagas', mapped.vagas, null);
  setNullable('piscina', mapped.piscina, false);
  setNullable('marcenaria', mapped.marcenaria, false);
  setNullable('area_casa_m2', mapped.area_casa_m2, null);
  setNullable('preco_m2', mapped.preco_m2, null);
  setNullable('localizacao_condominio', mapped.localizacao_condominio, null);
  setNullable('foto_url', mapped.foto_url, null);

  if (ctx.suportaColunaImportado) payload.importado = true;

  if (
    (payload.preco_m2 == null || payload.preco_m2 === '') &&
    payload.preco != null &&
    payload.area_casa_m2 != null &&
    Number(payload.area_casa_m2) > 0
  ) {
    payload.preco_m2 = Number(payload.preco) / Number(payload.area_casa_m2);
  }

  return payload;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      cells.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

function parseCsvToRecords(text: string): Record<string, unknown>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const records: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    if (cells.every((c) => !c.trim())) continue;
    const rec: Record<string, unknown> = {};
    headers.forEach((h, j) => {
      rec[h] = cells[j] ?? '';
    });
    records.push(rec);
  }

  return records;
}

function parseXlsxToRecords(buffer: ArrayBuffer): Record<string, unknown>[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
}

/** Lê .xlsx ou .csv e devolve linhas como objetos (cabeçalho da 1ª linha). */
export function parsePlanilhaCasasFile(
  buffer: ArrayBuffer,
  filename: string,
): Record<string, unknown>[] {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.csv')) {
    const text = new TextDecoder('utf-8').decode(buffer);
    return parseCsvToRecords(text);
  }
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    return parseXlsxToRecords(buffer);
  }
  throw new Error('Formato não suportado. Use .xlsx ou .csv.');
}

/**
 * Importa linhas de planilha em `listings_casas`.
 * Upsert por `link` quando informado; senão insere novo registro.
 */
export async function applyPlanilhaCasasImport(
  supabase: SupabaseServer,
  processoId: string,
  records: Record<string, unknown>[],
  condominioVinculo: string,
  opts?: { cidadePadrao?: string | null; estadoPadrao?: string | null },
): Promise<PlanilhaCasasImportResult> {
  const vinculo = condominioVinculo.trim();
  if (!vinculo) {
    return { inserted: 0, updated: 0, erros: ['condominioVinculo é obrigatório.'] };
  }

  const cidadePadrao = String(opts?.cidadePadrao ?? '').trim() || null;
  const estadoPadrao = String(opts?.estadoPadrao ?? '').trim().toUpperCase().slice(0, 2) || null;

  const { data: existing, error: errExisting } = await supabase
    .from('listings_casas')
    .select('id, link')
    .eq('processo_id', processoId);

  if (errExisting) {
    return { inserted: 0, updated: 0, erros: [errExisting.message] };
  }

  const existingByLink = new Map<string, { id: string }>();
  for (const row of existing ?? []) {
    const link = row.link as string | null;
    if (link) existingByLink.set(normalizeListingLink(link), { id: row.id as string });
  }

  let inserted = 0;
  let updated = 0;
  const erros: string[] = [];

  const probeImportado = await supabase.from('listings_casas').select('importado').limit(0);
  const suportaColunaImportado = !(
    probeImportado.error && isSupabaseMissingColumnError(probeImportado.error.message)
  );

  for (let index = 0; index < records.length; index++) {
    const raw = records[index];
    const linha = index + 2;
    const mapped = mapPlanilhaRecordToCasaRow(raw);
    if (!mapped || mapped.preco == null) {
      erros.push(`Linha ${linha}: ignorada (preço inválido ou ausente).`);
      continue;
    }

    const link = mapped.link?.trim() || null;
    const linkNorm = link ? normalizeListingLink(link) : null;
    const existingRow = linkNorm ? existingByLink.get(linkNorm) : null;
    const payload = buildPlanilhaImportPayload(mapped, {
      processoId,
      vinculo,
      cidadePadrao,
      estadoPadrao,
      suportaColunaImportado,
      mode: existingRow ? 'update' : 'insert',
    });

    if (existingRow) {
      const saved = await persistListingCasa(supabase, 'update', payload, existingRow.id);
      if (!saved.ok) erros.push(`Linha ${linha}: ${saved.error}`);
      else updated++;
    } else {
      const saved = await persistListingCasa(supabase, 'insert', payload);
      if (!saved.ok) erros.push(`Linha ${linha}: ${saved.error}`);
      else {
        inserted++;
        if (link && saved.id) {
          existingByLink.set(normalizeListingLink(link), { id: saved.id });
        }
      }
    }
  }

  return { inserted, updated, erros };
}

export type ValidarStatusLinksResult = {
  verificados: number;
  despublicados: number;
  republicados: number;
  indeterminados: number;
  bloqueados: number;
  erros: string[];
};

async function mapComConcorrencia<T, R>(
  items: T[],
  limite: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limite, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) break;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Verifica links de casas manuais/importadas e atualiza status quando o anúncio
 * estiver indisponível (ou republicado). Grava `ultima_validacao_casas_manuais_em`.
 */
export async function validarStatusLinksListingsCasas(
  supabase: SupabaseServer,
  processoId: string,
  opts?: { apenasLinks?: string[] },
): Promise<ValidarStatusLinksResult> {
  const selectFull = await supabase
    .from('listings_casas')
    .select('id, link, status, manual, importado')
    .eq('processo_id', processoId);

  let rows: Array<{
    id: string;
    link: string | null;
    status: string | null;
    manual?: boolean | null;
    importado?: boolean | null;
  }> = (selectFull.data ?? []) as typeof rows;

  if (selectFull.error && isSupabaseMissingColumnError(selectFull.error.message)) {
    const fallback = await supabase
      .from('listings_casas')
      .select('id, link, status, manual')
      .eq('processo_id', processoId);
    rows = (fallback.data ?? []) as typeof rows;
  }

  const linksFiltro = opts?.apenasLinks?.map((l) => l.trim()).filter(Boolean);
  const linksSet = linksFiltro && linksFiltro.length > 0 ? new Set(linksFiltro) : null;

  const candidatas = (rows ?? []).filter((row) => {
    if (!listingProtegidoContraZap(row)) return false;
    const link = row.link?.trim();
    if (!link) return false;
    if (linksSet && !linksSet.has(link)) return false;
    return true;
  });

  const hoje = new Date().toISOString().slice(0, 10);
  let despublicados = 0;
  let republicados = 0;
  let indeterminados = 0;
  let bloqueados = 0;
  const erros: string[] = [];

  type Candidata = (typeof candidatas)[number];
  type Pendente = { row: Candidata; link: string; statusAtual: 'a_venda' | 'despublicado' };

  async function aplicarStatus(row: Candidata, link: string, inferido: 'a_venda' | 'despublicado' | 'indeterminado') {
    const statusAtual = row.status === 'despublicado' ? 'despublicado' : 'a_venda';

    if (inferido === 'indeterminado') {
      indeterminados++;
      return;
    }

    if (inferido === 'despublicado' && statusAtual !== 'despublicado') {
      const { error } = await supabase
        .from('listings_casas')
        .update({ status: 'despublicado', data_despublicado: hoje })
        .eq('id', row.id);
      if (error) erros.push(`${link}: ${error.message}`);
      else despublicados++;
      return;
    }

    if (inferido === 'a_venda' && statusAtual === 'despublicado') {
      const { error } = await supabase
        .from('listings_casas')
        .update({ status: 'a_venda', data_despublicado: null })
        .eq('id', row.id);
      if (error) erros.push(`${link}: ${error.message}`);
      else republicados++;
    }
  }

  const pendentesProxy: Pendente[] = [];

  await mapComConcorrencia(candidatas, 4, async (row) => {
    const link = row.link!.trim();
    const direct = await verificarStatusLinkAnuncioDireto(link);

    if (direct.bloqueado) {
      pendentesProxy.push({
        row,
        link,
        statusAtual: row.status === 'despublicado' ? 'despublicado' : 'a_venda',
      });
      return;
    }

    await aplicarStatus(row, link, direct.status);
  });

  if (pendentesProxy.length > 0) {
    const paginas = await fetchPaginasAnuncioViaApify(pendentesProxy.map((p) => p.link));

    for (const pendente of pendentesProxy) {
      const page = paginas.get(pendente.link);

      if (!page?.html) {
        bloqueados++;
        indeterminados++;
        continue;
      }

      const inferido = inferirStatusAnuncioPorHtml(
        page.html,
        page.status,
        page.url,
        pendente.link,
      );
      await aplicarStatus(pendente.row, pendente.link, inferido);
    }
  }

  const { error: procErr } = await supabase
    .from('processo_step_one')
    .update({ ultima_validacao_casas_manuais_em: hoje })
    .eq('id', processoId);
  if (procErr) erros.push(procErr.message);

  return {
    verificados: candidatas.length,
    despublicados,
    republicados,
    indeterminados,
    bloqueados,
    erros,
  };
}
