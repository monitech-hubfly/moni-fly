'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpDown, ChevronDown, ChevronUp, MessageCircle, MoreHorizontal } from 'lucide-react';
import { useRef, useState, useTransition, useEffect, useCallback, type DragEvent } from 'react';
import {
  desvincularTagCard,
} from '@/lib/actions/card-actions';
import {
  calcularSlaKanbanCard,
  creditoObraAguardandoDocumentacao,
  CLASSE_TAG_AGUARDANDO_DOCUMENTACAO,
  TAG_AGUARDANDO_DOCUMENTACAO,
} from '@/lib/kanban/kanban-card-sla';
import {
  moverCardKanbanDrag,
  reordenarCardKanbanDrag,
  type KanbanDnDCardOrigem,
} from '@/lib/actions/kanban-board-dnd';
import {
  flagsParalelasFromCard,
  montarChipsParalelas,
} from '@/lib/kanban/kanban-paralelas-chips';
import { KanbanParalelasChips } from './KanbanParalelasChips';
import { KanbanCardPrazoIndicadores } from './KanbanCardPrazoIndicadores';
import { KanbanCardBoardTags } from './KanbanCardBoardTags';
import { ResponsavelFaseAvatar } from './ResponsavelFaseAvatar';
import { rotuloUnidadeSla } from '@/lib/dias-uteis';
import { FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import {
  cardLoteadoresPrecisaJustificativaSla,
  faseLoteadoresExigeJustificativaSla,
} from '@/lib/kanban/loteadores-sla-justificativa';
import { fundingTipoBadgeClass } from '@/lib/kanban/funding-card-fields';
import { FundingAtividadeDot } from './FundingAtividadeDot';
import type { KanbanCardBrief, KanbanFase } from './types';

export type KanbanColumnProps = {
  fase: KanbanFase;
  cards: KanbanCardBrief[];
  /** Coluna tinha cards no pool atual, mas nenhum passou nos filtros do board. */
  listaVaziaPorFiltro?: boolean;
  /** Ex.: `/funil-stepone` — abre o modal com `?card=` */
  basePath: string;
  /** Query param do card (padrão `card`). */
  cardQueryParam?: string;
  userRole: string;
  /** Cor da faixa superior da coluna (CSS). */
  columnAccent?: string;
  kanbanId: string;
  kanbanNome?: string;
  /** Ordem mínima da fase Hipóteses (Step One). */
  hipotesesOrdemMin?: number | null;
  /** Habilita arrastar cards entre fases e reordenar na coluna. */
  dragEnabled?: boolean;
  /** Contagem de comentários por card_id — quando fornecido, exibe balão no card. */
  comentariosCountPorCard?: Record<string, number>;
  /** Última fase ativa do funil (header com tom distinto). */
  isUltimaFaseAtiva?: boolean;
  /** Botão «Adicionar card» no rodapé da coluna (primeira fase). */
  exibirAdicionarCard?: boolean;
  /** Href do modal de novo card (`?novo=true`). */
  novoCardHref?: string;
};

type DragPayload = {
  cardId: string;
  fromFaseId: string;
  fromFaseSlug: string;
  origem: KanbanDnDCardOrigem;
  kanbanId?: string;
  created_at?: string;
  entered_fase_at?: string | null;
  sla_iniciado_em?: string | null;
  alvara_url?: string | null;
  docs_terreno_url?: string | null;
  sla_justificativa?: string | null;
  fromFaseSlaDias?: number | null;
  fromFaseSlaTipo?: 'uteis' | 'corridos' | null;
};

function hrefAbrirCard(
  basePath: string,
  cardId: string,
  param: string,
  origem?: KanbanCardBrief['origem'],
) {
  const [path, qs] = basePath.split('?');
  const sp = new URLSearchParams(qs ?? '');
  sp.delete('tab');
  sp.set(param, cardId);
  if (origem === 'legado') {
    sp.set('origem', 'legado');
  } else {
    sp.delete('origem');
  }
  const tail = sp.toString();
  return tail ? `${path}?${tail}` : `${path}?${param}=${encodeURIComponent(cardId)}`;
}

function cardArquivadoVisual(card: KanbanCardBrief): boolean {
  return card.origem !== 'legado' && Boolean(card.arquivado);
}

function cardConcluidoVisual(card: KanbanCardBrief): boolean {
  return card.origem !== 'legado' && Boolean(card.concluido);
}

function parseDragPayload(raw: string): DragPayload | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<DragPayload>;
    const cardId = String(data.cardId ?? '').trim();
    const fromFaseId = String(data.fromFaseId ?? '').trim();
    if (!cardId || !fromFaseId) return null;
    return {
      cardId,
      fromFaseId,
      fromFaseSlug: String(data.fromFaseSlug ?? '').trim(),
      origem: data.origem === 'legado' ? 'legado' : 'nativo',
      kanbanId: data.kanbanId != null ? String(data.kanbanId) : undefined,
      created_at: data.created_at != null ? String(data.created_at) : undefined,
      entered_fase_at: data.entered_fase_at ?? null,
      sla_iniciado_em: data.sla_iniciado_em ?? null,
      alvara_url: data.alvara_url ?? null,
      docs_terreno_url: data.docs_terreno_url ?? null,
      sla_justificativa: data.sla_justificativa ?? null,
      fromFaseSlaDias: data.fromFaseSlaDias ?? null,
      fromFaseSlaTipo: data.fromFaseSlaTipo ?? null,
    };
  } catch {
    return null;
  }
}

