'use client';

import { Fragment } from 'react';
import { ArrowRight } from 'lucide-react';
import type { PipelineFunilMesRede as PipelineFunilMesRedeData } from '@/lib/kanban/pipeline-cards-types';
import { formatFunilMesPct } from '@/lib/kanban/pipeline-funil-mes-compute';
import { PipelineFunilMesDotsFromNivel } from '@/components/pipeline/PipelineFunilMesDots';

const panelStyle: React.CSSProperties = {
  borderRadius: 'var(--moni-radius-lg)',
  border: '0.5px solid var(--moni-border-default)',
  background: 'var(--moni-surface-0)',
};

type Props = {
  funil: PipelineFunilMesRedeData;
  className?: string;
};

export function PipelineFunilMesRede({ funil, className }: Props) {
  if (!funil.disponivel) return null;

  return (
    <section className={`mb-6 px-4 py-4 ${className ?? ''}`} style={panelStyle}>
      <h2
        className="mb-4 text-[13px] font-semibold"
        style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-navy-800)' }}
      >
        Funil do mês — rede
      </h2>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        {funil.colunas.map((col, idx) => (
          <Fragment key={col.key}>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
                  {col.label}
                </p>
                <p
                  className="text-2xl font-semibold tabular-nums tracking-tight"
                  style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-navy-800)' }}
                >
                  {col.total}
                </p>
              </div>

              <div
                className="mt-2 flex h-2 overflow-hidden rounded-full"
                style={{ background: 'var(--moni-rede-chart-track, var(--moni-surface-200))' }}
                role="img"
                aria-label={`Distribuição por unidade — ${col.label}`}
              >
                {col.barSegments.length === 0 ? null : (
                  col.barSegments.map((seg) => (
                    <div
                      key={seg.redeId}
                      className="h-full min-w-[2px] transition-all"
                      style={{ width: `${seg.pct}%`, background: seg.cor }}
                      title={`${seg.label}: ${seg.quantidade}`}
                    />
                  ))
                )}
              </div>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[160px] text-left text-[10px]">
                  <thead>
                    <tr style={{ borderBottom: '0.5px solid var(--moni-border-subtle, var(--moni-border-default))' }}>
                      <th className="pb-1.5 pr-2 font-semibold uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
                        Unidade
                      </th>
                      <th className="pb-1.5 pr-2 text-right font-semibold uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
                        Qtd
                      </th>
                      <th className="pb-1.5 font-semibold uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
                        ·
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {col.porUnidade.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-2" style={{ color: 'var(--moni-text-tertiary)' }}>
                          —
                        </td>
                      </tr>
                    ) : (
                      col.porUnidade.map((row) => (
                        <tr
                          key={row.redeId}
                          style={{ borderBottom: '0.5px solid var(--moni-border-subtle, var(--moni-border-default))' }}
                        >
                          <td className="max-w-[8rem] truncate py-1.5 pr-2" style={{ color: 'var(--moni-text-secondary)' }} title={row.label}>
                            {row.label}
                          </td>
                          <td className="py-1.5 pr-2 text-right tabular-nums font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                            {row.quantidade}
                          </td>
                          <td className="py-1.5">
                            <PipelineFunilMesDotsFromNivel nivel={row.dots} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {idx < funil.colunas.length - 1 ? (
              <div className="flex shrink-0 flex-col items-center justify-center gap-0.5 px-1 lg:px-0">
                <ArrowRight className="h-4 w-4" style={{ color: 'var(--moni-text-tertiary)' }} aria-hidden />
                <span className="text-[10px] tabular-nums" style={{ color: 'var(--moni-text-secondary)' }}>
                  {formatFunilMesPct(funil.conversoes[idx] ?? null)}
                </span>
              </div>
            ) : null}
          </Fragment>
        ))}
      </div>
    </section>
  );
}
