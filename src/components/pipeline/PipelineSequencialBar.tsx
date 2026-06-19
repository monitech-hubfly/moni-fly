'use client';

import type { PipelineCardDisplay, PipelineFranqueadoraEnrichment, PipelineCardBadgeStatus } from '@/lib/kanban/pipeline-cards-types';
import { badgeStatusPipelineCard } from '@/lib/kanban/pipeline-franqueadora-compute';
import {
  ESTEIRA_TRES_ETAPAS,
  configFunilParaleloEsteira,
  indiceEsteiraTresEtapas,
  isFunilParaleloEsteira,
  isFunilEsteiraPrincipal,
  ratioFaseNoKanban,
  resolverCardEsteiraPrincipalProjeto,
} from '@/lib/kanban/pipeline-esteira-tres-etapas';
import { slaCategoriaPipeline } from '@/lib/kanban/pipeline-cards-utils';
import { calcularDiasNaFase } from '@/lib/kanban/pipeline-card-readonly';
import { PARADO_DIAS } from '@/lib/kanban/pipeline-franqueadora-compute';

type SegmentEstado = 'concluida_ok' | 'concluida_alerta' | 'atual_ok' | 'atual_alerta' | 'atual_atrasado' | 'atual_parado' | 'futura' | 'neutra';

const SEGMENT_FILL: Record<SegmentEstado, string> = {
  concluida_ok: 'var(--moni-navy-400)',
  concluida_alerta: 'var(--moni-gold-400)',
  atual_ok: 'var(--moni-navy-400)',
  atual_alerta: 'var(--moni-gold-400)',
  atual_atrasado: 'var(--moni-status-overdue-text)',
  atual_parado: 'var(--moni-violet-800, #5b21b6)',
  futura: 'var(--moni-rede-chart-track)',
  neutra: 'var(--moni-rede-chart-track)',
};

function resolveSegmentEstado(
  idx: number,
  indiceAtual: number,
  card: PipelineCardDisplay,
  isAtualSegment: boolean,
  forceNeutro = false,
): SegmentEstado {
  if (forceNeutro) return idx <= indiceAtual ? 'neutra' : 'futura';
  if (idx > indiceAtual) return 'futura';
  if (idx < indiceAtual) {
    const badge = badgeStatusPipelineCard(card);
    return badge === 'alerta' || badge === 'atrasado' ? 'concluida_alerta' : 'concluida_ok';
  }
  if (!isAtualSegment) return 'concluida_ok';
  const dias = calcularDiasNaFase(card);
  if (slaCategoriaPipeline(card) === 'atrasado') return 'atual_atrasado';
  if (dias >= PARADO_DIAS && card.inativo) return 'atual_parado';
  const badge = badgeStatusPipelineCard(card);
  if (badge === 'alerta') return 'atual_alerta';
  return 'atual_ok';
}

function segmentFillWidth(
  idx: number,
  indiceAtual: number,
  card: PipelineCardDisplay,
  maxOrdemPorKanban: Record<string, number> | undefined,
  onMainFunnel: boolean,
  forceNeutro = false,
): string {
  if (forceNeutro) return idx <= indiceAtual ? '100%' : '0%';
  if (idx < indiceAtual) return '100%';
  if (idx > indiceAtual) return '0%';
  if (!onMainFunnel) return '100%';
  return `${Math.round(ratioFaseNoKanban(card, maxOrdemPorKanban) * 100)}%`;
}

function resolveMainIndiceAtual(card: PipelineCardDisplay): number {
  if (isFunilEsteiraPrincipal(card.kanban_id)) {
    return indiceEsteiraTresEtapas(card.kanban_id);
  }
  if (isFunilParaleloEsteira(card.kanban_id)) {
    const branch = indiceEsteiraTresEtapas(card.kanban_id);
    return Math.max(0, branch - 1);
  }
  return indiceEsteiraTresEtapas(card.kanban_id);
}

function isCurrentMainSegment(idx: number, card: PipelineCardDisplay): boolean {
  if (!isFunilEsteiraPrincipal(card.kanban_id)) return false;
  return idx === indiceEsteiraTresEtapas(card.kanban_id);
}

type BarTrackProps = {
  card: PipelineCardDisplay;
  enrichment?: PipelineFranqueadoraEnrichment | null;
  heightPx: number;
  siblingCards?: PipelineCardDisplay[];
};

