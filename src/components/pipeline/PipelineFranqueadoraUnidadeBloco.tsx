'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { PipelineCardDisplay, PipelineFranqueadoraEnrichment, PipelineUnidadeBlocoMeta } from '@/lib/kanban/pipeline-cards-types';
import {
  faseSlaExcedido,
  formatRelativeNaFaseDesde,
  tituloPipelineCardDisplay,
} from '@/lib/kanban/pipeline-card-readonly';
import {
  badgeStatusPipelineCard,
  emojiIndicadorSaudePipeline,
  indicadorSaudeUnidadePipeline,
  labelBadgeStatusPipeline,
  tagClassBadgeStatusPipeline,
} from '@/lib/kanban/pipeline-franqueadora-compute';
import { PipelineSequencialBar, pipelineBadgeInlineStyle } from '@/components/pipeline/PipelineSequencialBar';
import { PipelineSaudeMesCondensado } from '@/components/pipeline/PipelineSaudeMesCondensado';
import { PipelineFunilMesInline } from '@/components/pipeline/PipelineFunilMesInline';

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

export function PipelineFranqueadoraUnidadeBloco({ meta, cards, enrichment, onCardClick }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { alertas, saude, funilMes } = meta;
  const saudeIndicador = indicadorSaudeUnidadePipeline(alertas, saude);

  return (
    <section style={panelStyle}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex min-h-[44px] w-full items-center gap-2 px-4 py-3 text-left transition hover:bg-[var(--moni-surface-50)]"
        aria-expanded={expanded}
      >
        <span className="shrink-0 text-[13px] leading-none" aria-hidden>
          {emojiIndicadorSaudePipeline(saudeIndicador)}
        </span>
        <span className="sr-only">Saúde: {saudeIndicador}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2
              className="text-[13px] font-semibold"
              style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-display)' }}
            >
              {meta.label}
            </h2>
            <span className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
              {cards.length} card{cards.length === 1 ? '' : 's'}
            </span>
            {alertas.atrasados > 0 ? (
              <span className="moni-tag-atrasado text-[10px]">{alertas.atrasados} atrasado(s)</span>
            ) : null}
            {alertas.chamadosTrava > 0 ? (
              <span className="moni-tag-atencao text-[10px]">{alertas.chamadosTrava} trava(s)</span>
            ) : null}
            {alertas.venceEm2Dias > 0 ? (
              <span className="moni-tag-atencao text-[10px]">{alertas.venceEm2Dias} vence em 2d</span>
            ) : null}
            <PipelineFunilMesInline funil={funilMes} />
          </div>
        </div>
        <ChevronDown
          className="h-4 w-4 shrink-0"
          style={{
            color: 'var(--moni-text-tertiary)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {expanded ? (
        <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: 'var(--moni-border-default)' }}>
          <PipelineSaudeMesCondensado saude={saude} className="mb-4" />

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[11px]">
              <thead>
                <tr style={{ borderBottom: '0.5px solid var(--moni-border-subtle, var(--moni-border-default))' }}>
                  {['Título', 'Fase atual', 'Status', 'Tempo na fase', 'Esteira', ''].map((h) => (
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
                {cards.map((card, idx) => {
                  const badge = badgeStatusPipelineCard(card);
                  const tagClass = tagClassBadgeStatusPipeline(badge);
                  const customStyle = pipelineBadgeInlineStyle(badge);
                  const relativo = formatRelativeNaFaseDesde(card);
                  const slaExcedido = faseSlaExcedido(card);
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
                      <td
                        className="max-w-[14rem] truncate py-2.5 pr-3 font-medium"
                        style={{ color: 'var(--moni-text-primary)' }}
                        title={String(card.titulo ?? '').trim() || undefined}
                      >
                        {tituloPipelineCardDisplay(card, idx + 1)}
                      </td>
                      <td className="max-w-[10rem] truncate py-2.5 pr-3" style={{ color: 'var(--moni-text-secondary)' }}>
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
                      <td
                        className="py-2.5 pr-3 tabular-nums"
                        style={{ color: slaExcedido ? 'var(--moni-status-overdue-text)' : 'var(--moni-text-secondary)' }}
                      >
                        {relativo}
                      </td>
                      <td className="min-w-[12rem] py-2.5 pr-3">
                        <PipelineSequencialBar card={card} enrichment={enrichment} siblingCards={cards} />
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
