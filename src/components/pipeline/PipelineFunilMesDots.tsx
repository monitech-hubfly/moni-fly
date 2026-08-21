'use client';

import type { PipelineFunilMesDotNivel, PipelineFunilMesUnidadeMetric } from '@/lib/kanban/pipeline-cards-types';
import { quantidadeParaDots } from '@/lib/kanban/pipeline-funil-mes-compute';

const DOT_COR: Record<PipelineFunilMesUnidadeMetric['dotCor'], string> = {
  verde: 'var(--moni-kanban-portfolio)',
  vermelho: 'var(--moni-status-overdue-text)',
  cinza: 'var(--moni-text-tertiary)',
};

type Props = {
  quantidade: number;
  dotCor?: PipelineFunilMesUnidadeMetric['dotCor'];
  className?: string;
};

export function PipelineFunilMesDots({ quantidade, dotCor, className }: Props) {
  const { filled, showPlus } = quantidadeParaDots(quantidade);
  const cor = dotCor ? DOT_COR[dotCor] : 'var(--moni-navy-800)';

  return (
    <span className={`inline-flex items-center gap-0.5 ${className ?? ''}`} aria-label={`${quantidade} no mês`}>
      {Array.from({ length: 5 }, (_, i) => {
        const active = i < filled;
        return (
          <span
            key={i}
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{
              background: active ? cor : 'transparent',
              border: active ? 'none' : '0.5px solid var(--moni-border-default)',
              opacity: active ? 1 : 0.45,
            }}
            aria-hidden
          />
        );
      })}
      {showPlus ? (
        <span className="ml-0.5 text-[9px] font-semibold tabular-nums" style={{ color: cor }}>
          +
        </span>
      ) : null}
    </span>
  );
}

export function PipelineFunilMesDotsFromNivel({
  nivel,
  dotCor,
  className,
}: {
  nivel: PipelineFunilMesDotNivel;
  dotCor?: PipelineFunilMesUnidadeMetric['dotCor'];
  className?: string;
}) {
  const showPlus = nivel >= 5;
  const filled = nivel;
  const cor = dotCor ? DOT_COR[dotCor] : 'var(--moni-navy-800)';

  return (
    <span className={`inline-flex items-center gap-0.5 ${className ?? ''}`}>
      {Array.from({ length: 5 }, (_, i) => {
        const active = i < filled;
        return (
          <span
            key={i}
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{
              background: active ? cor : 'transparent',
              border: active ? 'none' : '0.5px solid var(--moni-border-default)',
              opacity: active ? 1 : 0.45,
            }}
            aria-hidden
          />
        );
      })}
      {showPlus ? (
        <span className="ml-0.5 text-[9px] font-semibold tabular-nums" style={{ color: cor }}>
          +
        </span>
      ) : null}
    </span>
  );
}
