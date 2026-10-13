/** Cadastro de empreendimentos IMOB (`imob_empreendimentos`). */

import type { createClient } from '@/lib/supabase/server';
import { isCadastroValorVazio } from '@/lib/cadastro-linha-em-branco';
import { formatIsoDateOnlyPtBr } from '@/lib/dias-uteis';
import {
  NEGOCIO_PRAZO_DRAFT_VAZIO,
  formatNegocioPrazoDisplay,
  negocioPrazoValoresFromDraft,
  type NegocioPrazoDraft,
} from '@/lib/kanban/dados-negocio-prazo';

export type ImobEmpreendimentoRow = {
  id: string;
  nome: string;
  slug: string | null;
  specs: string | null;
  ativo: boolean;
  imagem_url: string | null;
  share_token: string | null;
  card_id: string | null;
  condominio_id: string | null;
  created_at: string | null;
  // joined via supabase
  condominio_nome: string | null;
  condominio_cidade: string | null;
  condominio_estado: string | null;
  card_titulo: string | null;
  card_status: string | null;
  // computed counts (loaded separately or via rpc)
  corretores_count?: number;
  unidades_count?: number;
  // linked corretor ids (loaded on demand)
  corretor_ids?: string[];
  tipo_negocio: string | null;
  pasta_drive: string | null;
  valor_terreno: string | null;
  pct_compra_parcial_terreno: number | null;
  pct_vgv_terrenista: number | null;
  divida_terreno: string | null;
  m2_terreno: number | null;
  contratos: string | null;
  prazo_opcao: NegocioPrazoDraft;
  produto_modelo: string | null;
  extrato_modelo_configurado: string | null;
  m2_casa: number | null;
  custo_obra: string | null;
  divida_obra: string | null;
  link_bca: string | null;
  link_mapa_competidores: string | null;
  vgv_pretendido: string | null;
  valor_recompra: string | null;
  link_acoplamento: string | null;
  link_gbox: string | null;
  link_apresentacao_comite: string | null;
  data_aprovacao_comite: string | null;
  prazo_instrumento_garantidor: NegocioPrazoDraft;
  link_projeto_legal: string | null;
  link_docs_condominio: string | null;
  data_aprovacao_condominio: string | null;
  data_aprovacao_prefeitura: string | null;
  data_emissao_alvara: string | null;
  data_envio_credito_obra: string | null;
  data_aprovacao_credito_obra: string | null;
  data_inicio_obra: string | null;
};

export type EmpreendimentoNegocioKey = keyof Pick<
  ImobEmpreendimentoRow,
  | 'tipo_negocio'
  | 'pasta_drive'
  | 'valor_terreno'
  | 'pct_compra_parcial_terreno'
  | 'pct_vgv_terrenista'
  | 'divida_terreno'
  | 'm2_terreno'
  | 'contratos'
  | 'prazo_opcao'
  | 'produto_modelo'
  | 'extrato_modelo_configurado'
  | 'm2_casa'
  | 'custo_obra'
  | 'divida_obra'
  | 'link_bca'
  | 'link_mapa_competidores'
  | 'vgv_pretendido'
  | 'valor_recompra'
  | 'link_acoplamento'
  | 'link_gbox'
  | 'link_apresentacao_comite'
  | 'data_aprovacao_comite'
  | 'prazo_instrumento_garantidor'
  | 'link_projeto_legal'
  | 'link_docs_condominio'
  | 'data_aprovacao_condominio'
  | 'data_aprovacao_prefeitura'
  | 'data_emissao_alvara'
  | 'data_envio_credito_obra'
  | 'data_aprovacao_credito_obra'
  | 'data_inicio_obra'
>;

export type EmpreendimentoNegocioCampoKind =
  | 'select-tipo'
  | 'url'
  | 'moeda'
  | 'percent'
  | 'm2'
  | 'prazo'
  | 'select-produto'
  | 'data';

export type EmpreendimentoNegocioCampo = {
  key: EmpreendimentoNegocioKey;
  label: string;
  kind: EmpreendimentoNegocioCampoKind;
};

