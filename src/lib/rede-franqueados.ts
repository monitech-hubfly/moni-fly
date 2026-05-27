/**
 * Rede de Franqueados: dados vêm da tabela rede_franqueados no Supabase.
 * A tabela é exibida dentro da ferramenta em /rede-franqueados (admin) e na COMUNIDADE (franqueados).
 */

import { createClient } from '@/lib/supabase/server';
import { normalizeNFranquiaCsv } from '@/lib/import-rede-csv';
import { normalizarParaBusca } from '@/lib/painel-tarefas-filtros';

const ORDEM_FALLBACK_FK_MAX = 9999;

function extrairNumeroFranquiaDeTexto(bruto: string): number | null {
  const fk = bruto.match(/fk\s*0*(\d+)/i);
  if (fk) {
    const n = parseInt(fk[1] ?? '', 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  if (/^\d+$/.test(bruto)) {
    const n = parseInt(bruto, 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  const norm = normalizeNFranquiaCsv(bruto);
  if (norm) {
    const m = norm.match(/(\d+)$/);
    if (m) {
      const n = parseInt(m[1] ?? '', 10);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  }
  return null;
}

/** Chave canônica FK0000… para ordenação e exibição (mesma regra nos dois lugares). */
export function canonicalNFranquiaRede(
  n_franquia: string | number | null | undefined,
  ordem?: number | null,
): string {
  if (n_franquia !== null && n_franquia !== undefined) {
    const bruto = String(n_franquia).trim();
    if (bruto) {
      const n = extrairNumeroFranquiaDeTexto(bruto);
      if (n !== null) return `FK${String(n).padStart(4, '0')}`;
    }
  }
  if (
    typeof ordem === 'number' &&
    Number.isFinite(ordem) &&
    ordem >= 0 &&
    ordem <= ORDEM_FALLBACK_FK_MAX
  ) {
    return `FK${String(ordem).padStart(4, '0')}`;
  }
  return '';
}

export function formatNFranquiaRedeExibicao(
  n_franquia: string | number | null | undefined,
  ordem?: number | null,
): string {
  return canonicalNFranquiaRede(n_franquia, ordem);
}

export function compareRedePorNFranquia(
  a: { n_franquia?: string | null; ordem?: number | null; id?: string },
  b: { n_franquia?: string | null; ordem?: number | null; id?: string },
): number {
  const ka = canonicalNFranquiaRede(a.n_franquia, a.ordem) || 'ZZZZZZ';
  const kb = canonicalNFranquiaRede(b.n_franquia, b.ordem) || 'ZZZZZZ';
  const d = ka.localeCompare(kb, 'pt-BR', { sensitivity: 'base' });
  if (d !== 0) return d;
  return String(a.id ?? '').localeCompare(String(b.id ?? ''));
}

export function ordenarRedePorNFranquia<
  T extends { n_franquia?: string | null; ordem?: number | null; id?: string },
>(rows: T[]): T[] {
  return [...rows].sort(compareRedePorNFranquia);
}

export const COLUNAS_REDE_FRANQUEADOS = [
  'N de Franquia',
  'Modalidade',
  'Nome Completo do Franqueado',
  'Status da Franquia',
  'Classificação do Franqueado',
  'Data de Ass. COF',
  'Data de Ass. Contrato',
  'Data de Expiração da Franquia',
  'Regional',
  'Área de Atuação da Franquia',
  'E-mail do Frank',
  'Responsável Comercial',
  'Telefone do Frank',
  'CPF do Frank',
  'Data de Nasc. Frank',
  'Rua Casa Frank',
  'Número Casa Frank',
  'Complemento Casa Frank',
  'CEP Casa Frank',
  'Estado Casa Frank',
  'Cidade Casa Frank',
  'Tamanho da Camiseta do Frank',
  'Sócios (Nome, Nascimento, Telefone, E-mail, CPF, Endereço Completo, Tamanho da camisa)',
  'Data de Recebimento do Kit de Boas Vindas',
] as const;

export type RedeFranqueadosData = {
  headers: string[];
  rows: string[][];
  totalCount: number;
  activeCount: number;
} | null;

export const REDE_FRANQUEADOS_DB_KEYS = [
  'n_franquia',
  'modalidade',
  'nome_completo',
  'status_franquia',
  'classificacao_franqueado',
  'data_ass_cof',
  'data_ass_contrato',
  'data_expiracao_franquia',
  'regional',
  'area_atuacao',
  'email_frank',
  'responsavel_comercial',
  'telefone_frank',
  'cpf_frank',
  'data_nasc_frank',
  'endereco_casa_frank',
  'endereco_casa_frank_numero',
  'endereco_casa_frank_complemento',
  'cep_casa_frank',
  'estado_casa_frank',
  'cidade_casa_frank',
  'tamanho_camisa_frank',
  'socios',
  'data_recebimento_kit_boas_vindas',
] as const;

export type RedeFranqueadoDbKey = (typeof REDE_FRANQUEADOS_DB_KEYS)[number];
export type RedeFranqueadoRowDb = Record<RedeFranqueadoDbKey, string | null> & {
  id: string;
  ordem: number;
  processo_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  anexo_cof_path?: string | null;
  anexo_contrato_path?: string | null;
  anexo_numero_franquia_path?: string | null;
};

type RowDb = Record<RedeFranqueadoDbKey, string | null>;
type OldRow = {
  nome?: string | null;
  unidade?: string | null;
  cidade?: string | null;
  estado?: string | null;
  email?: string | null;
  telefone?: string | null;
  observacoes?: string | null;
};
type RowAny = RowDb & OldRow;

function formatDate(val: string | null | undefined): string {
  if (!val) return '';
  const d = new Date(val);
  return isNaN(d.getTime()) ? String(val) : d.toLocaleDateString('pt-BR');
}

function rowToArray(r: RowAny): string[] {
  return [
    r.n_franquia ?? r.unidade ?? '',
    (r as unknown as { modalidade?: string | null }).modalidade ?? '',
    r.nome_completo ?? r.nome ?? '',
    r.status_franquia ?? '',
    r.classificacao_franqueado ?? '',
    formatDate(r.data_ass_cof),
    formatDate(r.data_ass_contrato),
    formatDate(r.data_expiracao_franquia),
    r.regional ?? '',
    r.area_atuacao ?? '',
    r.email_frank ?? r.email ?? '',
    (r as unknown as { responsavel_comercial?: string | null }).responsavel_comercial ?? '',
    r.telefone_frank ?? r.telefone ?? '',
    r.cpf_frank ?? '',
    formatDate(r.data_nasc_frank),
    r.endereco_casa_frank ?? '',
    r.endereco_casa_frank_numero ?? '',
    r.endereco_casa_frank_complemento ?? '',
    r.cep_casa_frank ?? '',
    r.estado_casa_frank ?? r.estado ?? '',
    r.cidade_casa_frank ?? r.cidade ?? '',
    r.tamanho_camisa_frank ?? '',
    r.socios ?? r.observacoes ?? '',
    formatDate(r.data_recebimento_kit_boas_vindas),
  ];
}

/**
 * Busca os dados da rede de franqueados na tabela do Supabase.
 */
export async function fetchRedeFranqueados(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<RedeFranqueadosData> {
  const { data, error } = await supabase.from('rede_franqueados').select('*');

  if (error) return null;
  const list = ordenarRedePorNFranquia(data || []);
  const rows = list.map((r) => rowToArray(r as RowAny));
  const activeCount = list.filter((r) => {
    const s = String((r as { status_franquia?: string | null })?.status_franquia ?? '').toLowerCase();
    return s.includes('em operação') || s.includes('em operacao');
  }).length;
  return {
    headers: [...COLUNAS_REDE_FRANQUEADOS],
    rows,
    totalCount: list.length,
    activeCount,
  };
}

/**
 * Versão raw (com id) para a tabela editável (admin).
 */
export async function fetchRedeFranqueadosRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<RedeFranqueadoRowDb[] | null> {
  const { data, error } = await supabase.from('rede_franqueados').select('*');
  if (error) return null;
  return ordenarRedePorNFranquia((data ?? []) as RedeFranqueadoRowDb[]);
}

/** Colunas permitidas no portal Frank (tabela + agregados dos gráficos). Não inclui dados sensíveis. */
export const REDE_PORTAL_FRANK_SELECT = [
  'id',
  'ordem',
  'n_franquia',
  'nome_completo',
  'status_franquia',
  'modalidade',
  'area_atuacao',
  'email_frank',
  'telefone_frank',
  'responsavel_comercial',
  'regional',
  'estado_casa_frank',
].join(', ');

export type RedeFranqueadoRowPortalFrank = Pick<
  RedeFranqueadoRowDb,
  | 'id'
  | 'ordem'
  | 'n_franquia'
  | 'nome_completo'
  | 'status_franquia'
  | 'modalidade'
  | 'area_atuacao'
  | 'email_frank'
  | 'telefone_frank'
  | 'responsavel_comercial'
  | 'regional'
  | 'estado_casa_frank'
>;

function nullRedeDbFields(): Record<RedeFranqueadoDbKey, string | null> {
  const o = {} as Record<RedeFranqueadoDbKey, string | null>;
  for (const k of REDE_FRANQUEADOS_DB_KEYS) {
    o[k] = null;
  }
  return o;
}

/** Preenche campos ausentes com null para reutilizar `RedeDashboard` sem expor colunas ocultas. */
export function redePortalFrankRowParaDashboardRow(frank: RedeFranqueadoRowPortalFrank): RedeFranqueadoRowDb {
  return {
    id: frank.id,
    ordem: frank.ordem,
    processo_id: null,
    created_at: null,
    updated_at: null,
    ...nullRedeDbFields(),
    n_franquia: frank.n_franquia,
    nome_completo: frank.nome_completo,
    status_franquia: frank.status_franquia,
    modalidade: frank.modalidade,
    area_atuacao: frank.area_atuacao,
    email_frank: frank.email_frank,
    telefone_frank: frank.telefone_frank,
    responsavel_comercial: frank.responsavel_comercial,
    regional: frank.regional,
    estado_casa_frank: frank.estado_casa_frank,
  };
}

export async function fetchRedeFranqueadosRowsPortalFrank(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<RedeFranqueadoRowPortalFrank[] | null> {
  const { data, error } = await supabase.from('rede_franqueados').select(REDE_PORTAL_FRANK_SELECT);
  if (error) return null;
  return ordenarRedePorNFranquia((data ?? []) as unknown as RedeFranqueadoRowPortalFrank[]);
}

const REDE_BUSCA_DATE_KEYS = new Set<RedeFranqueadoDbKey>([
  'data_ass_cof',
  'data_ass_contrato',
  'data_expiracao_franquia',
  'data_nasc_frank',
  'data_recebimento_kit_boas_vindas',
]);

function variantesTextoBuscaRede(k: RedeFranqueadoDbKey, raw: string | null | undefined): string[] {
  if (raw == null || raw === '') return [];
  const s = String(raw);
  if (k === 'n_franquia') {
    const variants = [s];
    const m = s.match(/fk\s*0*(\d+)/i);
    if (m) {
      const n = parseInt(m[1] ?? '', 10);
      if (Number.isFinite(n) && n >= 0) variants.push(`FK${String(n).padStart(4, '0')}`);
    }
    return variants;
  }
  if (REDE_BUSCA_DATE_KEYS.has(k)) {
    const variants = [s];
    if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) variants.push(s.slice(0, 10));
    const d = new Date(s);
    if (!isNaN(d.getTime())) variants.push(d.toLocaleDateString('pt-BR'));
    return variants;
  }
  return [s];
}

/** Busca case-insensitive em qualquer coluna exibida na planilha da rede. */
export function redeFranqueadoRowMatchesBusca(row: RedeFranqueadoRowDb, busca: string): boolean {
  const q = normalizarParaBusca(busca);
  if (!q) return true;
  for (const k of REDE_FRANQUEADOS_DB_KEYS) {
    for (const v of variantesTextoBuscaRede(k, row[k])) {
      if (normalizarParaBusca(v).includes(q)) return true;
    }
  }
  return false;
}
