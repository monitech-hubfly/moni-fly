'use client';

import type { PipelineCardDisplay, PipelineFranqueadoraEnrichment, PipelineCardBadgeStatus } from '@/lib/kanban/pipeline-cards-types';
import { badgeStatusPipelineCard } from '@/lib/kanban/pipeline-franqueadora-compute';
import {
  ESTEIRA_TRES_ETAPAS,
  configFunilParaleloEsteira,
  gridColumnSubesteiraParalela,
  idProjetoNegocioPipelineCard,
  indiceEsteiraTresEtapas,
  isFunilParaleloEsteira,
  isFunilEsteiraPrincipal,
  ratioFaseNoKanban,
  resolverCardEsteiraPrincipalProjeto,
} from '@/lib/kanban/pipeline-esteira-tres-etapas';
import {
  cardsRelacionadosProjeto,
  linhasSubesteiraParalelaDoGrupo,
  resolverCardFunilNoGrupoParalelo,
} from '@/lib/kanban/pipeline-unidade-visualizacao';
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

type BarTrackProps = {
  card: PipelineCardDisplay;
  enrichment?: PipelineFranqueadoraEnrichment | null;
  heightPx: number;
  siblingCards?: PipelineCardDisplay[];
  /** Funil paralelo: exibir label itálico abaixo da barra. */
  showParaleloLabel?: boolean;
};

function EsteiraMainTrack({ card, enrichment, heightPx, siblingCards, showParaleloLabel = true }: BarTrackProps) {
  const maxMap = enrichment?.maxOrdemPorKanban;
  const isParalelo = isFunilParaleloEsteira(card.kanban_id);
  const projetoId = idProjetoNegocioPipelineCard(card);
  const principalRef = isParalelo ? resolverCardEsteiraPrincipalProjeto(card, siblingCards) : null;

  const trackCard: PipelineCardDisplay = (() => {
    if (!isParalelo || !principalRef) return card;
    const full = siblingCards?.find(
      (c) =>
        c.kanban_id === principalRef.kanban_id && idProjetoNegocioPipelineCard(c) === projetoId,
    );
    return full ?? ({ ...card, kanban_id: principalRef.kanban_id, fase_ordem: principalRef.fase_ordem } as PipelineCardDisplay);
  })();

  /** Funis paralelos não ocupam posição na esteira — só cinza, salvo progresso do card principal do projeto. */
  const colorirComPrincipal =
    isFunilEsteiraPrincipal(trackCard.kanban_id) && (!isParalelo || (principalRef != null && projetoId !== ''));

  const forceNeutro = isParalelo && !colorirComPrincipal;
  const indiceAtual = colorirComPrincipal ? indiceEsteiraTresEtapas(trackCard.kanban_id) : 0;
  const onMainFunnel = colorirComPrincipal;

  return (
    <div>
      <div
        className="flex overflow-hidden rounded-full"
        style={{ background: 'var(--moni-rede-chart-track)', height: `${heightPx}px` }}
      >
        {ESTEIRA_TRES_ETAPAS.map((etapa, idx) => {
          const isAtual = colorirComPrincipal && idx === indiceAtual;
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
                  opacity: estado === 'futura' ? 1 : forceNeutro ? 0.45 : 0.92,
                }}
              />
            </div>
          );
        })}
      </div>

      {isParalelo && showParaleloLabel ? (
        <p className="mt-0.5 truncate text-[10px] italic" style={{ color: 'var(--moni-text-tertiary)' }}>
          paralelo: {configFunilParaleloEsteira(card.kanban_id)?.label ?? card.kanban_nome}
        </p>
      ) : null}
    </div>
  );
}

function resolveEstadoSegmentoCard(segCard: PipelineCardDisplay): SegmentEstado {
  const dias = calcularDiasNaFase(segCard);
  if (slaCategoriaPipeline(segCard) === 'atrasado') return 'atual_atrasado';
  if (dias >= PARADO_DIAS && segCard.inativo) return 'atual_parado';
  const badge = badgeStatusPipelineCard(segCard);
  if (badge === 'alerta') return 'atual_alerta';
  return 'atual_ok';
}

function resolveEstadoSegmentoConcluido(segCard: PipelineCardDisplay | null): SegmentEstado {
  if (!segCard) return 'concluida_ok';
  const badge = badgeStatusPipelineCard(segCard);
  return badge === 'alerta' || badge === 'atrasado' ? 'concluida_alerta' : 'concluida_ok';
}

