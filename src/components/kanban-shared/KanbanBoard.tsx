'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePermissoes } from '@/lib/hooks/usePermissoes';
import { podeComFallbackStaff } from '@/lib/permissoes-types';
import { KanbanBoardFiltrosPanel } from './KanbanBoardFiltrosPanel';
import { KanbanColumn } from './KanbanColumn';
import {
  cardPassaFiltrosBoard,
  cardKanbanMatchBuscaVisivel,
  countKanbanBoardFiltrosAtivos,
  KANBAN_BOARD_FILTROS_DEFAULT,
  poolCardsPorStatus,
  type KanbanBoardFiltros,
} from './kanbanBoardFiltros';
import { hipotesesOrdemMinima } from '@/lib/kanban/kanban-paralelas-chips';
import { sortKanbanCardsPorOrdemColuna } from '@/lib/kanban/kanban-coluna-ordem';
import type { KanbanNomeDisplay } from './types';
import type { KanbanCardBrief, KanbanFase } from './types';

export type KanbanBoardProps = {
  fases: KanbanFase[];
  cards: KanbanCardBrief[];
  /** Nativo: cards com `concluido` (aba STATUS “Concluídos”). */
  cardsConcluidos?: KanbanCardBrief[];
  basePath: string;
  userRole: string;
  columnAccent?: string;
  cardQueryParam?: string;
  /** Para filtro “Eu” (responsável = usuário logado). */
  currentUserId?: string | null;
  /** Exibe o atalho “+ Novo card” (`?novo=true`). Com `podeCriarCards={true}` no pai, ignora matriz no client. */
  mostrarLinkNovoCard?: boolean;
  /** Quando `true`, força exibição; quando `undefined`, usa `usePermissoes`; quando `false`, oculta. */
  podeCriarCards?: boolean;
  /** Quando informado, substitui heurística de `mover_fase` + role. */
  podeMoverCards?: boolean;
  kanbanNome?: KanbanNomeDisplay | string;
  kanbanId: string;
};

