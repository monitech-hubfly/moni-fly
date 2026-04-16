import { createClient } from '@/lib/supabase/server';
import { calcularStatusSLA } from '@/lib/dias-uteis';
import type { KanbanCardBrief, KanbanFase } from './types';

function isoUtcSinceDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export type PainelPerformanceProps = {
  /** Nome exibido (ex.: Funil Portfólio). */
  kanbanNome: string;
  kanbanId: string;
  fases: KanbanFase[];
  cards: KanbanCardBrief[];
  origemCards?: 'nativo' | 'legado';
};

/**
 * Painel de performance do funil: distribuição por fase, SLA, criados/concluídos (30d) e interações.
 */
export async function PainelPerformance({
  kanbanNome,
  kanbanId,
  fases,
  cards,
  origemCards = 'nativo',
}: PainelPerformanceProps) {
  const supabase = await createClient();
  const sinceIso = isoUtcSinceDays(30);
  const origem = origemCards === 'legado' ? 'legado' : 'nativo';

  const faseById = new Map(fases.map((f) => [f.id, f]));
  const orderedFases = [...fases].sort((a, b) => a.ordem - b.ordem);

  const totalPorFase = new Map<string, number>();
  const atrasadosPorFase = new Map<string, number>();
  for (const f of fases) {
    totalPorFase.set(f.id, 0);
    atrasadosPorFase.set(f.id, 0);
  }
  for (const c of cards) {
    const fid = c.fase_id;
    totalPorFase.set(fid, (totalPorFase.get(fid) ?? 0) + 1);
    const fase = faseById.get(fid);
    const slaDias = fase?.sla_dias ?? 999;
    const created = new Date(c.created_at);
    if (Number.isFinite(created.getTime()) && calcularStatusSLA(created, slaDias).status === 'atrasado') {
      atrasadosPorFase.set(fid, (atrasadosPorFase.get(fid) ?? 0) + 1);
    }
  }
  const maxPorFase = Math.max(1, ...orderedFases.map((f) => totalPorFase.get(f.id) ?? 0));

  let criados30 = 0;
  let concluidos30 = 0;
  if (origemCards === 'legado') {
    const { count: c1 } = await supabase
      .from('v_processo_como_kanban_cards')
      .select('id', { count: 'exact', head: true })
      .eq('kanban_id', kanbanId)
      .gte('criado_em', sinceIso);
    criados30 = c1 ?? 0;
    concluidos30 = 0;
  } else {
    const { count: c2 } = await supabase
      .from('kanban_cards')
      .select('id', { count: 'exact', head: true })
      .eq('kanban_id', kanbanId)
      .gte('created_at', sinceIso);
    criados30 = c2 ?? 0;
    const { count: c3 } = await supabase
      .from('kanban_cards')
      .select('id', { count: 'exact', head: true })
      .eq('kanban_id', kanbanId)
      .eq('status', 'arquivado')
      .gte('updated_at', sinceIso);
    concluidos30 = c3 ?? 0;
  }

  const cardIds = cards.map((c) => c.id).filter(Boolean);
  let interacoesAbertas = 0;
  let interacoesTrava = 0;
  for (const part of chunk(cardIds, 120)) {
    if (part.length === 0) continue;
    const { data: rows } = await supabase
      .from('kanban_atividades')
      .select('id, status, trava')
      .in('card_id', part)
      .eq('origem', origem);
    for (const r of rows ?? []) {
      const st = String((r as { status?: string }).status ?? '').toLowerCase();
      const aberta = st !== 'concluida' && st !== 'cancelada';
      if (aberta) interacoesAbertas += 1;
      if (aberta && (r as { trava?: boolean }).trava === true) interacoesTrava += 1;
    }
  }

  const statCard = (label: string, value: number | string, hint?: string) => (
    <div
      className="rounded-xl border bg-white p-5 shadow-sm"
      style={{ borderColor: 'var(--moni-border-default)' }}
    >
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tabular-nums" style={{ color: 'var(--moni-navy-800)' }}>
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          {hint}
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
          Painel — {kanbanNome}
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
          Visão rápida de volume por fase, SLA dos cards ativos, movimento recente e chamados vinculados.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCard('Criados (30 dias)', criados30)}
        {statCard(
          'Concluídos (30 dias)',
          origemCards === 'legado' ? '—' : concluidos30,
          origemCards === 'legado' ? 'Cards legados (processo): métrica de arquivamento não aplicável aqui.' : undefined,
        )}
        {statCard('Chamados em aberto', interacoesAbertas, 'Pendente ou em andamento, neste funil.')}
        {statCard('Chamados com trava', interacoesTrava, 'Somente em aberto, com trava ativa.')}
      </div>

      <div
        className="rounded-xl border bg-white p-6 shadow-sm"
        style={{ borderColor: 'var(--moni-border-default)' }}
      >
        <h3 className="text-sm font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
          Cards por fase
        </h3>
        <p className="mt-1 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
          Barras relativas ao maior volume entre as fases.
        </p>
        <ul className="mt-4 space-y-4">
          {orderedFases.map((f) => {
            const total = totalPorFase.get(f.id) ?? 0;
            const atrasados = atrasadosPorFase.get(f.id) ?? 0;
            const pct = Math.round((total / maxPorFase) * 100);
            return (
              <li key={f.id}>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
                    {f.nome}
                  </span>
                  <span className="tabular-nums text-stone-600">
                    {total}
                    {atrasados > 0 ? (
                      <span
                        className="ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          borderColor: 'var(--moni-status-overdue-border)',
                          color: 'var(--moni-status-overdue-text)',
                          background: 'var(--moni-status-overdue-bg)',
                        }}
                      >
                        SLA {atrasados}
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[var(--moni-surface-200)]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      minWidth: total > 0 ? '4px' : undefined,
                      background: 'var(--moni-navy-600)',
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
