'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { PipelineCardDisplay, PipelineFranqueadoraEnrichment, PipelineFunilGrupoUnidade } from '@/lib/kanban/pipeline-cards-types';
import { formatDataEntradaFaseAtualKanbanCard } from '@/lib/kanban/pipeline-card-readonly';
import {
  badgeStatusPipelineCard,
  labelBadgeStatusPipeline,
  tagClassBadgeStatusPipeline,
} from '@/lib/kanban/pipeline-franqueadora-compute';
import { PipelineSequencialBar, pipelineBadgeInlineStyle } from '@/components/pipeline/PipelineSequencialBar';

const panelStyle: React.CSSProperties = {
  borderRadius: 'var(--moni-radius-lg)',
  border: '0.5px solid var(--moni-border-default)',
  background: 'var(--moni-surface-0)',
};

type Props = {
  grupo: PipelineFunilGrupoUnidade;
  enrichment?: PipelineFranqueadoraEnrichment | null;
  onCardClick: (card: PipelineCardDisplay) => void;
};

export function PipelineUnidadeFunilBloco({ grupo, enrichment, onCardClick }: Props) {
  const [expanded, setExpanded] = useState(grupo.defaultExpanded);

  return (
    <section style={panelStyle}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex min-h-[44px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[var(--moni-surface-50)]"
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-2">
          <h2
            className="text-[13px] font-semibold"
            style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-display)' }}
          >
            {grupo.kanbanNome}
          </h2>
          <span className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
            {grupo.cards.length} card{grupo.cards.length === 1 ? '' : 's'}
          </span>
        </div>
        <ChevronDown
          className="h-4 w-4 shrink-0 transition-transform"
          style={{
            color: 'var(--moni-text-tertiary)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {expanded ? (
        <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: 'var(--moni-border-default)' }}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-[11px]">
              <thead>
                <tr style={{ borderBottom: '0.5px solid var(--moni-border-subtle, var(--moni-border-default))' }}>
                  {['ID', 'Título', 'Fase', 'Status', 'Na fase desde', 'Esteira', ''].map((h) => (
                    <th
                      key={h || 'acao'}
                      className="pb-2 pr-3 font-semibold uppercase tracking-wide last:pr-0"
                      style={{ color: 'var(--moni-text-tertiary)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grupo.cards.map((card) => {
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
                      <td className="max-w-[10rem] truncate py-2.5 pr-3" style={{ color: 'var(--moni-text-primary)' }}>
                        {card.titulo}
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
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={customStyle}>
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
