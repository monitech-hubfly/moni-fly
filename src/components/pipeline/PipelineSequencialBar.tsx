'use client';

import type { PipelineCardDisplay } from '@/lib/kanban/pipeline-cards-types';
import type { PipelineFranqueadoraEnrichment } from '@/lib/kanban/pipeline-cards-types';
import type { PipelineCardBadgeStatus } from '@/lib/kanban/pipeline-cards-types';
import {
  badgeStatusPipelineCard,
} from '@/lib/kanban/pipeline-franqueadora-compute';
import {
  ESTEIRA_TRES_ETAPAS,
  indiceEsteiraTresEtapas,
  maxOrdemFaseKanban,
} from '@/lib/kanban/pipeline-esteira-tres-etapas';
import { slaCategoriaPipeline } from '@/lib/kanban/pipeline-cards-utils';
import { calcularDiasNaFase } from '@/lib/kanban/pipeline-card-readonly';
import { PARADO_DIAS } from '@/lib/kanban/pipeline-franqueadora-compute';

type SegmentEstado = 'concluida_ok' | 'concluida_alerta' | 'atual_ok' | 'atual_alerta' | 'atual_atrasado' | 'atual_parado' | 'futura';

const SEGMENT_FILL: Record<SegmentEstado, string> = {
  concluida_ok: 'var(--moni-navy-400)',
  concluida_alerta: 'var(--moni-gold-400)',
  atual_ok: 'var(--moni-navy-400)',
  atual_alerta: 'var(--moni-gold-400)',
  atual_atrasado: 'var(--moni-status-overdue-text)',
  atual_parado: 'var(--moni-earth-800)',
  futura: 'var(--moni-rede-chart-track)',
};

function resolveSegmentEstado(
  idx: number,
  indiceAtual: number,
  card: PipelineCardDisplay,
): SegmentEstado {
  if (idx > indiceAtual) return 'futura';
  if (idx < indiceAtual) {
    const badge = badgeStatusPipelineCard(card);
    return badge === 'alerta' || badge === 'atrasado' ? 'concluida_alerta' : 'concluida_ok';
  }
  const dias = calcularDiasNaFase(card);
  if (slaCategoriaPipeline(card) === 'atrasado') return 'atual_atrasado';
  if (dias >= PARADO_DIAS && card.inativo) return 'atual_parado';
  const badge = badgeStatusPipelineCard(card);
  if (badge === 'alerta') return 'atual_alerta';
  return 'atual_ok';
}

function segmentWidth(
  idx: number,
  indiceAtual: number,
  card: PipelineCardDisplay,
  maxOrdemPorKanban: Record<string, number> | undefined,
): string {
  if (idx < indiceAtual) return '100%';
  if (idx > indiceAtual) return '0%';
  const max = maxOrdemFaseKanban(card.kanban_id, maxOrdemPorKanban, card.fase_ordem);
  const ratio = Math.max(0.08, Math.min(0.98, card.fase_ordem / max));
  return `${Math.round(ratio * 100)}%`;
}

export function PipelineSequencialBar({
  card,
  enrichment,
  className,
}: {
  card: PipelineCardDisplay;
  enrichment?: PipelineFranqueadoraEnrichment | null;
  className?: string;
}) {
  const indiceAtual = indiceEsteiraTresEtapas(card.kanban_id);
  const maxMap = enrichment?.maxOrdemPorKanban;

  return (
    <div className={className}>
      <div className="hidden gap-1 sm:grid sm:grid-cols-3">
        {ESTEIRA_TRES_ETAPAS.map((etapa, idx) => {
          const estado = resolveSegmentEstado(idx, indiceAtual, card);
          const isAtual = idx === indiceAtual;
          const fill = SEGMENT_FILL[estado];
          const width = segmentWidth(idx, indiceAtual, card, maxMap);

          return (
            <div key={etapa.id} className="min-w-0">
              <p
                className="mb-1 truncate text-[10px] font-medium uppercase tracking-wide"
                style={{
                  color: isAtual ? 'var(--moni-text-primary)' : 'var(--moni-text-tertiary)',
                }}
              >
                {etapa.label}
              </p>
              <div
                className="h-1.5 overflow-hidden rounded-full"
                style={{
                  background: 'var(--moni-rede-chart-track)',
                  outline: isAtual ? '1px solid var(--moni-navy-800)' : undefined,
                }}
              >
                <div className="h-full rounded-full transition-all" style={{ width, background: fill }} />
              </div>
              {isAtual ? (
                <p className="mt-0.5 truncate text-[10px]" style={{ color: 'var(--moni-text-secondary)' }}>
                  {card.fase_nome}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="sm:hidden">
        <div
          className="relative h-1.5 overflow-hidden rounded-full"
          style={{ background: 'var(--moni-rede-chart-track)' }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${Math.round(((indiceAtual + 0.5) / ESTEIRA_TRES_ETAPAS.length) * 100)}%`,
              background: SEGMENT_FILL[resolveSegmentEstado(indiceAtual, indiceAtual, card)],
            }}
          />
        </div>
        <p className="mt-1 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          {ESTEIRA_TRES_ETAPAS.map((e) => e.label).join(' → ')}
        </p>
      </div>
    </div>
  );
}

export function pipelineBadgeInlineStyle(status: PipelineCardBadgeStatus): React.CSSProperties | undefined {
  if (status === 'parado') {
    return {
      background: 'var(--moni-earth-50)',
      color: 'var(--moni-earth-800)',
      border: '0.5px solid var(--moni-earth-400)',
    };
  }
  return undefined;
}
