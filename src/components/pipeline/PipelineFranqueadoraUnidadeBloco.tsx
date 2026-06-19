'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { PipelineCardDisplay, PipelineFranqueadoraEnrichment, PipelineUnidadeBlocoMeta } from '@/lib/kanban/pipeline-cards-types';
import { formatDataEntradaFaseAtualKanbanCard } from '@/lib/kanban/pipeline-card-readonly';
import {
  badgeStatusPipelineCard,
  labelBadgeStatusPipeline,
  tagClassBadgeStatusPipeline,
} from '@/lib/kanban/pipeline-franqueadora-compute';
import { PipelineSequencialBar, pipelineBadgeInlineStyle } from '@/components/pipeline/PipelineSequencialBar';

import { metaAtingidaSaude } from '@/lib/kanban/pipeline-unidade-compute';

const panelStyle: React.CSSProperties = {
  borderRadius: 'var(--moni-radius-lg)',
  border: '0.5px solid var(--moni-border-default)',
  background: 'var(--moni-surface-0)',
};

type Props = {
  meta: PipelineUnidadeBlocoMeta;
  cards: PipelineCardDisplay[];
  enrichment?: PipelineFranqueadoraEnrichment | null;
  onCardClick: (card: PipelineCardDisplay) => void;
};

function SaudeMesBar({
  entradas,
  meta,
  label,
  atingida,
}: {
  entradas: number;
  meta: number;
  label: string;
  atingida: boolean;
}) {
  const pct = meta <= 0 ? 0 : Math.min(100, Math.round((entradas / meta) * 100));
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
        <span>{label}</span>
        <div className="flex items-center gap-2">
          <span className="tabular-nums">
            {entradas}/{meta}
          </span>
          {atingida ? (
            <span className="moni-tag-concluido text-[10px]">meta atingida</span>
          ) : (
            <span className="moni-tag-atencao text-[10px]">abaixo da meta</span>
          )}
        </div>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--moni-rede-chart-track)' }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: atingida ? 'var(--moni-kanban-portfolio)' : 'var(--moni-gold-400)',
          }}
        />
      </div>
    </div>
  );
}

export function PipelineFranqueadoraUnidadeBloco({ meta, cards, enrichment, onCardClick }: Props) {
  const [expanded, setExpanded] = useState(meta.defaultExpanded);
  const { alertas, saude } = meta;
  const metas = metaAtingidaSaude(saude);

  return (
    <section style={panelStyle}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex min-h-[44px] w-full flex-col gap-2 px-4 py-3 text-left transition hover:bg-[var(--moni-surface-50)] sm:flex-row sm:items-center sm:justify-between"
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              className="text-[13px] font-semibold"
              style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-display)' }}
            >
              {meta.label}
            </h2>
            <span className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
              {cards.length} card{cards.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {alertas.atrasados > 0 ? (
              <span className="moni-tag-atrasado text-[10px]">{alertas.atrasados} atrasado(s)</span>
            ) : null}
            {alertas.parados > 0 ? (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{
                  background: 'var(--moni-earth-50)',
                  color: 'var(--moni-earth-800)',
                  border: '0.5px solid var(--moni-earth-400)',
                }}
              >
                {alertas.parados} parado(s)
              </span>
            ) : null}
            {alertas.chamadosTrava > 0 ? (
              <span className="moni-tag-atencao text-[10px]">{alertas.chamadosTrava} trava(s)</span>
            ) : null}
            {alertas.nivel === 'ok' ? (
              <span className="moni-tag-concluido text-[10px]">Em dia</span>
            ) : null}
          </div>
        </div>
        <ChevronDown
          className="h-4 w-4 shrink-0 self-end sm:self-center"
          style={{
            color: 'var(--moni-text-tertiary)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {expanded ? (
        <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: 'var(--moni-border-default)' }}>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <SaudeMesBar
              entradas={saude.entradasMes}
              meta={saude.metaEntradas}
              label="Entradas no mês"
              atingida={metas.entradas}
            />
            <SaudeMesBar
              entradas={saude.contratosMes}
              meta={saude.metaContratos}
              label="Contratos no mês"
              atingida={metas.contratos}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[11px]">
              <thead>
                <tr style={{ borderBottom: '0.5px solid var(--moni-border-subtle, var(--moni-border-default))' }}>
                  {['ID', 'Funil', 'Fase atual', 'Status', 'Na fase desde', 'Esteira', ''].map((h) => (
                    <th
                      key={h}
                      className="pb-2 pr-3 font-semibold uppercase tracking-wide last:pr-0"
                      style={{ color: 'var(--moni-text-tertiary)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cards.map((card) => {
                  const badge = badgeStatusPipelineCard(card);
                  const tagClass = tagClassBadgeStatusPipeline(badge);
                  const customStyle = pipelineBadgeInlineStyle(badge);
                  return (
                    <tr
                      key={card.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onCardClick(card)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onCardClick(card);
                        }
                      }}
                      className="cursor-pointer transition hover:bg-[var(--moni-surface-50)]"
                      style={{ borderBottom: '0.5px solid var(--moni-border-subtle, var(--moni-border-default))' }}
                    >
                      <td className="max-w-[8rem] truncate py-2.5 pr-3 font-mono text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                        {card.id.slice(0, 8)}…
                      </td>
                      <td className="py-2.5 pr-3" style={{ color: 'var(--moni-text-primary)' }}>
                        {card.kanban_nome}
                      </td>
                      <td className="py-2.5 pr-3" style={{ color: 'var(--moni-text-secondary)' }}>
                        {card.fase_nome}
                      </td>
                      <td className="py-2.5 pr-3">
                        {tagClass ? (
                          <span className={`text-[10px] ${tagClass}`} style={customStyle}>
                            {labelBadgeStatusPipeline(badge)}
                          </span>
                        ) : (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={customStyle}
                          >
                            {labelBadgeStatusPipeline(badge)}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums" style={{ color: 'var(--moni-text-secondary)' }}>
                        {formatDataEntradaFaseAtualKanbanCard(card) ?? '—'}
                      </td>
                      <td className="min-w-[12rem] py-2.5 pr-3">
                        <PipelineSequencialBar card={card} enrichment={enrichment} />
                      </td>
                      <td className="py-2.5 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                        Detalhe →
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
