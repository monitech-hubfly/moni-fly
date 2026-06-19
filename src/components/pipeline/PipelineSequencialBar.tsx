'use client';

import type { PipelineCardDisplay, PipelineFranqueadoraEnrichment, PipelineCardBadgeStatus } from '@/lib/kanban/pipeline-cards-types';
import { badgeStatusPipelineCard } from '@/lib/kanban/pipeline-franqueadora-compute';
import {
  ESTEIRA_TRES_ETAPAS,
  FUNIS_PARALELOS_ESTEIRA,
  configFunilParaleloEsteira,
  indiceEsteiraTresEtapas,
  isFunilParaleloEsteira,
  isFunilEsteiraPrincipal,
  ratioFaseNoKanban,
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
  atual_parado: 'var(--moni-violet-800, #5b21b6)',
  futura: 'var(--moni-rede-chart-track)',
};

function resolveSegmentEstado(
  idx: number,
  indiceAtual: number,
  card: PipelineCardDisplay,
  isAtualSegment: boolean,
): SegmentEstado {
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
): string {
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
  showLabels?: boolean;
  compact?: boolean;
};

function EsteiraMainTrack({ card, enrichment, heightPx, showLabels = true, compact = false }: BarTrackProps) {
  const maxMap = enrichment?.maxOrdemPorKanban;
  const indiceAtual = resolveMainIndiceAtual(card);
  const onMainFunnel = isFunilEsteiraPrincipal(card.kanban_id);

  return (
    <div>
      {showLabels ? (
        <div className="mb-1 grid grid-cols-3 gap-1">
          {ESTEIRA_TRES_ETAPAS.map((etapa, idx) => {
            const isAtual = isCurrentMainSegment(idx, card);
            return (
              <p
                key={etapa.id}
                className={`truncate font-medium uppercase tracking-wide ${compact ? 'text-[9px]' : 'text-[10px]'}`}
                style={{
                  color: isAtual ? 'var(--moni-text-primary)' : 'var(--moni-text-tertiary)',
                }}
              >
                {etapa.label}
              </p>
            );
          })}
        </div>
      ) : null}

      <div
        className="flex overflow-hidden rounded-full"
        style={{ background: 'var(--moni-rede-chart-track)', height: `${heightPx}px` }}
      >
        {ESTEIRA_TRES_ETAPAS.map((etapa, idx) => {
          const isAtual = isCurrentMainSegment(idx, card);
          const estado = resolveSegmentEstado(idx, indiceAtual, card, isAtual);
          const fill = SEGMENT_FILL[estado];
          const width = segmentFillWidth(idx, indiceAtual, card, maxMap, onMainFunnel && isAtual);

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
                  opacity: estado === 'futura' ? 1 : 0.92,
                }}
              />
            </div>
          );
        })}
      </div>

      {showLabels && isFunilEsteiraPrincipal(card.kanban_id) ? (
        <p className="mt-0.5 truncate text-[10px]" style={{ color: 'var(--moni-text-secondary)' }}>
          {card.fase_nome}
        </p>
      ) : null}
    </div>
  );
}

function EsteiraParalelaTrack({ card, enrichment, heightPx }: BarTrackProps) {
  const paralelo = configFunilParaleloEsteira(card.kanban_id);
  if (!paralelo) return null;

  const maxMap = enrichment?.maxOrdemPorKanban;
  const estado = resolveSegmentEstado(0, 0, card, true);
  const fill = SEGMENT_FILL[estado];
  const width = `${Math.round(ratioFaseNoKanban(card, maxMap) * 100)}%`;

  return (
    <div className="mt-2">
      <p className="mb-1 text-[9px] font-medium uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
        paralelo à esteira principal
      </p>
      <div className="mb-1 flex flex-wrap gap-x-3 gap-y-0.5">
        {FUNIS_PARALELOS_ESTEIRA.map((f) => (
          <span
            key={f.id}
            className="text-[9px] font-medium uppercase tracking-wide"
            style={{
              color: f.id === paralelo.id ? 'var(--moni-text-primary)' : 'var(--moni-text-tertiary)',
            }}
          >
            {f.label}
          </span>
        ))}
      </div>
      <div
        className="overflow-hidden rounded-full"
        style={{ background: 'var(--moni-rede-chart-track)', height: `${heightPx}px` }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width,
            background: fill,
            opacity: 0.92,
            outline: '1px solid var(--moni-navy-800)',
            outlineOffset: '-1px',
          }}
        />
      </div>
      <p className="mt-0.5 truncate text-[10px]" style={{ color: 'var(--moni-text-secondary)' }}>
        {card.kanban_nome} · {card.fase_nome}
      </p>
    </div>
  );
}

export function PipelineSequencialBar({
  card,
  enrichment,
  className,
  compact = false,
}: {
  card: PipelineCardDisplay;
  enrichment?: PipelineFranqueadoraEnrichment | null;
  className?: string;
  compact?: boolean;
}) {
  const showParalelo = isFunilParaleloEsteira(card.kanban_id);

  return (
    <div className={className}>
      <div className="hidden sm:block">
        <EsteiraMainTrack card={card} enrichment={enrichment} heightPx={6} compact={compact} />
        {showParalelo ? <EsteiraParalelaTrack card={card} enrichment={enrichment} heightPx={3} /> : null}
      </div>

      <div className="sm:hidden">
        <EsteiraMainTrack card={card} enrichment={enrichment} heightPx={6} showLabels={false} compact={compact} />
        {showParalelo ? <EsteiraParalelaTrack card={card} enrichment={enrichment} heightPx={3} /> : null}
        <p className="mt-1 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          {ESTEIRA_TRES_ETAPAS.map((e) => e.label).join(' → ')}
        </p>
      </div>
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
      <PipelineSequencialBar card={principal} enrichment={enrichment} compact />
      {paralelos.map((c) => (
        <EsteiraParalelaTrack key={c.id} card={c} enrichment={enrichment} heightPx={3} />
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
