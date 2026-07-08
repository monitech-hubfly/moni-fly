/** Cadastros Moní Capital (`moni_capital_cadastros`). */

import type { createClient } from '@/lib/supabase/server';

export type MoniCapitalCadastroRow = {
  id: string;
  n_cadastro: string;
  ordem: number;
  broker_nome: string | null;
  broker_email: string | null;
  broker_telefone: string | null;
  investidor_nome: string | null;
  investidor_email: string | null;
  investidor_telefone: string | null;
  kanban_card_id: string | null;
  criado_por: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type MoniCapitalCadastroUpsertDados = {
  broker_nome?: string | null;
  broker_email?: string | null;
  broker_telefone?: string | null;
  investidor_nome?: string | null;
  investidor_email?: string | null;
  investidor_telefone?: string | null;
};

export function normalizarEmailMoniCapital(email: string | null | undefined): string {
  return String(email ?? '').trim().toLowerCase();
}

export function normalizarTelefoneMoniCapital(telefone: string | null | undefined): string {
  return String(telefone ?? '').replace(/\D/g, '');
}

function mapRow(r: Record<string, unknown>): MoniCapitalCadastroRow {
  return {
    id: String(r.id),
    n_cadastro: String(r.n_cadastro ?? '').trim(),
    ordem: Number(r.ordem ?? 0),
    broker_nome: (r.broker_nome as string | null) ?? null,
    broker_email: (r.broker_email as string | null) ?? null,
    broker_telefone: (r.broker_telefone as string | null) ?? null,
    investidor_nome: (r.investidor_nome as string | null) ?? null,
    investidor_email: (r.investidor_email as string | null) ?? null,
    investidor_telefone: (r.investidor_telefone as string | null) ?? null,
    kanban_card_id: (r.kanban_card_id as string | null) ?? null,
    criado_por: (r.criado_por as string | null) ?? null,
    created_at: (r.created_at as string | null) ?? null,
    updated_at: (r.updated_at as string | null) ?? null,
  };
}

export async function fetchMoniCapitalCadastrosRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<MoniCapitalCadastroRow[] | null> {
  const { data, error } = await supabase
    .from('moni_capital_cadastros')
    .select('*')
    .order('ordem', { ascending: true });
  if (error) return null;
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export function ordenarMoniCapitalCadastros(rows: MoniCapitalCadastroRow[]): MoniCapitalCadastroRow[] {
  return [...rows].sort((a, b) => a.ordem - b.ordem || a.n_cadastro.localeCompare(b.n_cadastro, 'pt-BR'));
}

function normBusca(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function moniCapitalCadastroMatchesBusca(row: MoniCapitalCadastroRow, busca: string): boolean {
  const q = normBusca(busca);
  if (!q) return true;
  const parts = [
    row.n_cadastro,
    row.broker_nome,
    row.broker_email,
    row.broker_telefone,
    row.investidor_nome,
    row.investidor_email,
    row.investidor_telefone,
  ];
  return parts.some((p) => normBusca(p ?? '').includes(q));
}

export function labelCadastroMoniCapital(row: MoniCapitalCadastroRow): string {
  const broker = row.broker_nome?.trim();
  const investidor = row.investidor_nome?.trim();
  const nomes = [broker, investidor].filter(Boolean).join(' / ');
  return nomes ? `${row.n_cadastro} — ${nomes}` : row.n_cadastro;
}