/** Ordem do Cadastro de Empreendimentos (Rede Casa Moní). */
export const CAMPOS_NEGOCIO_EMPREENDIMENTO: EmpreendimentoNegocioCampo[] = [
  { key: 'tipo_negocio', label: 'Tipo de negócio', kind: 'select-tipo' },
  { key: 'pasta_drive', label: 'Pasta do Drive', kind: 'url' },
  { key: 'valor_terreno', label: 'Valor do Terreno', kind: 'moeda' },
  { key: 'pct_compra_parcial_terreno', label: '% Compra Parcial Terreno', kind: 'percent' },
  { key: 'pct_vgv_terrenista', label: '% VGV Terrenista', kind: 'percent' },
  { key: 'divida_terreno', label: 'Dívida Terreno', kind: 'moeda' },
  { key: 'm2_terreno', label: 'M² Terreno', kind: 'm2' },
  { key: 'contratos', label: 'Contratos', kind: 'url' },
  { key: 'prazo_opcao', label: 'Prazo Opção', kind: 'prazo' },
  { key: 'produto_modelo', label: 'Produto / Modelo', kind: 'select-produto' },
  { key: 'extrato_modelo_configurado', label: 'Extrato Modelo Configurado', kind: 'url' },
  { key: 'm2_casa', label: 'M² Casa', kind: 'm2' },
  { key: 'custo_obra', label: 'Custo da Obra', kind: 'moeda' },
  { key: 'divida_obra', label: 'Dívida Obra', kind: 'moeda' },
  { key: 'link_bca', label: 'BCA', kind: 'url' },
  { key: 'link_mapa_competidores', label: 'Mapa de Competidores', kind: 'url' },
  { key: 'vgv_pretendido', label: 'VGV pretendido', kind: 'moeda' },
  { key: 'valor_recompra', label: 'Valor Recompra', kind: 'moeda' },
  { key: 'link_acoplamento', label: 'Acoplamento', kind: 'url' },
  { key: 'link_gbox', label: 'GBOX', kind: 'url' },
  { key: 'link_apresentacao_comite', label: 'Apresentação Comitê', kind: 'url' },
  { key: 'data_aprovacao_comite', label: 'Data Aprovação Comitê', kind: 'data' },
  { key: 'prazo_instrumento_garantidor', label: 'Prazo Instrumento Garantidor', kind: 'prazo' },
  { key: 'link_projeto_legal', label: 'Projeto Legal', kind: 'url' },
  { key: 'link_docs_condominio', label: 'Docs Condomínio', kind: 'url' },
  { key: 'data_aprovacao_condominio', label: 'Data Aprovação no Condomínio', kind: 'data' },
  { key: 'data_aprovacao_prefeitura', label: 'Data Aprovação na Prefeitura', kind: 'data' },
  { key: 'data_emissao_alvara', label: 'Data Emissão do Alvará', kind: 'data' },
  { key: 'data_envio_credito_obra', label: 'Data Envio p/ Crédito Obra', kind: 'data' },
  { key: 'data_aprovacao_credito_obra', label: 'Data Aprovação Crédito Obra', kind: 'data' },
  { key: 'data_inicio_obra', label: 'Data Início de Obra', kind: 'data' },
];

const NEGOCIO_SELECT = CAMPOS_NEGOCIO_EMPREENDIMENTO.map((c) => c.key).join(', ');

export function negocioInicialEmpreendimento(
  row: ImobEmpreendimentoRow | null,
): Pick<ImobEmpreendimentoRow, EmpreendimentoNegocioKey> {
  const prazo = () => ({ ...NEGOCIO_PRAZO_DRAFT_VAZIO });
  const blank: Pick<ImobEmpreendimentoRow, EmpreendimentoNegocioKey> = {
    tipo_negocio: null,
    pasta_drive: null,
    valor_terreno: null,
    pct_compra_parcial_terreno: null,
    pct_vgv_terrenista: null,
    divida_terreno: null,
    m2_terreno: null,
    contratos: null,
    prazo_opcao: prazo(),
    produto_modelo: null,
    extrato_modelo_configurado: null,
    m2_casa: null,
    custo_obra: null,
    divida_obra: null,
    link_bca: null,
    link_mapa_competidores: null,
    vgv_pretendido: null,
    valor_recompra: null,
    link_acoplamento: null,
    link_gbox: null,
    link_apresentacao_comite: null,
    data_aprovacao_comite: null,
    prazo_instrumento_garantidor: prazo(),
    link_projeto_legal: null,
    link_docs_condominio: null,
    data_aprovacao_condominio: null,
    data_aprovacao_prefeitura: null,
    data_emissao_alvara: null,
    data_envio_credito_obra: null,
    data_aprovacao_credito_obra: null,
    data_inicio_obra: null,
  };
  if (!row) return blank;
  for (const campo of CAMPOS_NEGOCIO_EMPREENDIMENTO) {
    (blank as Record<string, unknown>)[campo.key] = row[campo.key];
  }
  return blank;
}

