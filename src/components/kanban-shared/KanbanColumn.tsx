'use client';

import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useMemo, useRef, useState, useTransition, type DragEvent } from 'react';
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
import { ResponsavelFaseAvatar } from './ResponsavelFaseAvatar';
import {
  calcularCorDataTexto,
  labelRelativoData,
} from '@/lib/kanban/kanban-card-datas';
import { FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import {
  cardLoteadoresPrecisaJustificativaSla,
  faseLoteadoresExigeJustificativaSla,
} from '@/lib/kanban/loteadores-sla-justificativa';
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
  userRole,
  columnAccent = 'var(--moni-kanban-stepone)',
  kanbanId,
  kanbanNome,
  hipotesesOrdemMin = null,
  dragEnabled = false,
}: KanbanColumnProps) {
  const faseSlug = fase.slug?.trim() ?? '';
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const suppressClickRef = useRef(false);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [dragInsertBefore, setDragInsertBefore] = useState(true);
  const [columnDragOver, setColumnDragOver] = useState(false);

  const accent = useMemo(() => columnAccent, [columnAccent]);
  const dndAtivo = dragEnabled && !pending;

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
      className="moni-kanban-column w-80 shrink-0 overflow-hidden rounded-xl bg-white shadow-sm"
      style={{
        border: '0.5px solid var(--moni-border-default)',
        borderTop: `3px solid ${accent}`,
        outline: columnDragOver && dndAtivo ? '2px solid var(--moni-navy-300)' : undefined,
        outlineOffset: columnDragOver && dndAtivo ? '-2px' : undefined,
      }}
    >
      <div
        className="border-b px-4 py-3"
        style={{
          background: 'var(--moni-navy-50)',
          borderBottom: '0.5px solid var(--moni-border-default)',
        }}
      >
        <h2 className="font-semibold" style={{ color: 'var(--moni-navy-800)' }}>
          {fase.nome}
        </h2>
        <div className="mt-0.5 flex items-center justify-between">
          <p className="text-xs" style={{ color: 'var(--moni-navy-600)' }}>
            {cards.length} card(s)
          </p>
          {fase.sla_dias ? (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                background: 'rgba(255, 255, 255, 0.7)',
                color: 'var(--moni-navy-800)',
                border: '0.5px solid var(--moni-navy-200)',
              }}
            >
              SLA: {fase.sla_dias}d
            </span>
          ) : null}
        </div>
      </div>

      <div
        className="max-h-[70vh] space-y-2 overflow-y-auto p-3"
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
          });
          const arquivado = cardArquivadoVisual(card);
          const concluido = cardConcluidoVisual(card);
          const motivo = (card.motivo_arquivamento ?? '').trim();
          const opacidadeCard = arquivado || concluido ? 'opacity-60' : '';
          const hasAvatar = Boolean(card.responsavel_fase_nome?.trim());
          const hasBadge = arquivado || concluido;
          const paddingTitulo = hasBadge && hasAvatar ? 'pr-24' : hasBadge ? 'pr-20' : hasAvatar ? 'pr-8' : '';
          const podeArrastar = dndAtivo;
          const insertBeforeThis =
            dragOverCardId === card.id && dragInsertBefore && dndAtivo;

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
            },
            { labelsCompletos: false },
          );

          return (
            <div key={card.id} className="relative">
              {insertBeforeThis ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-1 left-0 right-0 z-10 h-0.5 rounded-full"
                  style={{ background: 'var(--moni-navy-500)' }}
                />
              ) : null}
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
                className={`relative block w-full p-3 text-left shadow-sm transition hover:shadow-md ${opacidadeCard} ${
                  pending ? 'pointer-events-none opacity-70' : ''
                } ${podeArrastar ? 'cursor-grab active:cursor-grabbing' : ''}`}
                style={{
                  border: arquivado
                    ? '1px dashed var(--moni-status-archived-border)'
                    : concluido
                      ? '1px dashed var(--moni-green-400)'
                      : dragOverCardId === card.id && !dragInsertBefore && dndAtivo
                        ? '2px solid var(--moni-navy-300)'
                        : '0.5px solid var(--moni-border-default)',
                  borderRadius: 'var(--moni-radius-lg)',
                  background: 'var(--moni-surface-0)',
                }}
              >
                {dndAtivo ? (
                  <div className="absolute left-2 top-2 z-10 flex flex-col gap-0">
                    <button
                      type="button"
                      disabled={!vizinhoAcimaId || pending}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleReorder(card, 'up', i, vizinhoAcimaId);
                      }}
                      className="rounded p-0.5 text-stone-400 hover:bg-stone-200 hover:text-stone-700 disabled:pointer-events-none disabled:opacity-30"
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
                      className="rounded p-0.5 text-stone-400 hover:bg-stone-200 hover:text-stone-700 disabled:pointer-events-none disabled:opacity-30"
                      title="Mover para baixo na coluna"
                      aria-label="Mover card para baixo na coluna"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    if (suppressClickRef.current) return;
                    router.push(hrefAbrirCard(basePath, card.id, cardQueryParam, card.origem));
                  }}
                  className={`block w-full text-left ${dndAtivo ? 'pl-7' : ''}`}
                >
                {hasBadge || hasAvatar ? (
                  <div className="absolute right-2 top-2 z-10 flex items-center justify-end gap-1.5">
                    {arquivado ? (
                      <span
                        className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                        style={{
                          background: 'var(--moni-status-archived-bg)',
                          color: 'var(--moni-status-archived-text)',
                          border: '0.5px solid var(--moni-status-archived-border)',
                        }}
                      >
                        ARQUIVADO
                      </span>
                    ) : concluido ? (
                      <span
                        className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                        style={{
                          background: 'var(--moni-green-50)',
                          color: 'var(--moni-green-800)',
                          border: '0.5px solid var(--moni-green-400)',
                        }}
                      >
                        CONCLUÍDO
                      </span>
                    ) : null}
                    <ResponsavelFaseAvatar nome={card.responsavel_fase_nome} />
                  </div>
                ) : null}
                <p className={`line-clamp-2 text-sm font-medium text-stone-800 ${paddingTitulo}`}>{card.titulo}</p>
                <KanbanParalelasChips chips={chipsParalelas} compact />
                {arquivado && motivo ? (
                  <p className="mt-1 line-clamp-2 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                    {motivo}
                  </p>
                ) : null}
                {card.subtitulo ? (
                  <p className="mt-1 line-clamp-1 text-xs text-stone-500">{card.subtitulo}</p>
                ) : card.profiles?.full_name ? (
                  <p className="mt-1 line-clamp-1 text-xs text-stone-500">{card.profiles.full_name}</p>
                ) : null}
                {card.data_reuniao || card.data_followup ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {card.data_reuniao ? (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${calcularCorDataTexto(card.data_reuniao)}`}
                        style={{ background: 'var(--moni-surface-50)', border: '0.5px solid var(--moni-border-subtle)' }}
                      >
                        Reunião: {labelRelativoData(card.data_reuniao)}
                      </span>
                    ) : null}
                    {card.data_followup ? (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${calcularCorDataTexto(card.data_followup)}`}
                        style={{ background: 'var(--moni-surface-50)', border: '0.5px solid var(--moni-border-subtle)' }}
                      >
                        Follow-up: {labelRelativoData(card.data_followup)}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {!arquivado && !concluido && aguardandoDoc ? (
                  <span className={`mt-1 inline-block ${CLASSE_TAG_AGUARDANDO_DOCUMENTACAO}`}>
                    {TAG_AGUARDANDO_DOCUMENTACAO}
                  </span>
                ) : null}
                {!arquivado && !concluido && !aguardandoDoc && sla.label && sla.status !== 'ok' ? (
                  <span className={`mt-1 inline-block ${sla.classe}`}>{sla.label}</span>
                ) : null}
                </button>
              </div>
            </div>
          );
        })}
        {cards.length === 0 ? (
          <p className="py-6 text-center text-xs text-stone-400">
            {listaVaziaPorFiltro ? 'Nenhum card com os filtros atuais' : 'Nenhum card'}
          </p>
        ) : null}
      </div>
    </div>
  );
}