export function KanbanColumn({
  fase,
  cards,
  listaVaziaPorFiltro = false,
  basePath,
  cardQueryParam = 'card',
  userRole: _userRole,
  columnAccent: _columnAccent = 'var(--moni-kanban-stepone)',
  kanbanId,
  kanbanNome,
  hipotesesOrdemMin = null,
  dragEnabled = false,
  isUltimaFaseAtiva = false,
  exibirAdicionarCard = false,
  novoCardHref = '',
  comentariosCountPorCard,
}: KanbanColumnProps) {
  const faseSlug = fase.slug?.trim() ?? '';
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const suppressClickRef = useRef(false);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [dragInsertBefore, setDragInsertBefore] = useState(true);
  const [columnDragOver, setColumnDragOver] = useState(false);
  const [tagsRemovidas, setTagsRemovidas] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setTagsRemovidas(new Set());
  }, [cards]);

  const removerTagDoCard = useCallback(
    (cardTagId: string) => {
      const id = cardTagId.trim();
      if (!id) return;
      setTagsRemovidas((prev) => new Set(prev).add(id));
      startTransition(async () => {
        const res = await desvincularTagCard(id, basePath);
        if (!res.ok) {
          setTagsRemovidas((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          window.alert(`Não foi possível remover a tag: ${res.error}`);
          return;
        }
        router.refresh();
      });
    },
    [basePath, router],
  );

  const tagsVisiveisCard = useCallback(
    (card: KanbanCardBrief) =>
      (card.tagsCard ?? []).filter((t) => t.id && !tagsRemovidas.has(t.id)),
    [tagsRemovidas],
  );

  const dndAtivo = dragEnabled && !pending;
  const subtituloFase = (fase.instrucoes ?? '').trim();
  const isFunding = kanbanId === KANBAN_IDS.FUNDING || kanbanId === KANBAN_IDS.MONI_CAPITAL;

  const abrirCard = (card: KanbanCardBrief) => {
    if (suppressClickRef.current) return;
    router.push(hrefAbrirCard(basePath, card.id, cardQueryParam, card.origem));
  };

  const handleDragOverColumn = (e: DragEvent<HTMLDivElement>) => {
    if (!dndAtivo) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setColumnDragOver(true);
  };

  const handleDragLeaveColumn = (e: DragEvent<HTMLDivElement>) => {
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) return;
    setColumnDragOver(false);
    setDragOverCardId(null);
  };

  const handleCardDragOver = (e: DragEvent<HTMLElement>, cardId: string) => {
    if (!dndAtivo) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOverCardId(cardId);
    setDragInsertBefore(e.clientY < rect.top + rect.height / 2);
    setColumnDragOver(true);
  };

  const executarDrop = (payload: DragPayload, beforeCardId: string | null) => {
    startTransition(() => {
      void (async () => {
        const origem = payload.origem;
        const mesmaFase = payload.fromFaseId === fase.id;

        if (mesmaFase) {
          if (beforeCardId === payload.cardId) return;
          const res = await reordenarCardKanbanDrag({
            cardId: payload.cardId,
            faseId: fase.id,
            faseSlug: faseSlug || null,
            beforeCardId,
            origem,
            basePath,
          });
          if (!res.ok) {
            alert(res.error ?? 'Não foi possível reordenar o card.');
            return;
          }
        } else {
          let motivoParalisado: string | undefined;
          let justificativaSla: string | undefined;
          const destSlug = (faseSlug || '').trim();
          if (destSlug === FASE_SLUGS.ACOPLAMENTO_REPROVADO && basePath.includes('funil-acoplamento')) {
            const motivo = window.prompt(
              'Informe o motivo da paralisação antes de mover o card para Paralisados:',
            );
            if (motivo == null) return;
            const m = motivo.trim();
            if (!m) {
              alert('Informe o motivo da paralisação.');
              return;
            }
            motivoParalisado = m;
          }
          const fromSlug = (payload.fromFaseSlug || '').trim();
          if (
            origem === 'nativo' &&
            String(payload.kanbanId ?? kanbanId) === KANBAN_IDS.LOTEADORES &&
            faseLoteadoresExigeJustificativaSla(fromSlug) &&
            payload.created_at
          ) {
            const slaOrigem = calcularSlaKanbanCard({
              created_at: payload.created_at,
              entered_fase_at: payload.entered_fase_at,
              sla_iniciado_em: payload.sla_iniciado_em,
              faseSlug: fromSlug,
              alvara_url: payload.alvara_url,
              docs_terreno_url: payload.docs_terreno_url,
              sla_dias: payload.fromFaseSlaDias ?? null,
              sla_tipo: payload.fromFaseSlaTipo ?? null,
            });
            if (
              cardLoteadoresPrecisaJustificativaSla({
                kanbanId: payload.kanbanId ?? kanbanId,
                faseSlug: fromSlug,
                slaStatus: slaOrigem.status,
                slaJustificativa: payload.sla_justificativa,
                sla_dias: payload.fromFaseSlaDias ?? null,
              })
            ) {
              const motivo = window.prompt(
                'O SLA desta fase está vencido. Informe a justificativa da quebra de SLA antes de mover o card:',
              );
              if (motivo == null) return;
              const m = motivo.trim();
              if (!m) {
                alert('Informe a justificativa da quebra de SLA.');
                return;
              }
              justificativaSla = m;
            }
          }
          const resMove = await moverCardKanbanDrag({
            cardId: payload.cardId,
            toFaseId: fase.id,
            toFaseSlug: faseSlug || null,
            fromFaseSlug: payload.fromFaseSlug || null,
            origem,
            basePath,
            kanbanNome: typeof kanbanNome === 'string' ? kanbanNome : undefined,
            motivoReprovacaoAcoplamento: motivoParalisado,
            justificativaSlaQuebra: justificativaSla,
          });
          if (!resMove.ok) {
            alert(resMove.error ?? 'Não foi possível mover o card.');
            return;
          }
          if (beforeCardId && beforeCardId !== payload.cardId) {
            const resOrd = await reordenarCardKanbanDrag({
              cardId: payload.cardId,
              faseId: fase.id,
              faseSlug: faseSlug || null,
              beforeCardId,
              origem,
              basePath,
            });
            if (!resOrd.ok) {
              alert(resOrd.error ?? 'Card movido, mas não foi possível definir a posição.');
              router.refresh();
              return;
            }
          }
        }
        router.refresh();
      })();
    });
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, beforeCardId: string | null) => {
    if (!dndAtivo) return;
    e.preventDefault();
    e.stopPropagation();
    setColumnDragOver(false);
    setDragOverCardId(null);

    const payload = parseDragPayload(e.dataTransfer.getData('application/json'));
    if (!payload) return;
    executarDrop(payload, beforeCardId);
  };

  const handleReorder = (
    card: KanbanCardBrief,
    dir: 'up' | 'down',
    cardIndex: number,
    vizinhoAcimaId: string | undefined,
  ) => {
    if (!dndAtivo || pending) return;
    let beforeCardId: string | null;
    if (dir === 'up') {
      if (!vizinhoAcimaId) return;
      beforeCardId = vizinhoAcimaId;
    } else {
      if (cardIndex >= cards.length - 1) return;
      beforeCardId = cardIndex + 2 < cards.length ? cards[cardIndex + 2]?.id ?? null : null;
    }
    startTransition(() => {
      void (async () => {
        const res = await reordenarCardKanbanDrag({
          cardId: card.id,
          faseId: fase.id,
          faseSlug: faseSlug || null,
          beforeCardId,
          origem: card.origem === 'legado' ? 'legado' : 'nativo',
          basePath,
        });
        if (!res.ok) {
          alert(res.error ?? 'Não foi possível reordenar o card.');
          return;
        }
        router.refresh();
      })();
    });
  };

  return (
    <div
      className={`moni-kanban-column${isUltimaFaseAtiva ? ' moni-kanban-column--fin' : ''}${columnDragOver && dndAtivo ? ' moni-kanban-column--drag-over' : ''}`}
    >
      <div
        className={`moni-kanban-column-hd ${isUltimaFaseAtiva ? 'moni-kanban-column-hd--fin' : ''}`}
      >
        <div className="moni-kanban-column-hd-top">
          <div className="moni-kanban-column-hd-text">
            <h2 className="moni-kanban-column-title">{fase.nome}</h2>
            {subtituloFase ? (
              <p className="moni-kanban-column-subtitle">{subtituloFase}</p>
            ) : null}
          </div>
          <div className="moni-kanban-column-hd-actions">
            <span className="moni-kanban-col-count" aria-label={`${cards.length} cards`}>
              {cards.length}
            </span>
            {fase.sla_dias ? (
              <span className="moni-kanban-col-sla">
                {fase.sla_dias}d {rotuloUnidadeSla(fase.sla_tipo)}
              </span>
            ) : null}
            <button
              type="button"
              className="moni-kanban-col-sort"
              aria-hidden
              tabIndex={-1}
              title="Ordenação da coluna"
            >
              <ArrowUpDown className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      <div
        className="moni-kanban-column-body"
        onDragOver={handleDragOverColumn}
        onDragLeave={handleDragLeaveColumn}
        onDrop={(e) => handleDrop(e, null)}
      >
        {cards.map((card, i) => {
          const vizinhoAcimaId = i > 0 ? cards[i - 1]?.id : undefined;
          const vizinhoAbaixoId = i < cards.length - 1 ? cards[i + 1]?.id : undefined;
          const faseSlugCard = fase.slug ?? '';
          const aguardandoDoc =
            card.origem !== 'legado' &&
            creditoObraAguardandoDocumentacao({
              faseSlug: faseSlugCard,
              alvara_url: card.alvara_url,
              docs_terreno_url: card.docs_terreno_url,
            });
          const sla = calcularSlaKanbanCard({
            created_at: card.created_at,
            entered_fase_at: card.entered_fase_at,
            sla_iniciado_em: card.sla_iniciado_em,
            faseSlug: faseSlugCard,
            alvara_url: card.alvara_url,
            docs_terreno_url: card.docs_terreno_url,
            sla_dias: fase.sla_dias,
            sla_tipo: fase.sla_tipo,
          });
          const arquivado = cardArquivadoVisual(card);
          const concluido = cardConcluidoVisual(card);
          const motivo = (card.motivo_arquivamento ?? '').trim();
          const hasAvatar = Boolean(card.responsavel_fase_nome?.trim());
          const hasBadge = arquivado || concluido;
          const paddingTitulo = hasBadge || hasAvatar ? 'pr-14' : '';
          const podeArrastar = dndAtivo;
          const insertBeforeThis =
            dragOverCardId === card.id && dragInsertBefore && dndAtivo;
          const subtituloCard =
            card.subtitulo?.trim() || card.profiles?.full_name?.trim() || '';

          const chipsParalelas = montarChipsParalelas(
            {
              kanbanId,
              faseSlug,
              faseNome: fase.nome,
              faseOrdem: fase.ordem,
              hipotesesOrdemMin,
              origem: card.origem,
              flags: flagsParalelasFromCard(card),
              portfolioVinculoRotulo: card.portfolio_vinculo_rotulo,
              temFilhoJuridico: card.tem_filho_juridico,
              temFilhoAcoplamento: card.tem_filho_acoplamento,
              filhoAcoplamentoArquivado: card.filho_acoplamento_arquivado,
              temFilhoOperacoes: card.tem_filho_operacoes,
              filhoOperacoesArquivado: card.filho_operacoes_arquivado,
              operacoesFilhoConcluido: card.operacoes_filho_concluido,
              operacoesFilhoFaseRotulo: card.operacoes_filho_fase_rotulo,
              juridicoFilhoFaseRotulo: card.juridico_filho_fase_nome,
            },
            { labelsCompletos: false },
          );

          return (
            <div key={card.id} className="moni-kanban-card-wrap">
              {insertBeforeThis ? <div aria-hidden className="moni-kanban-card-drop-line" /> : null}
              <div
                draggable={podeArrastar}
                onDragStart={(e) => {
                  if (!podeArrastar) {
                    e.preventDefault();
                    return;
                  }
                  suppressClickRef.current = true;
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData(
                    'application/json',
                    JSON.stringify({
                      cardId: card.id,
                      fromFaseId: fase.id,
                      fromFaseSlug: faseSlug,
                      origem: card.origem === 'legado' ? 'legado' : 'nativo',
                      kanbanId: card.kanban_id ?? kanbanId,
                      created_at: card.created_at,
                      entered_fase_at: card.entered_fase_at ?? null,
                      sla_iniciado_em: card.sla_iniciado_em ?? null,
                      alvara_url: card.alvara_url ?? null,
                      docs_terreno_url: card.docs_terreno_url ?? null,
                      sla_justificativa: (card as { sla_justificativa?: string | null }).sla_justificativa ?? null,
                      fromFaseSlaDias: fase.sla_dias ?? null,
                      fromFaseSlaTipo: fase.sla_tipo ?? null,
                    } satisfies DragPayload),
                  );
                }}
                onDragEnd={() => {
                  setColumnDragOver(false);
                  setDragOverCardId(null);
                  window.setTimeout(() => {
                    suppressClickRef.current = false;
                  }, 0);
                }}
                onDragOver={(e) => handleCardDragOver(e, card.id)}
                onDrop={(e) => {
                  if (!dndAtivo) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setColumnDragOver(false);
                  setDragOverCardId(null);
                  const payload = parseDragPayload(e.dataTransfer.getData('application/json'));
                  if (!payload) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const before = e.clientY < rect.top + rect.height / 2;
                  const beforeCardId = before ? card.id : cards[i + 1]?.id ?? null;
                  executarDrop(payload, beforeCardId);
                }}
                className={[
                  'moni-kanban-card',
                  arquivado ? 'moni-kanban-card--archived' : '',
                  concluido ? 'moni-kanban-card--done' : '',
                  arquivado || concluido ? 'moni-kanban-card--muted' : '',
                  pending ? 'moni-kanban-card--pending' : '',
                  podeArrastar ? 'moni-kanban-card--draggable' : '',
                  dragOverCardId === card.id && !dragInsertBefore && dndAtivo
                    ? 'moni-kanban-card--drag-target'
                    : '',
                  chipsParalelas.length > 0 ? 'moni-kanban-card--com-paralelas' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {dndAtivo ? (
                  <div className="moni-kanban-card-sort">
                    <button
                      type="button"
                      disabled={!vizinhoAcimaId || pending}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleReorder(card, 'up', i, vizinhoAcimaId);
                      }}
                      className="moni-kanban-card-sort-btn"
                      title="Mover para cima na coluna"
                      aria-label="Mover card para cima na coluna"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={!vizinhoAbaixoId || pending}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleReorder(card, 'down', i, vizinhoAcimaId);
                      }}
                      className="moni-kanban-card-sort-btn"
                      title="Mover para baixo na coluna"
                      aria-label="Mover card para baixo na coluna"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
                {chipsParalelas.length > 0 ? (
                  <KanbanParalelasChips chips={chipsParalelas} mode="board" />
                ) : null}
                <button
                  type="button"
                  onClick={() => abrirCard(card)}
                  className="moni-kanban-card-menu"
                  aria-label="Abrir card"
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden />
                </button>
                {comentariosCountPorCard && (comentariosCountPorCard[card.id] ?? 0) > 0 ? (
                  <button
                    type="button"
                    onClick={() => abrirCard(card)}
                    className="absolute bottom-2 left-2 z-10 inline-flex items-center gap-1 rounded border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-1.5 py-0.5 text-[color:var(--moni-text-secondary)] hover:border-[color:var(--moni-border-strong)] hover:text-[color:var(--moni-text-primary)]"
                    aria-label={`${comentariosCountPorCard[card.id]} comentário(s)`}
                  >
                    <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="min-w-[1rem] text-center text-[10px] font-semibold tabular-nums">{comentariosCountPorCard[card.id]}</span>
                  </button>
                ) : null}
                {hasBadge || hasAvatar ? (
                  <div className="moni-kanban-card-badges">
                    {arquivado ? (
                      <span className="moni-kanban-card-status-badge moni-kanban-card-status-badge--archived">
                        ARQUIVADO
                      </span>
                    ) : concluido ? (
                      <span className="moni-kanban-card-status-badge moni-kanban-card-status-badge--done">
                        CONCLUÍDO
                      </span>
                    ) : null}
                    <ResponsavelFaseAvatar nome={card.responsavel_fase_nome} />
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => abrirCard(card)}
                  className={`moni-kanban-card-open ${dndAtivo ? 'moni-kanban-card-open--dnd' : ''}`}
                >
                  <p className={`moni-kanban-card-title ${paddingTitulo}`}>{card.titulo}</p>
                  {(() => {
                    const fundingBadgeCls = fundingTipoBadgeClass(card.funding_tipo);
                    return fundingBadgeCls ? (
                      <span className={`mt-1 inline-block ${fundingBadgeCls}`}>{card.funding_tipo}</span>
                    ) : null;
                  })()}
                  {subtituloCard ? (
                    <p className="moni-kanban-card-subtitle">{subtituloCard}</p>
                  ) : null}
                  {arquivado && motivo ? (
                    <p className="moni-kanban-card-section-value line-clamp-2">{motivo}</p>
                  ) : null}
                  <KanbanCardBoardTags
                    tags={tagsVisiveisCard(card)}
                    className="mt-1"
                    editable
                    onRemoveTag={removerTagDoCard}
                  />
                  {!arquivado && !concluido && aguardandoDoc ? (
                    <span className={`mt-1 inline-block ${CLASSE_TAG_AGUARDANDO_DOCUMENTACAO}`}>
                      {TAG_AGUARDANDO_DOCUMENTACAO}
                    </span>
                  ) : null}
                  {!arquivado && !concluido && !aguardandoDoc ? (
                    <KanbanCardPrazoIndicadores
                      sla={sla}
                      dataReuniao={card.data_reuniao}
                      dataFollowup={card.data_followup}
                    />
                  ) : null}
                </button>
                {isFunding && !arquivado && !concluido ? (
                  <div className="absolute bottom-2 right-2 z-10">
                    <FundingAtividadeDot
                      cardId={card.id}
                      proximaAtividade={card.funding_proxima_atividade ?? null}
                      prazoAtividade={card.funding_prazo_atividade ?? null}
                      basePath={basePath}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
        {cards.length === 0 ? (
          <p className="moni-kanban-column-empty">
            {listaVaziaPorFiltro ? 'Nenhum card com os filtros atuais' : 'Nenhum card'}
          </p>
        ) : null}
        {exibirAdicionarCard && novoCardHref ? (
          <Link href={novoCardHref} className="moni-kanban-add-card">
            + Adicionar card
          </Link>
        ) : null}
      </div>
    </div>
  );
}
