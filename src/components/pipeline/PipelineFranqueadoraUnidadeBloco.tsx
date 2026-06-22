'use client';

import { useMemo, useState } from 'react';
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
import {
  PipelineEsteiraPrincipalComSubesteiras,
  pipelineBadgeInlineStyle,
} from '@/components/pipeline/PipelineSequencialBar';
import { PipelineFunilMesCondensado } from '@/components/pipeline/PipelineFunilMesCondensado';
import { agruparCardsUnidadePorProjeto } from '@/lib/kanban/pipeline-unidade-visualizacao';
import { isFunilParaleloEsteira } from '@/lib/kanban/pipeline-esteira-tres-etapas';

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

type TabelaProps = {
  titulo: string;
  grupos: ReturnType<typeof agruparCardsUnidadePorProjeto>;
  allCards: PipelineCardDisplay[];
  enrichment?: PipelineFranqueadoraEnrichment | null;
  onCardClick: (card: PipelineCardDisplay) => void;
};

function PipelineUnidadeCardsTabela({ titulo, grupos, allCards, enrichment, onCardClick }: TabelaProps) {
  if (grupos.length === 0) return null;

  return (
    <div className="mb-5 last:mb-0">
      <h3
        className="mb-2 text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}
      >
        {titulo}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] table-fixed text-left text-[11px]">
          <thead>
            <tr style={{ borderBottom: '0.5px solid var(--moni-border-subtle, var(--moni-border-default))' }}>
              {[
                { h: 'Título', w: 'w-[18%]' },
                { h: 'Fase', w: 'w-[14%]' },
                { h: 'Status', w: 'w-[10%]' },
                { h: 'Tempo', w: 'w-[8%]' },
                { h: 'Esteira', w: 'w-[42%]' },
                { h: '', w: 'w-[8%]' },
              ].map(({ h, w }) => (
                <th
                  key={h || 'acao'}
                  className={`pb-2 pr-2 font-semibold uppercase tracking-wide last:pr-0 ${w}`}
                  style={{ color: 'var(--moni-text-tertiary)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grupos.map((grupo, idx) => {
              const card = grupo.anchor;
              const badge = badgeStatusPipelineCard(card);
              const tagClass = tagClassBadgeStatusPipeline(badge);
              const customStyle = pipelineBadgeInlineStyle(badge);
              const relativo = formatRelativeNaFaseDesde(card);
              const slaExcedido = faseSlaExcedido(card);
              const paralelosCount = grupo.cards.filter((c) => isFunilParaleloEsteira(c.kanban_id)).length;

              return (
                <tr
                  key={grupo.anchor.id}
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
                    className="truncate py-2 pr-2 font-medium"
                    style={{ color: 'var(--moni-text-primary)' }}
                    title={String(card.titulo ?? '').trim() || undefined}
                  >
                    {tituloPipelineCardDisplay(card, idx + 1)}
                    {paralelosCount > 0 ? (
                      <span className="ml-1 text-[10px] font-normal" style={{ color: 'var(--moni-text-tertiary)' }}>
                        +{paralelosCount} paralelo{paralelosCount === 1 ? '' : 's'}
                      </span>
                    ) : null}
                  </td>
                  <td className="truncate py-2 pr-2" style={{ color: 'var(--moni-text-secondary)' }}>
                    {card.fase_nome}
                  </td>
                  <td className="py-2 pr-2">
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
                    className="py-2 pr-2 tabular-nums"
                    style={{ color: slaExcedido ? 'var(--moni-status-overdue-text)' : 'var(--moni-text-secondary)' }}
                  >
                    {relativo}
                  </td>
                  <td className="py-2 pr-2">
                    <PipelineEsteiraPrincipalComSubesteiras
                      card={card}
                      siblingCards={allCards}
                      enrichment={enrichment}
                    />
                  </td>
                  <td className="py-2 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                    Detalhe →
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PipelineFranqueadoraUnidadeBloco({ meta, cards, enrichment, onCardClick }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { alertas, saude, funilMes } = meta;
  const saudeIndicador = indicadorSaudeUnidadePipeline(alertas, saude);

  const grupos = useMemo(() => agruparCardsUnidadePorProjeto(cards), [cards]);

  return (
    <section style={panelStyle}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex min-h-[44px] w-full flex-nowrap items-center gap-2 overflow-x-auto px-4 py-3 text-left transition hover:bg-[var(--moni-surface-50)]"
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-x-2 overflow-x-auto whitespace-nowrap">
          <span
            className="inline-flex w-5 shrink-0 items-center justify-center text-[13px] leading-none"
            aria-hidden
          >
            {emojiIndicadorSaudePipeline(saudeIndicador)}
          </span>
          <span className="sr-only">Saúde: {saudeIndicador}</span>
          <h2
            className="shrink-0 text-[13px] font-semibold"
            style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-display)' }}
          >
            {meta.label}
          </h2>
          <span className="shrink-0 text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
            {cards.length} card{cards.length === 1 ? '' : 's'}
          </span>
          {alertas.atrasados > 0 ? (
            <span className="moni-tag-atrasado shrink-0 text-[10px]">{alertas.atrasados} atrasado(s)</span>
          ) : null}
          {alertas.chamadosTrava > 0 ? (
            <span className="moni-tag-atencao shrink-0 text-[10px]">{alertas.chamadosTrava} trava(s)</span>
          ) : null}
          {alertas.venceEm2Dias > 0 ? (
            <span className="moni-tag-atencao shrink-0 text-[10px]">{alertas.venceEm2Dias} vence em 2d</span>
          ) : null}
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
          <PipelineFunilMesCondensado funil={funilMes} className="mb-4" />

          <PipelineUnidadeCardsTabela
            titulo="Projetos"
            grupos={grupos}
            allCards={cards}
            enrichment={enrichment}
            onCardClick={onCardClick}
          />
        </div>
      ) : null}
    </section>
  );
}
