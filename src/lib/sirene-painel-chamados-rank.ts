/**
 * Ordenação da lista unificada (Chamados Sirene + atividades em cards):
 * grupos 1–6 por franqueado / trava / atraso; concluídas por último.
 * Dentro do grupo: prazo ASC (sem prazo por último).
 */

function startOfTodayLocal(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDateOnlyLocal(s: string | null | undefined): Date | null {
  if (!s) return null;
  const head = String(s).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(head)) return null;
  const [y, m, da] = head.split('-').map(Number);
  return new Date(y, m - 1, da);
}

export type RankChamadoPainelInput = {
  frank_id?: string | null;
  /** Fallback quando não há frank_id (ex.: só nome na view). */
  franqueado_nome?: string | null;
  trava?: boolean | null;
  /** Abertura Sirene: "Esse incêndio te trata?" — conta como trava na priorização. */
  te_trata?: boolean | null;
  data_vencimento?: string | null;
  atividade_status?: string | null;
  criado_em?: string | null;
};

export type PrioridadeLabel = 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6';

const PRIORIDADE_BY_GROUP: Record<number, { label: PrioridadeLabel; criterio: string }> = {
  1: { label: 'P1', criterio: 'Franqueado + trava + atrasado' },
  2: { label: 'P2', criterio: 'Trava + atrasado (sem franqueado)' },
  3: { label: 'P3', criterio: 'Franqueado + trava (sem atraso)' },
  4: { label: 'P4', criterio: 'Só trava (sem franqueado)' },
  5: { label: 'P5', criterio: 'Franqueado (sem trava)' },
};
const P6_PRIO = { label: 'P6' as PrioridadeLabel, criterio: 'Demais' } as const;

function groupToPrioridade(group: number): { prioridade_label: PrioridadeLabel; prioridade_criterio: string } {
  const p = PRIORIDADE_BY_GROUP[group] ?? P6_PRIO;
  return { prioridade_label: p.label, prioridade_criterio: p.criterio };
}

export function rankChamadoPainelUnificado(row: RankChamadoPainelInput): {
  group: number;
  dueMs: number;
  prioridade_label: PrioridadeLabel;
  prioridade_criterio: string;
} {
  const st = String(row.atividade_status ?? '')
    .trim()
    .toLowerCase();
  const due = parseDateOnlyLocal(row.data_vencimento ?? null);
  const dueMs =
    due != null && !Number.isNaN(due.getTime()) ? due.getTime() : Number.POSITIVE_INFINITY;

  if (st === 'concluida' || st === 'concluída' || st === 'cancelada') {
    return { group: 100, dueMs, ...groupToPrioridade(100) };
  }

  const hasFrankId = row.frank_id != null && String(row.frank_id).trim() !== '';
  const hasFrankNome = (row.franqueado_nome ?? '').trim() !== '';
  const hasFrank = hasFrankId || hasFrankNome;
  const trava = Boolean(row.trava) || row.te_trata === true;
  const today = startOfTodayLocal();
  const overdue = due != null && due < today;

  let group: number;
  if (hasFrank && trava && overdue) group = 1;
  else if (trava && overdue) group = 2;
  else if (hasFrank && trava) group = 3;
  else if (trava) group = 4;
  else if (hasFrank) group = 5;
  else group = 6;

  return { group, dueMs, ...groupToPrioridade(group) };
}

/** Comparador compartilhado: grupo → prazo → criação (mais recente primeiro). */
export function compareChamadosPainelRank(
  a: RankChamadoPainelInput,
  b: RankChamadoPainelInput,
): number {
  const ra = rankChamadoPainelUnificado(a);
  const rb = rankChamadoPainelUnificado(b);
  if (ra.group !== rb.group) return ra.group - rb.group;
  if (ra.dueMs !== rb.dueMs) return ra.dueMs - rb.dueMs;
  return String(b.criado_em ?? '').localeCompare(String(a.criado_em ?? ''));
}

export function sortChamadosPainelRank<T extends RankChamadoPainelInput>(items: readonly T[]): T[] {
  return [...items].sort(compareChamadosPainelRank);
}

export const ORDEM_GRUPOS_PAINEL: Array<{ key: number; titulo: string }> = [
  { key: 1, titulo: 'Franqueado + trava + atrasado' },
  { key: 2, titulo: 'Trava + atrasado' },
  { key: 3, titulo: 'Franqueado + trava' },
  { key: 4, titulo: 'Só trava' },
  { key: 5, titulo: 'Franqueado (sem trava)' },
  { key: 6, titulo: 'Sem trava' },
  { key: 100, titulo: 'Concluído' },
];
