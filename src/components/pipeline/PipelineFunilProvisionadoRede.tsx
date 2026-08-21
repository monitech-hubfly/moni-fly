'use client';

import { Fragment, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type {
  PipelineCardRow,
  PipelineEsteiraHistoricoPorCard,
  PipelineFranqueadoUnidade,
  PipelineFunilProvisionadoHorizonte,
} from '@/lib/kanban/pipeline-cards-types';
import { FUNIL_PROVISIONADO_HORIZONTES } from '@/lib/kanban/pipeline-cards-types';
import {
  computeFunilProvisionadoRede,
} from '@/lib/kanban/pipeline-funil-provisionado-compute';
import { formatFunilMesConversaoSeta } from '@/lib/kanban/pipeline-funil-mes-compute';
import { excluirFranquiaDosGraficosVisaoGeral } from '@/lib/rede-visibilidade-franqueado';
import { PipelineFunilColunaUnidadeTabela } from '@/components/pipeline/PipelineFunilColunaUnidadeTabela';
import {
  PipelineFunilRedeVisaoToggle,
  type PipelineFunilRedeVisao,
} from '@/components/pipeline/PipelineFunilRedeVisaoToggle';

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
  historico: PipelineEsteiraHistoricoPorCard;
  className?: string;
  funilRedeVisao?: PipelineFunilRedeVisao;
  onFunilRedeVisaoChange?: (v: PipelineFunilRedeVisao) => void;
};

function HorizonteToggle({
  horizonte,
  onChange,
}: {
  horizonte: PipelineFunilProvisionadoHorizonte;
  onChange: (h: PipelineFunilProvisionadoHorizonte) => void;
}) {
  return (
    <div
      className="flex max-w-full shrink-0 flex-wrap gap-0.5"
      style={toggleWrapStyle}
      role="group"
      aria-label="Horizonte em dias"
    >
      {FUNIL_PROVISIONADO_HORIZONTES.map((dias) => {
        const active = horizonte === dias;
        return (
          <button
            key={dias}
            type="button"
            onClick={() => onChange(dias)}
            className="min-h-[28px] rounded-md px-2 text-[10px] font-medium transition sm:px-2.5 sm:text-[11px]"
            style={{
              borderRadius: '6px',
              background: active ? 'var(--moni-surface-0)' : 'transparent',
              color: active ? 'var(--moni-navy-800)' : 'var(--moni-text-tertiary)',
              boxShadow: active ? 'var(--moni-shadow-card, 0 1px 2px rgba(12,38,51,0.08))' : undefined,
            }}
          >
            {dias}d
          </button>
        );
      })}
    </div>
  );
}

export function PipelineFunilProvisionadoRede({
  cards,
  franqueados,
  historico,
  className,
  funilRedeVisao,
  onFunilRedeVisaoChange,
}: Props) {
  const [horizonte, setHorizonte] = useState<PipelineFunilProvisionadoHorizonte>(30);

  const franqueadosElegiveis = useMemo(
    () => franqueados.filter((f) => !excluirFranquiaDosGraficosVisaoGeral(f.n_franquia)),
    [franqueados],
  );

  const funil = useMemo(
    () => computeFunilProvisionadoRede(cards, franqueadosElegiveis, historico, horizonte),
    [cards, franqueadosElegiveis, historico, horizonte],
  );

  if (!funil.disponivel) return null;

  const temZerosGlobal = funil.colunas.some((c) => c.porUnidadeZeradas.length > 0);

  return (
    <section className={`mb-6 px-4 py-4 ${className ?? ''}`} style={panelStyle}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2
          className="text-[13px] font-semibold"
          style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-navy-800)' }}
        >
          Funil provisionado — rede
        </h2>
        <div className="moni-pipeline-funil-header-controls">
          {funilRedeVisao != null && onFunilRedeVisaoChange ? (
            <>
              <PipelineFunilRedeVisaoToggle value={funilRedeVisao} onChange={onFunilRedeVisaoChange} />
              <span className="moni-pipeline-funil-header-sep" aria-hidden />
            </>
          ) : null}
          <HorizonteToggle horizonte={horizonte} onChange={setHorizonte} />
        </div>
      </div>
      <p className="mb-4 text-[10px] leading-snug" style={{ color: 'var(--moni-text-tertiary)' }}>
        Marcos ainda não fechados com data provisionada nos próximos {horizonte} dias (esteira + previsões).
      </p>

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
                {col.total}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                {idx === 0 ? 'provisionado' : 'provisionado'}
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

              <PipelineFunilColunaUnidadeTabela
                porUnidade={col.porUnidade}
                porUnidadeZeradas={col.porUnidadeZeradas}
                temZerosGlobal={temZerosGlobal}
              />
            </div>

            {idx < funil.colunas.length - 1 ? (
              <div className="flex w-9 shrink-0 flex-col items-center justify-start gap-1 self-start pt-8 lg:w-8">
                <ArrowRight className="h-3.5 w-3.5" style={{ color: 'var(--moni-text-tertiary)' }} aria-hidden />
                <span
                  className="whitespace-nowrap text-center text-[9px] tabular-nums leading-none"
                  style={{ color: 'var(--moni-text-secondary)' }}
                  title="Conversão entre marcos provisionados"
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
