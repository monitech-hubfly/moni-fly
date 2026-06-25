'use client';

import type { PipelineFunilMesCompact } from '@/lib/kanban/pipeline-cards-types';
import { dotCorUnidadeMetric } from '@/lib/kanban/pipeline-funil-mes-compute';

const FUNIL_META_BARRA = 5;

type Props = {
  funil: PipelineFunilMesCompact;
  className?: string;
};

type MetricKey = 'H' | 'O' | 'C' | 'CT';

const METRIC_IDENTITY: Record<
  MetricKey,
  { pillBg: string; pillText: string; bar: string; border: string }
> = {
  H: {
    pillBg: 'var(--moni-gold-50)',
    pillText: 'var(--moni-gold-800)',
    bar: 'var(--moni-gold-400)',
    border: 'color-mix(in srgb, var(--moni-gold-400) 35%, transparent)',
  },
  O: {
    pillBg: 'var(--moni-kanban-portfolio-light)',
    pillText: 'var(--moni-kanban-portfolio)',
    bar: 'var(--moni-kanban-portfolio)',
    border: 'color-mix(in srgb, var(--moni-kanban-portfolio) 35%, transparent)',
  },
  C: {
    pillBg: 'var(--moni-kanban-contab-light)',
    pillText: 'var(--moni-navy-800)',
    bar: 'var(--moni-navy-800)',
    border: 'color-mix(in srgb, var(--moni-navy-800) 35%, transparent)',
  },
  CT: {
    pillBg: 'var(--moni-kanban-credito-light)',
    pillText: 'var(--moni-kanban-credito)',
    bar: 'var(--moni-kanban-credito-accent)',
    border: 'color-mix(in srgb, var(--moni-kanban-credito-accent) 35%, transparent)',
  },
};

const ITENS: { key: MetricKey; valor: (f: PipelineFunilMesCompact) => number }[] = [
  { key: 'H', valor: (f) => f.hipoteses },
  { key: 'O', valor: (f) => f.opcoes },
  { key: 'C', valor: (f) => f.comites },
  { key: 'CT', valor: (f) => f.contratos },
];

function corValorStatus(qtd: number): string {
  const cor = dotCorUnidadeMetric(qtd);
  if (cor === 'verde') return 'var(--moni-kanban-portfolio)';
  if (cor === 'vermelho') return 'var(--moni-status-overdue-text)';
  return 'inherit';
}

function FunilMiniBar({ valor, barColor }: { valor: number; barColor: string }) {
  const pct =
    valor <= 0 ? 0 : Math.min(100, Math.round((Math.min(valor, FUNIL_META_BARRA) / FUNIL_META_BARRA) * 100));

  return (
    <div
      className="h-1 w-full overflow-hidden rounded-full"
      style={{ background: 'var(--moni-rede-chart-track)', maxHeight: '4px', height: '4px' }}
      title={`${valor} no mês`}
    >
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${pct}%`,
          background: barColor,
          opacity: valor > 0 ? 0.92 : 0.45,
        }}
      />
    </div>
  );
}

/** Funil do mês condensado — H · O · C · CT com 4 barrinhas alinhadas por coluna. */
export function PipelineFunilMesCondensado({ funil, className }: Props) {
  const items = ITENS.map((item) => ({ key: item.key, value: item.valor(funil) }));

  return (
    <div className={className}>
      <div className="grid w-full grid-cols-4 gap-1.5">
        {items.map((item) => {
          const identity = METRIC_IDENTITY[item.key];
          const statusColor = corValorStatus(item.value);

          return (
            <div key={item.key} className="flex min-w-0 flex-col items-center gap-0.5">
              <span
                className="inline-flex items-center gap-px rounded-full px-1 py-px text-[9px] font-medium leading-none tabular-nums"
                style={{
                  background: identity.pillBg,
                  color: identity.pillText,
                  border: `var(--moni-border-width) solid ${identity.border}`,
                  borderRadius: 'var(--moni-radius-md)',
                }}
              >
                <span>{item.key}:</span>
                <span className="font-semibold" style={{ color: statusColor }}>
                  {item.value}
                </span>
              </span>
              <div className="w-full px-px">
                <FunilMiniBar valor={item.value} barColor={identity.bar} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