export type ImobEmpreendimentoPatch = Partial<{
  nome: string;
  slug: string | null;
  specs: string | null;
  ativo: boolean;
  imagem_url: string | null;
  card_id: string | null;
  condominio_id: string | null;
  tipo_negocio?: string | null;
  pasta_drive?: string | null;
  valor_terreno?: string | null;
  pct_compra_parcial_terreno?: number | null;
  pct_vgv_terrenista?: number | null;
  divida_terreno?: string | null;
  m2_terreno?: number | null;
  contratos?: string | null;
  prazo_opcao?: NegocioPrazoDraft | null;
  produto_modelo?: string | null;
  extrato_modelo_configurado?: string | null;
  m2_casa?: number | null;
  custo_obra?: string | null;
  divida_obra?: string | null;
  link_bca?: string | null;
  link_mapa_competidores?: string | null;
  vgv_pretendido?: string | null;
  valor_recompra?: string | null;
  link_acoplamento?: string | null;
  link_gbox?: string | null;
  link_apresentacao_comite?: string | null;
  data_aprovacao_comite?: string | null;
  prazo_instrumento_garantidor?: NegocioPrazoDraft | null;
  link_projeto_legal?: string | null;
  link_docs_condominio?: string | null;
  data_aprovacao_condominio?: string | null;
  data_aprovacao_prefeitura?: string | null;
  data_emissao_alvara?: string | null;
  data_envio_credito_obra?: string | null;
  data_aprovacao_credito_obra?: string | null;
  data_inicio_obra?: string | null;
}>;

const CHAVES_TEXTO_NEGOCIO = [
  'tipo_negocio',
  'pasta_drive',
  'valor_terreno',
  'divida_terreno',
  'contratos',
  'produto_modelo',
  'extrato_modelo_configurado',
  'custo_obra',
  'divida_obra',
  'link_bca',
  'link_mapa_competidores',
  'vgv_pretendido',
  'valor_recompra',
  'link_acoplamento',
  'link_gbox',
  'link_apresentacao_comite',
  'link_projeto_legal',
  'link_docs_condominio',
] as const;

const CHAVES_NUMERO_NEGOCIO = [
  'pct_compra_parcial_terreno',
  'pct_vgv_terrenista',
  'm2_terreno',
  'm2_casa',
] as const;

const CHAVES_DATA_NEGOCIO = [
  'data_aprovacao_comite',
  'data_aprovacao_condominio',
  'data_aprovacao_prefeitura',
  'data_emissao_alvara',
  'data_envio_credito_obra',
  'data_aprovacao_credito_obra',
  'data_inicio_obra',
] as const;

const CHAVES_PRAZO_NEGOCIO = ['prazo_opcao', 'prazo_instrumento_garantidor'] as const;

function prazoParaDb(draft: NegocioPrazoDraft | null | undefined): NegocioPrazoDraft | null {
  if (!draft?.modo) return null;
  return {
    modo: draft.modo,
    dias: String(draft.dias ?? ''),
    slaTipo: draft.slaTipo === 'corridos' ? 'corridos' : 'uteis',
    faseId: String(draft.faseId ?? ''),
    data: String(draft.data ?? '').slice(0, 10),
  };
}

/** Campos de negócio prontos para insert/update. Vazio vira null. */
export function negocioDbFromPatch(patch: ImobEmpreendimentoPatch): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const key of CHAVES_TEXTO_NEGOCIO) {
    if (patch[key] === undefined) continue;
    row[key] = txt(patch[key]);
  }
  for (const key of CHAVES_NUMERO_NEGOCIO) {
    if (patch[key] === undefined) continue;
    row[key] = num(patch[key]);
  }
  for (const key of CHAVES_DATA_NEGOCIO) {
    if (patch[key] === undefined) continue;
    row[key] = ymd(patch[key]);
  }
  for (const key of CHAVES_PRAZO_NEGOCIO) {
    if (patch[key] === undefined) continue;
    row[key] = prazoParaDb(patch[key]);
  }
  return row;
}

export function isImobEmpreendimentoLinhaEmBranco(row: { nome?: string | null }): boolean {
  return isCadastroValorVazio(row.nome);
}

