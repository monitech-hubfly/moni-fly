'use client';

import { Fragment } from 'react';
import { ArrowRight } from 'lucide-react';
import type { PipelineFunilMesUnidade as PipelineFunilMesUnidadeData } from '@/lib/kanban/pipeline-cards-types';
import { formatFunilMesConversaoSeta } from '@/lib/kanban/pipeline-funil-mes-compute';
import { PipelineFunilMesDotsFromNivel } from '@/components/pipeline/PipelineFunilMesDots';

type Props = {
  funil: PipelineFunilMesUnidadeData;
  className?: string;
};

export function PipelineFunilMesUnidade({ funil, className }: Props) {
  if (!funil.disponivel) return null;

  return (
    <div className={className}>
      <p
        className="mb-2 text-[11px] font-medium uppercase tracking-wide"
        style={{ color: 'var(--moni-text-tertiary)' }}
      >
        Funil do mês
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {funil.metricas.map((metric, idx) => (
          <Fragment key={metric.key}>
            <div
              className="flex min-w-[72px] flex-col items-center px-2 py-2 text-center sm:min-w-[80px]"
              style={{
                borderRadius: 'var(--moni-radius-md)',
                border: '0.5px solid var(--moni-border-default)',
                background: 'var(--moni-surface-50)',
              }}
            >
              <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
                {metric.label}
              </p>
              <p
                className="mt-0.5 text-lg font-semibold tabular-nums"
                style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-navy-800)' }}
              >
                {metric.total}
              </p>
              <PipelineFunilMesDotsFromNivel nivel={metric.dots} dotCor={metric.dotCor} className="mt-1" />
            </div>
            {idx < funil.metricas.length - 1 ? (
              <div className="flex flex-col items-center gap-0.5 px-0.5">
                <ArrowRight className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--moni-text-tertiary)' }} aria-hidden />
                <span className="whitespace-nowrap text-[9px] tabular-nums" style={{ color: 'var(--moni-text-secondary)' }}>
                  {formatFunilMesConversaoSeta(funil.conversoes[idx] ?? null)}
                </span>
              </div>
            ) : null}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
