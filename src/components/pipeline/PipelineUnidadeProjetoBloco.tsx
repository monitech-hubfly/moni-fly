'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type {
  PipelineCardDisplay,
  PipelineFranqueadoraEnrichment,
  PipelineProjetoGrupoUnidade,
} from '@/lib/kanban/pipeline-cards-types';
import {
  PipelineSequencialBarMultiTrack,
} from '@/components/pipeline/PipelineSequencialBar';
import { PipelineUnidadeCardMetaLinhas } from '@/components/pipeline/PipelineUnidadeCardMetaLinhas';

const panelStyle: React.CSSProperties = {
  borderRadius: 'var(--moni-radius-lg)',
  border: '0.5px solid var(--moni-border-default)',
  background: 'var(--moni-surface-0)',
};

type Props = {
  grupo: PipelineProjetoGrupoUnidade;
  enrichment?: PipelineFranqueadoraEnrichment | null;
  onCardClick: (card: PipelineCardDisplay) => void;
};

export function PipelineUnidadeProjetoBloco({ grupo, enrichment, onCardClick }: Props) {
  const [expanded, setExpanded] = useState(grupo.defaultExpanded);

  return (
    <section style={panelStyle}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex min-h-[44px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[var(--moni-surface-50)]"
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <h2
            className="truncate text-[13px] font-semibold"
            style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-display)' }}
          >
            {grupo.projetoTitulo}
          </h2>
          <p className="mt-0.5 text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
            {grupo.cards.length} funil{grupo.cards.length === 1 ? '' : 's'} ativo{grupo.cards.length === 1 ? '' : 's'}
          </p>
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
          <PipelineSequencialBarMultiTrack cards={grupo.cards} enrichment={enrichment} className="mb-4" />

          <div className="space-y-3">
            {grupo.cards.map((card) => (
              <div
                key={card.id}
                className="rounded-lg px-3 py-3"
                style={{
                  border: '0.5px solid var(--moni-border-subtle, var(--moni-border-default))',
                  background: 'var(--moni-surface-50)',
                }}
              >
                <PipelineUnidadeCardMetaLinhas
                  card={card}
                  showFunil
                  onHistorico={onCardClick}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
