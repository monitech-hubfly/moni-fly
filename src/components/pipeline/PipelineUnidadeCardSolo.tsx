'use client';

import type { PipelineCardDisplay, PipelineFranqueadoraEnrichment } from '@/lib/kanban/pipeline-cards-types';
import { PipelineSequencialBar } from '@/components/pipeline/PipelineSequencialBar';
import { PipelineUnidadeCardMetaLinhas } from '@/components/pipeline/PipelineUnidadeCardMetaLinhas';

const panelStyle: React.CSSProperties = {
  borderRadius: 'var(--moni-radius-lg)',
  border: '0.5px solid var(--moni-border-default)',
  background: 'var(--moni-surface-0)',
};

type Props = {
  card: PipelineCardDisplay;
  enrichment?: PipelineFranqueadoraEnrichment | null;
  onCardClick: (card: PipelineCardDisplay) => void;
};

export function PipelineUnidadeCardSolo({ card, enrichment, onCardClick }: Props) {
  const tituloDisplay =
    String(card.titulo ?? '').trim() ||
    (card.n_franquia ? `Franquia ${card.n_franquia}` : card.kanban_nome);

  return (
    <article className="px-4 py-4" style={panelStyle}>
      <h3
        className="mb-3 text-[13px] font-semibold leading-snug"
        style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-display)' }}
      >
        {tituloDisplay}
      </h3>

      <PipelineSequencialBar card={card} enrichment={enrichment} className="mb-3" />

      <PipelineUnidadeCardMetaLinhas card={card} onHistorico={onCardClick} />
    </article>
  );
}