/** Uma única linha — Step One · Portfólio · Pré Obra e Obra (visão principal da unidade). */
export function PipelineEsteiraTresFunis({
  card,
  siblingCards,
  enrichment,
  className,
  heightPx = 8,
}: {
  card: PipelineCardDisplay;
  siblingCards?: PipelineCardDisplay[];
  enrichment?: PipelineFranqueadoraEnrichment | null;
  className?: string;
  heightPx?: number;
}) {
  const siblings = siblingCards ?? [card];
  const relacionados = cardsRelacionadosProjeto(card, siblings);
  const maxMap = enrichment?.maxOrdemPorKanban;

  const segmentCards = ESTEIRA_TRES_ETAPAS.map((etapa) =>
    relacionados.find((c) => (etapa.kanbanIds as readonly string[]).includes(c.kanban_id)) ?? null,
  );

  let highestIdx = -1;
  for (let i = segmentCards.length - 1; i >= 0; i--) {
    if (segmentCards[i]) {
      highestIdx = i;
      break;
    }
  }
  if (highestIdx < 0 && isFunilEsteiraPrincipal(card.kanban_id)) {
    highestIdx = indiceEsteiraTresEtapas(card.kanban_id);
  }

  const rowSegmentIdx = isFunilEsteiraPrincipal(card.kanban_id)
    ? indiceEsteiraTresEtapas(card.kanban_id)
    : -1;

  return (
    <div className={className}>
      <div
        className="flex overflow-hidden rounded-full"
        style={{ background: 'var(--moni-rede-chart-track)', height: `${heightPx}px` }}
      >
        {ESTEIRA_TRES_ETAPAS.map((etapa, idx) => {
          const segCard = segmentCards[idx];
          const isAtualGlobal = idx === highestIdx;
          const isRowKanban = idx === rowSegmentIdx;

          let estado: SegmentEstado = 'futura';
          let width = '0%';

          if (segCard) {
            if (idx < highestIdx) {
              estado = resolveEstadoSegmentoConcluido(segCard);
              width = '100%';
            } else if (isAtualGlobal) {
              estado = resolveEstadoSegmentoCard(segCard);
              width = `${Math.round(ratioFaseNoKanban(segCard, maxMap) * 100)}%`;
            } else {
              estado = 'futura';
              width = '0%';
            }
          } else if (idx < highestIdx) {
            estado = 'concluida_ok';
            width = '100%';
          }

          const fill = SEGMENT_FILL[estado];

          return (
            <div
              key={etapa.id}
              className="relative min-w-0 flex-1"
              style={{
                borderRight:
                  idx < ESTEIRA_TRES_ETAPAS.length - 1 ? '0.5px solid var(--moni-border-default)' : undefined,
                outline: isRowKanban ? '1px solid var(--moni-navy-800)' : undefined,
                outlineOffset: isRowKanban ? '-1px' : undefined,
                zIndex: isRowKanban ? 1 : 0,
              }}
              title={etapa.label}
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
      <div className="mt-0.5 grid grid-cols-3 gap-0.5 text-[9px] leading-tight">
        {ESTEIRA_TRES_ETAPAS.map((etapa) => (
          <span
            key={etapa.id}
            className="truncate text-center"
            style={{ color: 'var(--moni-text-tertiary)' }}
            title={etapa.label}
          >
            {etapa.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Sub-esteiras dos funis paralelos do mesmo projeto (grid 3 colunas). */
export function PipelineSubesteirasParalelasGrid({
  card,
  siblingCards,
  enrichment,
  heightPxSub = 5,
  className,
}: {
  card: PipelineCardDisplay;
  siblingCards?: PipelineCardDisplay[];
  enrichment?: PipelineFranqueadoraEnrichment | null;
  heightPxSub?: number;
  className?: string;
}) {
  const siblings = siblingCards ?? [card];
  const relacionados = cardsRelacionadosProjeto(card, siblings);
  const subLinhas = linhasSubesteiraParalelaDoGrupo(relacionados);

  if (subLinhas.length === 0) return null;

  return (
    <div className={className}>
      <div className="grid grid-cols-3 gap-x-0.5 gap-y-1.5">
        {subLinhas.map((linha) => {
          const rowCard =
            linha.kanbanIds
              .map((kid) => resolverCardFunilNoGrupoParalelo(kid, card, siblings))
              .find(Boolean) ?? card;

          return (
            <div key={linha.id} style={{ gridColumn: gridColumnSubesteiraParalela(linha.kanbanIds) }}>
              {linha.kanbanIds.length === 1 ? (
                <p
                  className="mb-0.5 truncate text-[9px] font-medium"
                  style={{ color: 'var(--moni-text-tertiary)' }}
                  title={linha.label}
                >
                  {linha.label}
                </p>
              ) : null}
              <PipelineEsteiraParalelosLinha
                card={rowCard}
                siblingCards={siblings}
                enrichment={enrichment}
                kanbanIds={linha.kanbanIds}
                heightPx={heightPxSub}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Esteira principal (3 funis) + sub-esteiras dos funis paralelos do mesmo projeto. */
export function PipelineEsteiraPrincipalComSubesteiras({
  card,
  siblingCards,
  enrichment,
  className,
  heightPxPrincipal = 8,
  heightPxSub = 5,
  mostrarSubesteiras = true,
}: {
  card: PipelineCardDisplay;
  siblingCards?: PipelineCardDisplay[];
  enrichment?: PipelineFranqueadoraEnrichment | null;
  className?: string;
  heightPxPrincipal?: number;
  heightPxSub?: number;
  /** Quando false, só a esteira principal (3 funis) é exibida. */
  mostrarSubesteiras?: boolean;
}) {
  const siblings = siblingCards ?? [card];

  return (
    <div className={className}>
      <PipelineEsteiraTresFunis
        card={card}
        siblingCards={siblings}
        enrichment={enrichment}
        heightPx={heightPxPrincipal}
      />

      {mostrarSubesteiras ? (
        <PipelineSubesteirasParalelasGrid
          card={card}
          siblingCards={siblings}
          enrichment={enrichment}
          heightPxSub={heightPxSub}
          className="mt-2"
        />
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
  const isParalelo = isFunilParaleloEsteira(card.kanban_id);

  return (
    <div className={className}>
      <EsteiraMainTrack
        card={card}
        enrichment={enrichment}
        heightPx={6}
        siblingCards={siblingCards}
        showParaleloLabel={isParalelo}
      />
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

  return (
    <div className={className}>
      <PipelineEsteiraPrincipalComSubesteiras
        card={principal}
        enrichment={enrichment}
        siblingCards={cards}
        heightPxPrincipal={6}
        heightPxSub={4}
      />
    </div>
  );
}

/** Esteira sequencial de funis paralelos (ex.: Acoplamento + Projetos Legais na mesma linha). */
export function PipelineEsteiraParalelosLinha({
  card,
  siblingCards,
  enrichment,
  kanbanIds,
  labels,
  className,
  heightPx = 6,
}: {
  card: PipelineCardDisplay;
  siblingCards?: PipelineCardDisplay[];
  enrichment?: PipelineFranqueadoraEnrichment | null;
  kanbanIds: readonly string[];
  labels?: readonly string[];
  className?: string;
  heightPx?: number;
}) {
  const siblings = siblingCards ?? [card];
  const maxMap = enrichment?.maxOrdemPorKanban;

  const segmentCards = kanbanIds.map((kid) => {
    const pid = idProjetoNegocioPipelineCard(card);
    const pool = pid
      ? siblings.filter((c) => idProjetoNegocioPipelineCard(c) === pid)
      : siblings;
    const found = pool.find((c) => c.kanban_id === kid);
    if (found) return found;
    if (card.kanban_id === kid) return card;
    return null;
  });

  const segmentLabels = kanbanIds.map(
    (kid, idx) => labels?.[idx] ?? configFunilParaleloEsteira(kid)?.label ?? kid,
  );

  return (
    <div className={className}>
      {kanbanIds.length > 1 ? (
        <div className="mb-0.5 flex gap-0.5">
          {kanbanIds.map((kid, idx) => (
            <span
              key={kid}
              className="min-w-0 flex-1 truncate text-center text-[9px] font-medium leading-tight"
              style={{ color: 'var(--moni-text-tertiary)' }}
              title={segmentLabels[idx]}
            >
              {segmentLabels[idx]}
            </span>
          ))}
        </div>
      ) : null}
      <div
        className="flex overflow-hidden rounded-full"
        style={{ background: 'var(--moni-rede-chart-track)', height: `${heightPx}px` }}
      >
        {kanbanIds.map((kid, idx) => {
          const segCard = segmentCards[idx];
          const isRowKanban = card.kanban_id === kid;
          const isAtual = Boolean(segCard && isRowKanban);
          let estado: SegmentEstado = 'futura';
          let width = '0%';

          if (segCard) {
            const dias = calcularDiasNaFase(segCard);
            if (slaCategoriaPipeline(segCard) === 'atrasado') estado = 'atual_atrasado';
            else if (dias >= PARADO_DIAS && segCard.inativo) estado = 'atual_parado';
            else if (badgeStatusPipelineCard(segCard) === 'alerta') estado = 'atual_alerta';
            else estado = 'atual_ok';
            width = `${Math.round(ratioFaseNoKanban(segCard, maxMap) * 100)}%`;
          }

          const fill = SEGMENT_FILL[estado];
          const label = segmentLabels[idx];

          return (
            <div
              key={kid}
              className="relative min-w-0 flex-1"
              style={{
                borderRight: idx < kanbanIds.length - 1 ? '0.5px solid var(--moni-border-default)' : undefined,
                outline: isAtual ? '1px solid var(--moni-navy-800)' : undefined,
                outlineOffset: isAtual ? '-1px' : undefined,
                zIndex: isAtual ? 1 : 0,
              }}
              title={label}
            >
              <div
                className="absolute inset-y-0 left-0 transition-all"
                style={{
                  width: segCard ? width : '0%',
                  background: fill,
                  opacity: segCard ? 0.92 : 1,
                }}
              />
            </div>
          );
        })}
      </div>
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
  return card.sla.label || '—';
}
