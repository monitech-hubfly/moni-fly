'use client';

import { Fragment } from 'react';
import type { PipelineFunilMesCompact } from '@/lib/kanban/pipeline-cards-types';
import { dotCorUnidadeMetric } from '@/lib/kanban/pipeline-funil-mes-compute';

const FUNIL_META_BARRA = 5;

type Props = {
  funil: PipelineFunilMesCompact;
  className?: string;
};

const ITENS: { key: string; valor: (f: PipelineFunilMesCompact) => number }[] = [
  { key: 'H', valor: (f) => f.hipoteses },
  { key: 'O', valor: (f) => f.opcoes },
  { key: 'C', valor: (f) => f.comites },
  { key: 'CT', valor: (f) => f.contratos },
];

function corValorFunil(qtd: number): string {
  const cor = dotCorUnidadeMetric(qtd);
  if (cor === 'verde') return 'var(--moni-kanban-portfolio)';
  if (cor === 'vermelho') return 'var(--moni-status-overdue-text)';
  return 'var(--moni-text-tertiary)';
}

function corBarraFunil(qtd: number): string {
  const cor = dotCorUnidadeMetric(qtd);
  if (cor === 'verde') return 'var(--moni-kanban-portfolio)';
  if (cor === 'vermelho') return 'var(--moni-status-overdue-text)';
  return 'var(--moni-gold-400)';
}

function FunilMiniBar({ valor }: { valor: number }) {
  const pct =
    valor <= 0 ? 0 : Math.min(100, Math.round((Math.min(valor, FUNIL_META_BARRA) / FUNIL_META_BARRA) * 100));

  return (
    <div
      className="h-1.5 min-w-[3rem] flex-1 overflow-hidden rounded-full"
      style={{ background: 'var(--moni-rede-chart-track)', maxHeight: '6px', height: '6px' }}
      title={`${valor} no mês`}
    >
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${pct}%`,
          background: corBarraFunil(valor),
          opacity: valor > 0 ? 0.92 : 0.45,
        }}
      />
    </div>
  );
}

/** Funil do mês condensado — H · O · C · CT com 4 barrinhas (substitui Entradas/Contratos na unidade). */
export function PipelineFunilMesCondensado({ funil, className }: Props) {
  const items = ITENS.map((item) => ({ key: item.key, value: item.valor(funil) }));

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-x-1 text-[11px]">
        {items.map((item, idx) => (
          <Fragment key={item.key}>
            {idx > 0 ? (
              <span className="select-none" style={{ color: 'var(--moni-text-tertiary)' }}>
                {' '}
                ·{' '}
              </span>
            ) : null}
            <span className="tabular-nums">
              <span className="font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
                {item.key}:
              </span>
              <span className="ml-0.5 font-semibold" style={{ color: corValorFunil(item.value) }}>
                {item.value}
              </span>
            </span>
          </Fragment>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">
        {items.map((item) => (
          <FunilMiniBar key={item.key} valor={item.value} />
        ))}
      </div>
    </div>
  );
}
