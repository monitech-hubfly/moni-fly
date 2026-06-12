/** Cadastro de loteadores (`rede_loteadores`). */

import type { createClient } from '@/lib/supabase/server';

export type RedeLoteadorStatus = 'ativo' | 'inativo' | 'em_analise';

export type RedeLoteadorRow = {
  id: string;
  nome: string;
  cnpj: string | null;
  cidade: string | null;
  estado: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  contato_email: string | null;
  portfolio_descricao: string | null;
  status: RedeLoteadorStatus;
  observacoes: string | null;
  /** Interlocutor de negociação (Grupo 1) */
  interlocutor_nome: string | null;
  interlocutor_cargo: string | null;
  interlocutor_telefone: string | null;
  interlocutor_email: string | null;
  /** Condomínio prospectado (Grupo 2) */
  condominio_nome: string | null;
  condominio_data_lancamento: string | null;
  condominio_cidade: string | null;
  condominio_qtd_lotes: number | null;
  condominio_preco_lotes: string | null;
  condominio_metragem_lotes: string | null;
  condominio_preco_casas: string | null;
  condominio_metragem_casas: string | null;
  anexo_planta_cadastral: string | null;
  anexo_manual_obras: string | null;
  anexo_casas_concorrentes: string | null;
  /** Carteira de vendas (Grupo 3) */
  carteira_lotes_disponiveis: number | null;
  carteira_lotes_vendidos_quitados: number | null;
  carteira_carteira_curta_qtd: number | null;
  carteira_curta_financiamento: string | null;
  carteira_longa_qtd: number | null;
  carteira_longa_financiamento: string | null;
  anexo_tabela_precos: string | null;
  /** Campo livre (Grupo 4) */
  campo_livre: string | null;
  anexo_material_extra: string | null;
  condominio_estado: string | null;
  ultima_atualizacao_por: string | null;
  criado_por?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export const REDE_LOTEADOR_STATUS_LABEL: Record<RedeLoteadorStatus, string> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  em_analise: 'Em análise',
};

