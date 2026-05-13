/**
 * Rede de Franqueados: dados vêm da tabela rede_franqueados no Supabase.
 * A tabela é exibida dentro da ferramenta em /rede-franqueados (admin) e na COMUNIDADE (franqueados).
 */

import { createClient } from '@/lib/supabase/server';

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
  const { data, error } = await supabase
    .from('rede_franqueados')
    .select('*')
    .order('ordem', { ascending: true });

  if (error) return null;
  const list = data || [];
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
  const { data, error } = await supabase
    .from('rede_franqueados')
    .select('*')
    .order('ordem', { ascending: true });
  if (error) return null;
  return (data ?? []) as RedeFranqueadoRowDb[];
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
  const { data, error } = await supabase
    .from('rede_franqueados')
    .select(REDE_PORTAL_FRANK_SELECT)
    .order('ordem', { ascending: true });
  if (error) return null;
  return (data ?? []) as unknown as RedeFranqueadoRowPortalFrank[];
}
