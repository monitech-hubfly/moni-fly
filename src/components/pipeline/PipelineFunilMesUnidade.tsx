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
    <div
      className={className}
      style={{
        borderTop: '0.5px solid var(--moni-border-default)',
        paddingTop: '0.75rem',
      }}
    >
      <div className="flex flex-wrap items-end justify-center gap-x-1 gap-y-3 sm:gap-x-2">
        {funil.metricas.map((metric, idx) => (
          <Fragment key={metric.key}>
            <div className="flex min-w-[64px] flex-col items-center text-center sm:min-w-[72px]">
              <p
                className="text-[10px] font-medium uppercase tracking-wide"
                style={{ color: 'var(--moni-text-tertiary)' }}
              >
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
              <div className="flex flex-col items-center gap-0.5 self-center px-0.5 pb-3">
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