export function normalizarParaBuscaLoteador(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function redeLoteadorRowMatchesBusca(row: RedeLoteadorRow, busca: string): boolean {
  const q = normalizarParaBuscaLoteador(busca);
  if (!q) return true;
  const parts = [
    row.nome,
    row.cnpj,
    row.cidade,
    row.estado,
    row.contato_nome,
    row.contato_telefone,
    row.contato_email,
    row.portfolio_descricao,
    row.status,
    REDE_LOTEADOR_STATUS_LABEL[row.status],
    row.interlocutor_nome,
    row.interlocutor_cargo,
    row.interlocutor_email,
    row.condominio_nome,
    row.condominio_cidade,
    row.campo_livre,
  ];
  return parts.some((p) => normalizarParaBuscaLoteador(String(p ?? '')).includes(q));
}

export function ordenarRedeLoteadoresPorNome(rows: RedeLoteadorRow[]): RedeLoteadorRow[] {
  return [...rows].sort((a, b) =>
    (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR', { sensitivity: 'base' }),
  );
}

function parseIntOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

function parseDateOrNull(v: unknown): string | null {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, 10);
}

function mapRow(r: Record<string, unknown>): RedeLoteadorRow {
  const statusRaw = String(r.status ?? 'ativo').trim() as RedeLoteadorStatus;
  const status: RedeLoteadorStatus =
    statusRaw === 'inativo' || statusRaw === 'em_analise' ? statusRaw : 'ativo';
  return {
    id: String(r.id),
    nome: String(r.nome ?? '').trim(),
    cnpj: (r.cnpj as string | null) ?? null,
    cidade: (r.cidade as string | null) ?? null,
    estado: (r.estado as string | null) ?? null,
    contato_nome: (r.contato_nome as string | null) ?? null,
    contato_telefone: (r.contato_telefone as string | null) ?? null,
    contato_email: (r.contato_email as string | null) ?? null,
    portfolio_descricao: (r.portfolio_descricao as string | null) ?? null,
    status,
    observacoes: (r.observacoes as string | null) ?? null,
    interlocutor_nome: (r.interlocutor_nome as string | null) ?? null,
    interlocutor_cargo: (r.interlocutor_cargo as string | null) ?? null,
    interlocutor_telefone: (r.interlocutor_telefone as string | null) ?? null,
    interlocutor_email: (r.interlocutor_email as string | null) ?? null,
    condominio_nome: (r.condominio_nome as string | null) ?? null,
    condominio_data_lancamento: parseDateOrNull(r.condominio_data_lancamento),
    condominio_cidade: (r.condominio_cidade as string | null) ?? null,
    condominio_qtd_lotes: parseIntOrNull(r.condominio_qtd_lotes),
    condominio_preco_lotes: (r.condominio_preco_lotes as string | null) ?? null,
    condominio_metragem_lotes: (r.condominio_metragem_lotes as string | null) ?? null,
    condominio_preco_casas: (r.condominio_preco_casas as string | null) ?? null,
    condominio_metragem_casas: (r.condominio_metragem_casas as string | null) ?? null,
    anexo_planta_cadastral: (r.anexo_planta_cadastral as string | null) ?? null,
    anexo_manual_obras: (r.anexo_manual_obras as string | null) ?? null,
    anexo_casas_concorrentes: (r.anexo_casas_concorrentes as string | null) ?? null,
    carteira_lotes_disponiveis: parseIntOrNull(r.carteira_lotes_disponiveis),
    carteira_lotes_vendidos_quitados: parseIntOrNull(r.carteira_lotes_vendidos_quitados),
    carteira_carteira_curta_qtd: parseIntOrNull(r.carteira_carteira_curta_qtd),
    carteira_curta_financiamento: (r.carteira_curta_financiamento as string | null) ?? null,
    carteira_longa_qtd: parseIntOrNull(r.carteira_longa_qtd),
    carteira_longa_financiamento: (r.carteira_longa_financiamento as string | null) ?? null,
    anexo_tabela_precos: (r.anexo_tabela_precos as string | null) ?? null,
    campo_livre: (r.campo_livre as string | null) ?? null,
    anexo_material_extra: (r.anexo_material_extra as string | null) ?? null,
    condominio_estado:
      (r.condominio_estado as string | null) ?? (r.estado as string | null) ?? null,
    ultima_atualizacao_por: (r.ultima_atualizacao_por as string | null) ?? null,
    criado_por: (r.criado_por as string | null) ?? null,
    created_at: (r.created_at as string | null) ?? null,
    updated_at: (r.updated_at as string | null) ?? null,
  };
}

export async function fetchRedeLoteadoresRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<RedeLoteadorRow[] | null> {
  const { data, error } = await supabase.from('rede_loteadores').select('*').order('nome', { ascending: true });
  if (error) return null;
  return ordenarRedeLoteadoresPorNome((data ?? []).map((r) => mapRow(r as Record<string, unknown>)));
}

export type RedeLoteadorPatch = {
  nome?: string;
  cnpj?: string | null;
  cidade?: string | null;
  estado?: string | null;
  condominio_estado?: string | null;
  contato_nome?: string | null;
  contato_telefone?: string | null;
  contato_email?: string | null;
  portfolio_descricao?: string | null;
  status?: RedeLoteadorStatus;
  observacoes?: string | null;
  interlocutor_nome?: string | null;
  interlocutor_cargo?: string | null;
  interlocutor_telefone?: string | null;
  interlocutor_email?: string | null;
  condominio_nome?: string | null;
  condominio_data_lancamento?: string | null;
  condominio_cidade?: string | null;
  condominio_qtd_lotes?: number | null;
  condominio_preco_lotes?: string | null;
  condominio_metragem_lotes?: string | null;
  condominio_preco_casas?: string | null;
  condominio_metragem_casas?: string | null;
  anexo_planta_cadastral?: string | null;
  anexo_manual_obras?: string | null;
  anexo_casas_concorrentes?: string | null;
  carteira_lotes_disponiveis?: number | null;
  carteira_lotes_vendidos_quitados?: number | null;
  carteira_carteira_curta_qtd?: number | null;
  carteira_curta_financiamento?: string | null;
  carteira_longa_qtd?: number | null;
  carteira_longa_financiamento?: string | null;
  anexo_tabela_precos?: string | null;
  campo_livre?: string | null;
  anexo_material_extra?: string | null;
  ultima_atualizacao_por?: string | null;
};
