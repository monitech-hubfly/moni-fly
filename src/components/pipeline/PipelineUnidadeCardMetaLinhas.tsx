'use client';

import Link from 'next/link';
import { ExternalLink, History } from 'lucide-react';
import type { PipelineCardDisplay } from '@/lib/kanban/pipeline-cards-types';
import { hrefAbrirCardKanban } from '@/lib/kanban/kanban-card-href';
import { faseSlaExcedido, formatRelativeNaFaseDesde } from '@/lib/kanban/pipeline-card-readonly';
import {
  badgeStatusPipelineCard,
  labelBadgeStatusPipeline,
  tagClassBadgeStatusPipeline,
} from '@/lib/kanban/pipeline-franqueadora-compute';
import { pipelineBadgeInlineStyle, labelSlaResumidoPipeline } from '@/components/pipeline/PipelineSequencialBar';

type Props = {
  card: PipelineCardDisplay;
  onHistorico: (card: PipelineCardDisplay) => void;
};

export function PipelineUnidadeCardMetaLinhas({ card, onHistorico }: Props) {
  const badge = badgeStatusPipelineCard(card);
  const tagClass = tagClassBadgeStatusPipeline(badge);
  const customStyle = pipelineBadgeInlineStyle(badge);
  const relativo = formatRelativeNaFaseDesde(card);
  const slaExcedido = faseSlaExcedido(card);
  const href = hrefAbrirCardKanban(card.kanban_nome, card.id);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-[12px] leading-snug" style={{ color: 'var(--moni-text-secondary)' }}>
          <span style={{ color: 'var(--moni-text-primary)' }}>{card.fase_nome}</span>
          <span style={{ color: 'var(--moni-text-tertiary)' }}> · </span>
          <span style={{ color: slaExcedido ? 'var(--moni-status-overdue-text)' : 'var(--moni-text-tertiary)' }}>
            {relativo}
          </span>
        </p>
        <p className="text-[12px] leading-snug" style={{ color: 'var(--moni-text-secondary)' }}>
          <span style={{ color: 'var(--moni-text-tertiary)' }}>SLA: </span>
          {labelSlaResumidoPipeline(card)}
          <span style={{ color: 'var(--moni-text-tertiary)' }}> · </span>
          {tagClass ? (
            <span className={`text-[10px] ${tagClass}`} style={customStyle}>
              {labelBadgeStatusPipeline(badge)}
            </span>
          ) : (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={customStyle}>
              {labelBadgeStatusPipeline(badge)}
            </span>
          )}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onHistorico(card)}
          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition hover:opacity-90"
          style={{
            border: '0.5px solid var(--moni-border-default)',
            color: 'var(--moni-text-primary)',
            background: 'var(--moni-surface-0)',
            fontFamily: 'var(--moni-font-sans)',
          }}
        >
          <History className="h-3.5 w-3.5" aria-hidden />
          Histórico
        </button>
        <Link
          href={href}
          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold text-white transition hover:opacity-90"
          style={{ background: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-sans)' }}
        >
          Abrir card
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
