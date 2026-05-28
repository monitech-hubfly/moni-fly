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
  ];
  return parts.some((p) => normalizarParaBuscaLoteador(p ?? '').includes(q));
}

export function ordenarRedeLoteadoresPorNome(rows: RedeLoteadorRow[]): RedeLoteadorRow[] {
  return [...rows].sort((a, b) =>
    (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR', { sensitivity: 'base' }),
  );
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
  contato_nome?: string | null;
  contato_telefone?: string | null;
  contato_email?: string | null;
  portfolio_descricao?: string | null;
  status?: RedeLoteadorStatus;
  observacoes?: string | null;
};
