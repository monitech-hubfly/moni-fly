'use client';

import type { PipelineCardDisplay, PipelineCardBadgeStatus } from '@/lib/kanban/pipeline-cards-types';
import { faseSlaExcedido, formatRelativeNaFaseDesde } from '@/lib/kanban/pipeline-card-readonly';
import {
  labelBadgeStatusPipeline,
  tagClassBadgeStatusPipeline,
} from '@/lib/kanban/pipeline-franqueadora-compute';
import { pipelineBadgeInlineStyle } from '@/components/pipeline/PipelineSequencialBar';

export function PipelineTabelaCelulaStatus({
  badge,
  compact = false,
}: {
  badge: PipelineCardBadgeStatus;
  compact?: boolean;
}) {
  const tagClass = tagClassBadgeStatusPipeline(badge);
  const customStyle = pipelineBadgeInlineStyle(badge);
  const py = compact ? 'py-1.5' : 'py-2';

  return (
    <td className={`${py} pr-2`}>
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
  );
}

export function PipelineTabelaCelulaTempo({
  card,
  compact = false,
}: {
  card: PipelineCardDisplay;
  compact?: boolean;
}) {
  const relativo = formatRelativeNaFaseDesde(card);
  const slaExcedido = faseSlaExcedido(card);
  const py = compact ? 'py-1.5' : 'py-2';

  return (
    <td
      className={`${py} pr-2 tabular-nums`}
      style={{ color: slaExcedido ? 'var(--moni-status-overdue-text)' : 'var(--moni-text-secondary)' }}
    >
      {relativo}
    </td>
  );
}
