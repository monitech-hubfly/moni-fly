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
  data_vencimento?: string | null;
  atividade_status?: string | null;
};

export function rankChamadoPainelUnificado(row: RankChamadoPainelInput): { group: number; dueMs: number } {
  const st = String(row.atividade_status ?? '')
    .trim()
    .toLowerCase();
  if (st === 'concluida' || st === 'concluída' || st === 'cancelada') {
    const due = parseDateOnlyLocal(row.data_vencimento ?? null);
    const dueMs =
      due != null && !Number.isNaN(due.getTime()) ? due.getTime() : Number.POSITIVE_INFINITY;
    return { group: 100, dueMs };
  }

  const hasFrankId = row.frank_id != null && String(row.frank_id).trim() !== '';
  const hasFrankNome = (row.franqueado_nome ?? '').trim() !== '';
  const hasFrank = hasFrankId || hasFrankNome;
  const trava = Boolean(row.trava);
  const due = parseDateOnlyLocal(row.data_vencimento ?? null);
  const today = startOfTodayLocal();
  const overdue = due != null && due < today;
  const dueMs =
    due != null && !Number.isNaN(due.getTime()) ? due.getTime() : Number.POSITIVE_INFINITY;

  if (hasFrank && trava && overdue) return { group: 1, dueMs };
  if (trava && overdue) return { group: 2, dueMs };
  if (hasFrank && trava) return { group: 3, dueMs };
  if (trava) return { group: 4, dueMs };
  if (hasFrank) return { group: 5, dueMs };
  return { group: 6, dueMs };
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
