'use client';

import { Fragment, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type {
  PipelineCardRow,
  PipelineFranqueadoUnidade,
  PipelineFunilMesColuna,
  PipelineFunilPeriodo,
} from '@/lib/kanban/pipeline-cards-types';
import {
  computeFunilMesRede,
  formatFunilMesConversaoSeta,
} from '@/lib/kanban/pipeline-funil-mes-compute';
import { excluirFranquiaDosGraficosVisaoGeral } from '@/lib/rede-visibilidade-franqueado';

const panelStyle: React.CSSProperties = {
  borderRadius: 'var(--moni-radius-lg)',
  border: '0.5px solid var(--moni-border-default)',
  background: 'var(--moni-surface-0)',
};

const toggleWrapStyle: React.CSSProperties = {
  borderRadius: 'var(--moni-radius-md)',
  border: '0.5px solid var(--moni-border-default)',
  background: 'var(--moni-surface-100)',
  padding: '2px',
};

type Props = {
  cards: PipelineCardRow[];
  franqueados: PipelineFranqueadoUnidade[];
  className?: string;
};

function ColunaUnidadeTabela({
  col,
  temZerosGlobal,
}: {
  col: PipelineFunilMesColuna;
  temZerosGlobal: boolean;
}) {
  const [showZeros, setShowZeros] = useState(false);
  const temZeros = col.porUnidadeZeradas.length > 0;
  const rows = showZeros ? [...col.porUnidade, ...col.porUnidadeZeradas] : col.porUnidade;

  return (
    <div className="mt-3 flex min-h-0 flex-1 flex-col">
      <table className="w-full text-left text-[10px]">
        <thead>
          <tr style={{ borderBottom: '0.5px solid var(--moni-border-subtle, var(--moni-border-default))' }}>
            <th className="pb-1.5 pr-1 font-semibold uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
              FK
            </th>
            <th className="pb-1.5 text-right font-semibold uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
              Qtd
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={2} className="py-2" style={{ color: 'var(--moni-text-tertiary)' }}>
                —
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.redeId}
                style={{ borderBottom: '0.5px solid var(--moni-border-subtle, var(--moni-border-default))' }}
              >
                <td
                  className="py-1 pr-1 tabular-nums"
                  style={{ color: row.quantidade > 0 ? 'var(--moni-text-secondary)' : 'var(--moni-text-tertiary)' }}
                >
                  {row.label}
                </td>
                <td
                  className="py-1 text-right tabular-nums font-medium"
                  style={{ color: row.quantidade > 0 ? 'var(--moni-text-primary)' : 'var(--moni-text-tertiary)' }}
                >
                  {row.quantidade}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div className="mt-auto pt-1.5">
        {temZeros ? (
          <button
            type="button"
            onClick={() => setShowZeros((v) => !v)}
            className="min-h-[28px] w-full text-left text-[10px] font-medium underline-offset-2 hover:underline"
            style={{ color: 'var(--moni-navy-800)' }}
          >
            {showZeros ? 'Ocultar zeradas' : 'Ver todas'}
          </button>
        ) : temZerosGlobal ? (
          <span className="block min-h-[28px]" aria-hidden />
        ) : null}
      </div>
    </div>
  );
}

function PeriodoToggle({
  periodo,
  onChange,
}: {
  periodo: PipelineFunilPeriodo;
  onChange: (p: PipelineFunilPeriodo) => void;
}) {
  const btn = (id: PipelineFunilPeriodo, label: string) => {
    const active = periodo === id;
    return (
      <button
        type="button"
        onClick={() => onChange(id)}
        className="min-h-[28px] rounded-md px-2.5 text-[11px] font-medium transition"
        style={{
          borderRadius: '6px',
          background: active ? 'var(--moni-surface-0)' : 'transparent',
          color: active ? 'var(--moni-navy-800)' : 'var(--moni-text-tertiary)',
          boxShadow: active ? 'var(--moni-shadow-card, 0 1px 2px rgba(12,38,51,0.08))' : undefined,
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex shrink-0 gap-0.5" style={toggleWrapStyle} role="group" aria-label="Período do funil">
      {btn('mes', 'Mês')}
      {btn('tri', 'Tri')}
    </div>
  );
}

export function PipelineFunilMesRede({ cards, franqueados, className }: Props) {
  const [periodo, setPeriodo] = useState<PipelineFunilPeriodo>('mes');

  const franqueadosElegiveis = useMemo(
    () => franqueados.filter((f) => !excluirFranquiaDosGraficosVisaoGeral(f.n_franquia)),
    [franqueados],
  );

  const funil = useMemo(
    () => computeFunilMesRede(cards, franqueadosElegiveis, periodo),
    [cards, franqueadosElegiveis, periodo],
  );

  if (!funil.disponivel) return null;

  const temZerosGlobal = funil.colunas.some((c) => c.porUnidadeZeradas.length > 0);
  const tituloPeriodo = periodo === 'mes' ? 'Funil do mês — rede' : 'Funil do tri — rede';

  return (
    <section className={`mb-6 px-4 py-4 ${className ?? ''}`} style={panelStyle}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2
          className="text-[13px] font-semibold"
          style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-navy-800)' }}
        >
          {tituloPeriodo}
        </h2>
        <PeriodoToggle periodo={periodo} onChange={setPeriodo} />
      </div>

      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-1">
        {funil.colunas.map((col, idx) => (
          <Fragment key={col.key}>
            <div className="flex min-w-0 flex-1 flex-col">
              <p
                className="text-[10px] font-medium uppercase leading-tight tracking-wide"
                style={{ color: 'var(--moni-text-tertiary)' }}
              >
                {col.label}
              </p>
              <p
                className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight"
                style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-navy-800)' }}
              >
                {col.totalIndisponivel ? '—' : col.total}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                {idx === 0 ? 'total rede' : 'total'}
              </p>

              <div
                className="mt-2 flex h-1.5 overflow-hidden rounded-full"
                style={{ background: 'var(--moni-rede-chart-track, var(--moni-surface-200))' }}
                role="img"
                aria-hidden
              >
                {col.barSegments.map((seg) => (
                  <div
                    key={seg.redeId}
                    className="h-full min-w-[2px]"
                    style={{ width: `${seg.pct}%`, background: seg.cor }}
                    title={`${seg.label}: ${seg.quantidade}`}
                  />
                ))}
              </div>

              <ColunaUnidadeTabela col={col} temZerosGlobal={temZerosGlobal} />
            </div>

            {idx < funil.colunas.length - 1 ? (
              <div className="flex w-9 shrink-0 flex-col items-center justify-start gap-1 self-start pt-8 lg:w-8">
                <ArrowRight className="h-3.5 w-3.5" style={{ color: 'var(--moni-text-tertiary)' }} aria-hidden />
                <span
                  className="whitespace-nowrap text-center text-[9px] tabular-nums leading-none"
                  style={{ color: 'var(--moni-text-secondary)' }}
                >
                  {formatFunilMesConversaoSeta(funil.conversoes[idx] ?? null)}
                </span>
              </div>
            ) : null}
          </Fragment>
        ))}
      </div>
    </section>
  );
}