function EsteiraMainTrack({ card, enrichment, heightPx, siblingCards }: BarTrackProps) {
  const maxMap = enrichment?.maxOrdemPorKanban;
  const isParalelo = isFunilParaleloEsteira(card.kanban_id);

  const trackCard: PipelineCardDisplay = (() => {
    if (!isParalelo) return card;
    const principal = resolverCardEsteiraPrincipalProjeto(card, siblingCards);
    if (!principal) return card;
    const full = siblingCards?.find(
      (c) => c.kanban_id === principal.kanban_id && String(c.projeto_id ?? '') === String(card.projeto_id ?? ''),
    );
    return full ?? ({ ...card, kanban_id: principal.kanban_id, fase_ordem: principal.fase_ordem } as PipelineCardDisplay);
  })();

  const indiceAtual = resolveMainIndiceAtual(trackCard);
  const onMainFunnel = isFunilEsteiraPrincipal(trackCard.kanban_id);
  const forceNeutro = isParalelo;

  return (
    <div>
      <div
        className="flex overflow-hidden rounded-full"
        style={{ background: 'var(--moni-rede-chart-track)', height: `${heightPx}px` }}
      >
        {ESTEIRA_TRES_ETAPAS.map((etapa, idx) => {
          const isAtual = !forceNeutro && isCurrentMainSegment(idx, trackCard);
          const estado = resolveSegmentEstado(idx, indiceAtual, trackCard, isAtual, forceNeutro);
          const fill = SEGMENT_FILL[estado];
          const width = segmentFillWidth(idx, indiceAtual, trackCard, maxMap, onMainFunnel && isAtual, forceNeutro);

          return (
            <div
              key={etapa.id}
              className="relative min-w-0 flex-1"
              style={{
                borderRight: idx < ESTEIRA_TRES_ETAPAS.length - 1 ? '0.5px solid var(--moni-border-default)' : undefined,
                outline: isAtual ? '1px solid var(--moni-navy-800)' : undefined,
                outlineOffset: isAtual ? '-1px' : undefined,
                zIndex: isAtual ? 1 : 0,
              }}
            >
              <div
                className="absolute inset-y-0 left-0 transition-all"
                style={{
                  width,
                  background: fill,
                  opacity: estado === 'futura' ? 1 : forceNeutro ? 0.55 : 0.92,
                }}
              />
            </div>
          );
        })}
      </div>

      {isParalelo ? (
        <p className="mt-0.5 truncate text-[10px] italic" style={{ color: 'var(--moni-text-tertiary)' }}>
          paralelo: {configFunilParaleloEsteira(card.kanban_id)?.label ?? card.kanban_nome}
        </p>
      ) : null}
    </div>
  );
}

export function PipelineSequencialBar({
  card,
  enrichment,
  className,
  siblingCards,
}: {
  card: PipelineCardDisplay;
  enrichment?: PipelineFranqueadoraEnrichment | null;
  className?: string;
  siblingCards?: PipelineCardDisplay[];
}) {
  return (
    <div className={className}>
      <EsteiraMainTrack card={card} enrichment={enrichment} heightPx={6} siblingCards={siblingCards} />
    </div>
  );
}

/** Barra multi-track no topo de um bloco de projeto (um card por funil ativo). */
export function PipelineSequencialBarMultiTrack({
  cards,
  enrichment,
  className,
}: {
  cards: PipelineCardDisplay[];
  enrichment?: PipelineFranqueadoraEnrichment | null;
  className?: string;
}) {
  if (cards.length === 0) return null;

  const principal =
    cards.find((c) => isFunilEsteiraPrincipal(c.kanban_id)) ??
    cards.reduce((best, c) => {
      const idx = indiceEsteiraTresEtapas(c.kanban_id);
      const bestIdx = indiceEsteiraTresEtapas(best.kanban_id);
      return idx >= bestIdx ? c : best;
    }, cards[0]);

  const paralelos = cards.filter((c) => isFunilParaleloEsteira(c.kanban_id));

  return (
    <div className={className}>
      <PipelineSequencialBar card={principal} enrichment={enrichment} siblingCards={cards} />
      {paralelos.map((c) => (
        <div key={c.id} className="mt-2">
          <EsteiraMainTrack card={c} enrichment={enrichment} heightPx={6} siblingCards={cards} />
        </div>
      ))}
    </div>
  );
}

export function pipelineBadgeInlineStyle(status: PipelineCardBadgeStatus): React.CSSProperties | undefined {
  if (status === 'parado') {
    return {
      background: 'color-mix(in srgb, var(--moni-violet-800, #5b21b6) 12%, transparent)',
      color: 'var(--moni-violet-800, #5b21b6)',
      border: '0.5px solid color-mix(in srgb, var(--moni-violet-800, #5b21b6) 35%, transparent)',
    };
  }
  return undefined;
}

export function labelSlaResumidoPipeline(card: PipelineCardDisplay): string {
  if (card.sla.pausado) return card.sla.label;
  if (card.sla.status === 'atrasado') {
    const n = card.sla.diasAtraso ?? 0;
    return n > 0 ? `${n} d.u. em atraso` : 'SLA atrasado';
  }
  if (card.sla.label === 'Vence hoje') return 'vence hoje';
  const rest = card.sla.diasRestantes;
  if (rest != null) return `${rest} d.u. restantes`;
  return card.sla.label || '—';
}
