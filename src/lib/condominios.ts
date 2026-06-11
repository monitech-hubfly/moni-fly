/** Cadastro de condomínios (`condominios`). */

import type { createClient } from '@/lib/supabase/server';

export type CondominioRow = {
  id: string;
  nome: string;
  endereco: string | null;
  numero: string | null;
  cep: string | null;
  cidade: string | null;
  estado: string | null;
  ticket_medio_lote: number | null;
  ticket_medio_casas: number | null;
  ticket_medio_casas_rsm2: number | null;
  estimativa_casas_vendidas_ano: number | null;
  extrato_como_eram_casas: string | null;
  extrato_tempo_venda: string | null;
  recuo_frontal_m: number | null;
  recuo_fundo_m: number | null;
  recuo_lateral_m: number | null;
  criado_por?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export const CONDOMINIO_CURRENCY_FMT = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function formatCondominioMoeda(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return CONDOMINIO_CURRENCY_FMT.format(value);
}

export function formatCondominioInteiro(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return String(Math.trunc(value));
}

export function normalizarParaBuscaCondominio(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function numToSearch(n: number | null): string {
  if (n == null || Number.isNaN(n)) return '';
  return String(n);
}

export function condominioRowMatchesBusca(row: CondominioRow, busca: string): boolean {
  const q = normalizarParaBuscaCondominio(busca);
  if (!q) return true;
  const parts: Array<string | null | undefined> = [
    row.nome,
    row.endereco,
    row.numero,
    row.cep,
    row.cidade,
    row.estado,
    numToSearch(row.ticket_medio_lote),
    numToSearch(row.ticket_medio_casas),
    numToSearch(row.ticket_medio_casas_rsm2),
    numToSearch(row.estimativa_casas_vendidas_ano),
    row.extrato_como_eram_casas,
    row.extrato_tempo_venda,
    formatCondominioMoeda(row.ticket_medio_lote),
    formatCondominioMoeda(row.ticket_medio_casas),
    formatCondominioMoeda(row.ticket_medio_casas_rsm2),
  ];
  return parts.some((p) => normalizarParaBuscaCondominio(p ?? '').includes(q));
}

/** Condomínio pertence à praça (cidade + UF) da sessão de preenchimento. */
export function condominioRowNaPraca(
  row: CondominioRow,
  praca: { cidade: string; uf: string } | null | undefined,
): boolean {
  if (!praca) return false;
  const uf = String(praca.uf ?? '').trim().toUpperCase();
  const cidade = String(praca.cidade ?? '').trim();
  if (!cidade || uf.length !== 2) return false;
  const rowUf = String(row.estado ?? '').trim().toUpperCase();
  const rowCidade = String(row.cidade ?? '').trim();
  if (!rowCidade || rowUf.length !== 2) return false;
  return (
    rowUf === uf &&
    normalizarParaBuscaCondominio(rowCidade) === normalizarParaBuscaCondominio(cidade)
  );
}

export function ordenarCondominiosPorNome(rows: CondominioRow[]): CondominioRow[] {
  return [...rows].sort((a, b) =>
    (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR', { sensitivity: 'base' }),
  );
}

function parseNumericField(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseIntegerField(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function mapRow(r: Record<string, unknown>): CondominioRow {
  return {
    id: String(r.id),
    nome: String(r.nome ?? '').trim(),
    endereco: (r.endereco as string | null) ?? null,
    numero: (r.numero as string | null) ?? null,
    cep: (r.cep as string | null) ?? null,
    cidade: (r.cidade as string | null) ?? null,
    estado: (r.estado as string | null) ?? null,
    ticket_medio_lote: parseNumericField(r.ticket_medio_lote),
    ticket_medio_casas: parseNumericField(r.ticket_medio_casas),
    ticket_medio_casas_rsm2: parseNumericField(r.ticket_medio_casas_rsm2),
    estimativa_casas_vendidas_ano: parseIntegerField(r.estimativa_casas_vendidas_ano),
    extrato_como_eram_casas: ((r.extrato_como_eram_casas as string | null) ?? null)?.trim() || null,
    extrato_tempo_venda: ((r.extrato_tempo_venda as string | null) ?? null)?.trim() || null,
    recuo_frontal_m: parseNumericField(r.recuo_frontal_m),
    recuo_fundo_m: parseNumericField(r.recuo_fundo_m),
    recuo_lateral_m: parseNumericField(r.recuo_lateral_m),
    criado_por: (r.criado_por as string | null) ?? null,
    created_at: (r.created_at as string | null) ?? null,
    updated_at: (r.updated_at as string | null) ?? null,
  };
}

export async function condominioNomeJaExiste(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  nome: string,
  ignorarId?: string,
): Promise<boolean> {
  const alvo = normalizarParaBuscaCondominio(nome);
  if (!alvo) return false;
  const { data } = await supabase.from('condominios').select('id, nome');
  for (const r of data ?? []) {
    const id = String((r as { id?: string }).id ?? '');
    if (ignorarId && id === ignorarId) continue;
    const n = String((r as { nome?: string }).nome ?? '');
    if (normalizarParaBuscaCondominio(n) === alvo) return true;
  }
  return false;
}

export async function fetchCondominiosRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<CondominioRow[] | null> {
  const { data, error } = await supabase.from('condominios').select('*').order('nome', { ascending: true });
  if (error) return null;
  return ordenarCondominiosPorNome((data ?? []).map((r) => mapRow(r as Record<string, unknown>)));
}

export type CondominioPatch = {
  nome?: string;
  endereco?: string | null;
  numero?: string | null;
  cep?: string | null;
  cidade?: string | null;
  estado?: string | null;
  ticket_medio_lote?: number | null;
  ticket_medio_casas?: number | null;
  ticket_medio_casas_rsm2?: number | null;
  estimativa_casas_vendidas_ano?: number | null;
  extrato_como_eram_casas?: string | null;
  extrato_tempo_venda?: string | null;
};

export function parseDecimalInput(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const normalized = t.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function parseIntegerInput(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = parseInt(t.replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

export function decimalInputFromValue(value: number | null): string {
  if (value == null || Number.isNaN(value)) return '';
  return String(value);
}

export function integerInputFromValue(value: number | null): string {
  if (value == null || Number.isNaN(value)) return '';
  return String(Math.trunc(value));
}

export function formatEnderecoNumero(endereco: string | null, numero: string | null): string {
  const e = (endereco ?? '').trim();
  const n = (numero ?? '').trim();
  if (e && n) return `${e}, ${n}`;
  return e || n || '—';
}

export function formatCidadeEstadoCondominio(cidade: string | null, estado: string | null): string {
  const c = (cidade ?? '').trim();
  const e = (estado ?? '').trim();
  if (c && e) return `${c} / ${e}`;
  return c || e || '—';
}
