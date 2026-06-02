export const DASHBOARD_TIPO_KEYS = ['chamado_padrao', 'chamado_hdm', 'atividade', 'duvida'] as const;
export const DASHBOARD_PRIORIDADE_KEYS = ['Urgente', 'Alta', 'Média', 'Baixa'] as const;

export type DashboardBreakdownTab = 'todos' | 'com_trava' | 'atrasados';

export type DashboardChamadoBreakdownRow = {
  status: string;
  prioridade: string;
  comTrava: boolean;
  atrasado: boolean;
};

export type DashboardAtividadeBreakdownRow = {
  tipo: string;
  comTrava: boolean;
  atrasado: boolean;
};

export function slaStatusFromDate(
  dataVencimento: string | null | undefined,
): 'atrasado' | 'vence_hoje' | 'ok' | null {
  if (dataVencimento == null || String(dataVencimento).trim() === '') return null;
  const due = new Date(String(dataVencimento).trim());
  if (!Number.isFinite(due.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  if (due < today) return 'atrasado';
  if (due.getTime() === today.getTime()) return 'vence_hoje';
  return 'ok';
}

export function normalizePrioridade(prioridade: string | null | undefined): string {
  const raw = String(prioridade ?? 'Média').trim();
  const found = DASHBOARD_PRIORIDADE_KEYS.find((k) => k.toLowerCase() === raw.toLowerCase());
  return found ?? 'Média';
}

export function normalizeTipoAtividade(
  tipo: string | null | undefined,
): (typeof DASHBOARD_TIPO_KEYS)[number] {
  const t = String(tipo ?? '').trim().toLowerCase();
  if (t === 'chamado_padrao' || t === 'chamado_hdm' || t === 'atividade' || t === 'duvida') return t;
  if (t === 'chamado') return 'chamado_padrao';
  return 'atividade';
}

export function filterBreakdownByTab<T extends { comTrava: boolean; atrasado: boolean }>(
  rows: T[],
  tab: DashboardBreakdownTab,
): T[] {
  if (tab === 'com_trava') return rows.filter((r) => r.comTrava);
  if (tab === 'atrasados') return rows.filter((r) => r.atrasado);
  return rows;
}

export function aggregatePorStatusFromBreakdown(
  rows: DashboardChamadoBreakdownRow[],
): Array<{ status: string; count: number; pct: number }> {
  const counts = { nao_iniciado: 0, em_andamento: 0, concluido: 0 };
  for (const r of rows) {
    if (r.status === 'nao_iniciado') counts.nao_iniciado++;
    else if (r.status === 'em_andamento' || r.status === 'aguardando_aprovacao_criador') counts.em_andamento++;
    else if (r.status === 'concluido') counts.concluido++;
  }
  const total = rows.length;
  return (['nao_iniciado', 'em_andamento', 'concluido'] as const).map((status) => ({
    status,
    count: counts[status],
    pct: total > 0 ? (counts[status] / total) * 100 : 0,
  }));
}

export function aggregatePorTipoFromBreakdown(
  rows: DashboardAtividadeBreakdownRow[],
): Array<{ tipo: string; count: number; pct: number }> {
  const counts = Object.fromEntries(DASHBOARD_TIPO_KEYS.map((k) => [k, 0])) as Record<
    (typeof DASHBOARD_TIPO_KEYS)[number],
    number
  >;
  for (const r of rows) {
    const tipo = normalizeTipoAtividade(r.tipo);
    counts[tipo]++;
  }
  const total = rows.length;
  return DASHBOARD_TIPO_KEYS.map((tipo) => ({
    tipo,
    count: counts[tipo],
    pct: total > 0 ? (counts[tipo] / total) * 100 : 0,
  }));
}

export function aggregatePorPrioridadeAbertosFromBreakdown(
  rows: DashboardChamadoBreakdownRow[],
): Array<{ prioridade: string; count: number; pct: number }> {
  const abertos = rows.filter((r) => r.status !== 'concluido');
  const counts = Object.fromEntries(DASHBOARD_PRIORIDADE_KEYS.map((k) => [k, 0])) as Record<
    (typeof DASHBOARD_PRIORIDADE_KEYS)[number],
    number
  >;
  for (const r of abertos) {
    const p = normalizePrioridade(r.prioridade) as (typeof DASHBOARD_PRIORIDADE_KEYS)[number];
    counts[p]++;
  }
  const total = abertos.length;
  return DASHBOARD_PRIORIDADE_KEYS.map((prioridade) => ({
    prioridade,
    count: counts[prioridade],
    pct: total > 0 ? (counts[prioridade] / total) * 100 : 0,
  }));
}