export function normalizarParaBuscaImob(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function imobEmpreendimentoRowMatchesBusca(
  row: ImobEmpreendimentoRow,
  busca: string,
): boolean {
  const q = normalizarParaBuscaImob(busca);
  if (!q) return true;
  const parts = [
    row.nome,
    row.slug,
    row.specs,
    row.condominio_nome,
    row.condominio_cidade,
    row.condominio_estado,
    row.card_titulo,
    row.tipo_negocio,
    row.produto_modelo,
    row.pasta_drive,
  ];
  return parts.some((p) => normalizarParaBuscaImob(String(p ?? '')).includes(q));
}

export function ordenarImobEmpreendimentosPorNome(
  rows: ImobEmpreendimentoRow[],
): ImobEmpreendimentoRow[] {
  return [...rows].sort((a, b) =>
    (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR', { sensitivity: 'base' }),
  );
}

/** Agrupa empreendimentos por condomínio. */
export function agruparPorCondominio(
  rows: ImobEmpreendimentoRow[],
): Array<{ condominio_id: string | null; condominio_nome: string; rows: ImobEmpreendimentoRow[] }> {
  const map = new Map<string, { condominio_id: string | null; condominio_nome: string; rows: ImobEmpreendimentoRow[] }>();
  for (const row of rows) {
    const key = row.condominio_id ?? '__sem_condominio__';
    if (!map.has(key)) {
      map.set(key, {
        condominio_id: row.condominio_id,
        condominio_nome: row.condominio_nome ?? 'Sem condomínio',
        rows: [],
      });
    }
    map.get(key)!.rows.push(row);
  }
  return [...map.values()].sort((a, b) =>
    a.condominio_nome.localeCompare(b.condominio_nome, 'pt-BR', { sensitivity: 'base' }),
  );
}

type RawImobEmp = Record<string, unknown> & {
  condominios?: { id?: string; nome?: string; cidade?: string; estado?: string } | null;
  kanban_cards?: { id?: string; titulo?: string; status?: string } | null;
};

function txt(v: unknown): string | null {
  const s = String(v ?? '').trim();
  return s || null;
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function ymd(v: unknown): string | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  return s.slice(0, 10);
}

function prazoFromDb(raw: unknown): NegocioPrazoDraft {
  if (!raw || typeof raw !== 'object') return { ...NEGOCIO_PRAZO_DRAFT_VAZIO };
  const o = raw as Partial<NegocioPrazoDraft>;
  const modo = o.modo === 'fase' || o.modo === 'data' ? o.modo : '';
  return {
    modo,
    dias: String(o.dias ?? ''),
    slaTipo: o.slaTipo === 'corridos' ? 'corridos' : 'uteis',
    faseId: String(o.faseId ?? ''),
    data: String(o.data ?? '').slice(0, 10),
  };
}

function moedaTexto(raw: string | null): string {
  const s = String(raw ?? '').trim();
  if (!s) return '—';
  const normalized = s.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  if (!Number.isNaN(n) && Number.isFinite(n)) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
  }
  return s;
}

export function textoColunaNegocioEmpreendimento(
  row: ImobEmpreendimentoRow,
  campo: EmpreendimentoNegocioCampo,
): string {
  const value = row[campo.key];
  if (campo.kind === 'prazo') {
    return formatNegocioPrazoDisplay(negocioPrazoValoresFromDraft(value as NegocioPrazoDraft));
  }
  if (campo.kind === 'moeda') return moedaTexto(value as string | null);
  if (campo.kind === 'percent') return value == null ? '—' : `${value}%`;
  if (campo.kind === 'm2') return value == null ? '—' : `${value} m²`;
  if (campo.kind === 'data') {
    const iso = String(value ?? '').trim();
    if (!iso) return '—';
    return formatIsoDateOnlyPtBr(iso) ?? iso;
  }
  const s = String(value ?? '').trim();
  return s || '—';
}

export function hrefColunaNegocio(raw: string | null | undefined): string | null {
  const t = String(raw ?? '').trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function mapRow(r: RawImobEmp): ImobEmpreendimentoRow {
  const cond = r.condominios ?? null;
  const card = r.kanban_cards ?? null;
  return {
    id: String(r.id),
    nome: String(r.nome ?? '').trim(),
    slug: (r.slug as string | null) ?? null,
    specs: ((r.specs as string | null) ?? null)?.trim() || null,
    ativo: Boolean(r.ativo ?? true),
    imagem_url: (r.imagem_url as string | null) ?? null,
    share_token: (r.share_token as string | null) ?? null,
    card_id: (r.card_id as string | null) ?? null,
    condominio_id: (r.condominio_id as string | null) ?? null,
    created_at: (r.created_at as string | null) ?? null,
    condominio_nome: cond?.nome ?? null,
    condominio_cidade: cond?.cidade ?? null,
    condominio_estado: cond?.estado ?? null,
    card_titulo: card?.titulo ?? null,
    card_status: card?.status ?? null,
    tipo_negocio: txt(r.tipo_negocio),
    pasta_drive: txt(r.pasta_drive),
    valor_terreno: txt(r.valor_terreno),
    pct_compra_parcial_terreno: num(r.pct_compra_parcial_terreno),
    pct_vgv_terrenista: num(r.pct_vgv_terrenista),
    divida_terreno: txt(r.divida_terreno),
    m2_terreno: num(r.m2_terreno),
    contratos: txt(r.contratos),
    prazo_opcao: prazoFromDb(r.prazo_opcao),
    produto_modelo: txt(r.produto_modelo),
    extrato_modelo_configurado: txt(r.extrato_modelo_configurado),
    m2_casa: num(r.m2_casa),
    custo_obra: txt(r.custo_obra),
    divida_obra: txt(r.divida_obra),
    link_bca: txt(r.link_bca),
    link_mapa_competidores: txt(r.link_mapa_competidores),
    vgv_pretendido: txt(r.vgv_pretendido),
    valor_recompra: txt(r.valor_recompra),
    link_acoplamento: txt(r.link_acoplamento),
    link_gbox: txt(r.link_gbox),
    link_apresentacao_comite: txt(r.link_apresentacao_comite),
    data_aprovacao_comite: ymd(r.data_aprovacao_comite),
    prazo_instrumento_garantidor: prazoFromDb(r.prazo_instrumento_garantidor),
    link_projeto_legal: txt(r.link_projeto_legal),
    link_docs_condominio: txt(r.link_docs_condominio),
    data_aprovacao_condominio: ymd(r.data_aprovacao_condominio),
    data_aprovacao_prefeitura: ymd(r.data_aprovacao_prefeitura),
    data_emissao_alvara: ymd(r.data_emissao_alvara),
    data_envio_credito_obra: ymd(r.data_envio_credito_obra),
    data_aprovacao_credito_obra: ymd(r.data_aprovacao_credito_obra),
    data_inicio_obra: ymd(r.data_inicio_obra),
  };
}

export async function fetchImobEmpreendimentosRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<ImobEmpreendimentoRow[] | null> {
  const { data, error } = await supabase
    .from('imob_empreendimentos')
    .select(
      `id, nome, slug, specs, ativo, imagem_url, share_token, card_id, condominio_id, created_at, ${NEGOCIO_SELECT},
       condominios(id, nome, cidade, estado),
       kanban_cards(id, titulo, status)`,
    )
    .order('nome', { ascending: true });

  if (error) {
    console.error('[imob_empreendimentos] fetch:', error.message);
    return null;
  }

  const rows = ((data ?? []) as unknown as RawImobEmp[]).map((r) => mapRow(r));

  // Enrich with counts
  const { data: corretoresLinks } = await supabase
    .from('imob_corretor_empreendimentos')
    .select('empreendimento_id, corretor_id');

  if (corretoresLinks) {
    const countMap = new Map<string, Set<string>>();
    for (const link of corretoresLinks) {
      const empId = String((link as { empreendimento_id?: string }).empreendimento_id ?? '');
      const corrId = String((link as { corretor_id?: string }).corretor_id ?? '');
      if (!countMap.has(empId)) countMap.set(empId, new Set());
      countMap.get(empId)!.add(corrId);
    }
    for (const row of rows) {
      const set = countMap.get(row.id);
      row.corretores_count = set?.size ?? 0;
      row.corretor_ids = set ? [...set] : [];
    }
  }

  const { data: unidades } = await supabase
    .from('imob_card_empreendimentos')
    .select('card_id');

  if (unidades) {
    const unitMap = new Map<string, number>();
    for (const u of unidades) {
      const cardId = String((u as { card_id?: string }).card_id ?? '');
      unitMap.set(cardId, (unitMap.get(cardId) ?? 0) + 1);
    }
    for (const row of rows) {
      row.unidades_count = row.card_id ? (unitMap.get(row.card_id) ?? 0) : 0;
    }
  }

  return rows;
}
