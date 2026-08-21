'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type {
  PipelineCardDisplay,
  PipelineFranqueadoraEnrichment,
  PipelineProjetoGrupoUnidade,
} from '@/lib/kanban/pipeline-cards-types';
import { tituloPipelineCardDisplay } from '@/lib/kanban/pipeline-card-readonly';
import {
  PipelineSubesteirasParalelasGrid,
  PipelineEsteiraTresFunis,
} from '@/components/pipeline/PipelineSequencialBar';
import { indiceEsteiraTresEtapas, isFunilEsteiraPrincipal } from '@/lib/kanban/pipeline-esteira-tres-etapas';
import { linhasSubesteiraParalelaDoGrupo } from '@/lib/kanban/pipeline-unidade-visualizacao';
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
  const [paralelosExpandidos, setParalelosExpandidos] = useState(false);

  const anchorCard =
    grupo.cards.find((c) => isFunilEsteiraPrincipal(c.kanban_id)) ??
    grupo.cards.reduce((best, c) => {
      const idx = indiceEsteiraTresEtapas(c.kanban_id);
      const bestIdx = indiceEsteiraTresEtapas(best.kanban_id);
      return idx >= bestIdx ? c : best;
    }, grupo.cards[0]);

  const subLinhas = linhasSubesteiraParalelaDoGrupo(grupo.cards);
  const temParalelos = subLinhas.length > 0;

  return (
    <section style={panelStyle}>
      <div className="px-4 py-3">
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

      <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: 'var(--moni-border-default)' }}>
        <PipelineEsteiraTresFunis
          card={anchorCard}
          siblingCards={grupo.cards}
          enrichment={enrichment}
          className="mb-2"
        />

        {temParalelos ? (
          <>
            <button
              type="button"
              onClick={() => setParalelosExpandidos((v) => !v)}
              className="mb-3 inline-flex min-h-[32px] items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition hover:bg-[var(--moni-surface-50)]"
              style={{
                color: 'var(--moni-text-tertiary)',
                border: '0.5px solid var(--moni-border-default)',
                borderRadius: 'var(--moni-radius-md)',
              }}
              aria-expanded={paralelosExpandidos}
            >
              <ChevronDown
                className="h-3 w-3 shrink-0"
                style={{ transform: paralelosExpandidos ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
              {paralelosExpandidos ? 'Ocultar' : 'Mostrar'} paralelas ({subLinhas.length})
            </button>

            {paralelosExpandidos ? (
              <PipelineSubesteirasParalelasGrid
                card={anchorCard}
                siblingCards={grupo.cards}
                enrichment={enrichment}
                className="mb-4"
              />
            ) : null}
          </>
        ) : null}

        <div className="space-y-3">
          {grupo.cards.map((card, idx) => (
            <div
              key={card.id}
              className="rounded-lg px-3 py-3"
              style={{
                border: '0.5px solid var(--moni-border-subtle, var(--moni-border-default))',
                background: 'var(--moni-surface-50)',
              }}
            >
              <p className="mb-2 text-[12px] font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                {tituloPipelineCardDisplay(card, idx + 1)}
                <span className="font-normal" style={{ color: 'var(--moni-text-tertiary)' }}>
                  {' '}
                  · {card.kanban_nome}
                </span>
              </p>
              <PipelineUnidadeCardMetaLinhas card={card} onHistorico={onCardClick} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