export function KanbanBoard({
  fases,
  cards,
  cardsConcluidos = [],
  basePath,
  userRole,
  columnAccent = 'var(--moni-kanban-stepone)',
  cardQueryParam,
  currentUserId = null,
  mostrarLinkNovoCard = false,
  podeCriarCards: podeCriarCardsProp,
  podeMoverCards: podeMoverCardsProp,
  kanbanNome,
  kanbanId,
}: KanbanBoardProps) {
  const hipotesesOrdemMin = useMemo(() => hipotesesOrdemMinima(fases), [fases]);
  const { pode } = usePermissoes();
  const [filtros, setFiltros] = useState<KanbanBoardFiltros>(KANBAN_BOARD_FILTROS_DEFAULT);
  const [filtrosDraft, setFiltrosDraft] = useState<KanbanBoardFiltros>(KANBAN_BOARD_FILTROS_DEFAULT);
  const [buscaCard, setBuscaCard] = useState('');
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const filtrosPopoverRef = useRef<HTMLDivElement>(null);
  const filtrosBtnRef = useRef<HTMLButtonElement>(null);
  const boardScrollRef = useRef<HTMLDivElement>(null);
  const [scrollHintLeft, setScrollHintLeft] = useState(false);
  const [scrollHintRight, setScrollHintRight] = useState(false);

  const syncBoardScrollHints = () => {
    const el = boardScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const overflow = scrollWidth - clientWidth > 8;
    setScrollHintLeft(overflow && scrollLeft > 8);
    setScrollHintRight(overflow && scrollLeft + clientWidth < scrollWidth - 8);
  };

  useEffect(() => {
    syncBoardScrollHints();
    const el = boardScrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', syncBoardScrollHints, { passive: true });
    const ro = new ResizeObserver(syncBoardScrollHints);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', syncBoardScrollHints);
      ro.disconnect();
    };
  }, [fases.length]);

  useEffect(() => {
    if (!filtrosOpen) return;
    const onDown = (ev: MouseEvent) => {
      const t = ev.target as Node;
      if (filtrosPopoverRef.current?.contains(t)) return;
      if (filtrosBtnRef.current?.contains(t)) return;
      setFiltrosDraft({ ...filtros });
      setFiltrosOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [filtrosOpen, filtros]);

  const faseMap = useMemo(() => new Map(fases.map((f) => [f.id, f])), [fases]);

  const responsaveisOpcoes = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of [...cards, ...cardsConcluidos]) {
      const id = c.franqueado_id;
      if (!id) continue;
      const nome = (c.profiles?.full_name ?? '').trim() || 'Sem nome';
      if (!m.has(id)) m.set(id, nome);
    }
    return [...m.entries()]
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [cards, cardsConcluidos]);

  const poolStatus = useMemo(
    () => poolCardsPorStatus(filtros.status, cards, cardsConcluidos),
    [filtros.status, cards, cardsConcluidos],
  );

  const rawByFase = useMemo(() => {
    const m: Record<string, KanbanCardBrief[]> = {};
    for (const f of fases) m[f.id] = [];
    for (const c of poolStatus) {
      if (!m[c.fase_id]) m[c.fase_id] = [];
      m[c.fase_id].push(c);
    }
    return m;
  }, [fases, poolStatus]);

  const cardsFiltrados = useMemo(() => {
    const busca = buscaCard.trim();
    return poolStatus.filter((c) => {
      if (!cardPassaFiltrosBoard(c, filtros, faseMap, currentUserId)) return false;
      if (busca && !cardKanbanMatchBuscaVisivel(c, busca, faseMap)) return false;
      return true;
    });
  }, [poolStatus, filtros, faseMap, currentUserId, buscaCard]);

  const clientFiltersActive =
    countKanbanBoardFiltrosAtivos(filtros) > 0 || buscaCard.trim().length > 0;

  const cardsByFase = useMemo(() => {
    const m: Record<string, KanbanCardBrief[]> = {};
    for (const f of fases) m[f.id] = [];
    for (const c of cardsFiltrados) {
      if (!m[c.fase_id]) m[c.fase_id] = [];
      m[c.fase_id].push(c);
    }
    for (const f of fases) {
      m[f.id] = sortKanbanCardsPorOrdemColuna(m[f.id] ?? []);
    }
    return m;
  }, [fases, cardsFiltrados]);

  const podeMoverCards =
    podeMoverCardsProp ??
    (pode('mover_fase') ||
      userRole === 'admin' ||
      userRole === 'team' ||
      userRole === 'supervisor' ||
      userRole === 'consultor');

  const nAtivos = countKanbanBoardFiltrosAtivos(filtros);
  /** Quando o pai passa `true`, não espera a matriz `criar_cards` no client (evita botão oculto para o time). */
  const criarCardsPermitido =
    podeCriarCardsProp === true ||
    (podeCriarCardsProp !== false &&
      podeComFallbackStaff(pode, 'criar_cards', { roleNorm: userRole }));
  const exibirBotaoNovoCard = Boolean(mostrarLinkNovoCard) && criarCardsPermitido;

  return (
    <div className="min-w-0 space-y-3">
      <div className="relative flex flex-wrap items-center gap-3">
        {exibirBotaoNovoCard ? (
          <Link
            href={`${basePath}?novo=true`}
            className="rounded-lg px-4 py-2 text-sm font-medium transition hover:bg-stone-100"
            style={{
              background: 'var(--moni-surface-0)',
              color: 'var(--moni-text-primary)',
              border: '0.5px solid var(--moni-border-default)',
            }}
          >
            + Novo card
          </Link>
        ) : null}
        <button
          ref={filtrosBtnRef}
          type="button"
          onClick={() => {
            if (filtrosOpen) {
              setFiltrosDraft({ ...filtros });
              setFiltrosOpen(false);
            } else {
              setFiltrosDraft({ ...filtros });
              setFiltrosOpen(true);
            }
          }}
          className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-95"
          style={{
            borderColor: 'var(--moni-border-default)',
            background: 'var(--moni-surface-0)',
            color: 'var(--moni-text-primary)',
          }}
        >
          Filtros ({nAtivos})
        </button>
        <input
          type="search"
          value={buscaCard}
          onChange={(e) => setBuscaCard(e.target.value)}
          placeholder="Buscar no card (título, franqueado, datas, SLA…)…"
          aria-label="Buscar cards por qualquer informação visível no card"
          className="w-64 max-w-full rounded-lg px-3 py-2 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-1"
          style={{
            border: '0.5px solid var(--moni-border-default)',
            background: 'var(--moni-surface-0)',
            color: 'var(--moni-text-primary)',
          }}
        />
        {filtrosOpen ? (
          <div
            ref={filtrosPopoverRef}
            className="absolute left-0 top-full z-50 mt-2 w-[min(100vw-2rem,17.5rem)]"
          >
            <KanbanBoardFiltrosPanel
              draft={filtrosDraft}
              setDraft={setFiltrosDraft}
              fases={fases}
              responsaveisOpcoes={responsaveisOpcoes}
              showFiltroEu={Boolean(currentUserId)}
              onLimpar={() => setFiltrosDraft(KANBAN_BOARD_FILTROS_DEFAULT)}
              onAplicar={() => {
                setFiltros({ ...filtrosDraft });
                setFiltrosOpen(false);
              }}
            />
          </div>
        ) : null}
      </div>

      <div className="relative min-w-0 w-full">
        {scrollHintLeft ? (
          <div
            aria-hidden
            className="moni-kanban-board-scroll-hint pointer-events-none absolute inset-y-0 left-0 z-10 w-10"
          />
        ) : null}
        {scrollHintRight ? (
          <div
            aria-hidden
            className="moni-kanban-board-scroll-hint moni-kanban-board-scroll-hint--right pointer-events-none absolute inset-y-0 right-0 z-10 w-12"
          />
        ) : null}
        <div ref={boardScrollRef} className="moni-kanban-board-scroll w-full min-w-0 overflow-x-auto pb-2">
          <div className="moni-kanban-board flex min-w-max gap-4">
            {fases.map((fase) => {
              const raw = rawByFase[fase.id] ?? [];
              const vis = cardsByFase[fase.id] ?? [];
              const listaVaziaPorFiltro = clientFiltersActive && raw.length > 0 && vis.length === 0;
              return (
                <KanbanColumn
                  key={fase.id}
                  fase={fase}
                  cards={vis}
                  listaVaziaPorFiltro={listaVaziaPorFiltro}
                  basePath={basePath}
                  cardQueryParam={cardQueryParam}
                  userRole={userRole}
                  columnAccent={columnAccent}
                  kanbanId={kanbanId}
                  kanbanNome={kanbanNome}
                  hipotesesOrdemMin={hipotesesOrdemMin}
                  dragEnabled={podeMoverCards}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
