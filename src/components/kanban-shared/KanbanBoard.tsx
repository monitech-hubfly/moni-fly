'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { usePermissoes } from '@/lib/hooks/usePermissoes';
import { podeComFallbackStaff } from '@/lib/permissoes-types';
import { fetchKanbanBoardStatusPool } from '@/lib/actions/kanban-board-snapshot';
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
import { sortKanbanCardsPorProximaAtividade } from '@/lib/kanban/kanban-proxima-atividade-ordem';
import type { KanbanNomeDisplay } from './types';
import type { KanbanCardBrief, KanbanFase } from './types';

const BOARD_ROW_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'nowrap',
  alignItems: 'stretch',
};

function cardEhArquivadoNativo(c: KanbanCardBrief): boolean {
  return c.origem !== 'legado' && Boolean(c.arquivado);
}

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
  /**
   * Nome em `kanbans.nome` para lazy-load de arquivados/concluídos após snapshot lean.
   * Se omitido, usa `kanbanNome` quando for string válida.
   */
  kanbanNomeDb?: string;
  kanbanId: string;
  /**
   * Quando o RSC já trouxe o snapshot completo (`full`), não busca de novo no STATUS.
   * Default: detecta se `cards` já tem arquivados ou `cardsConcluidos` não está vazio.
   */
  snapshotLean?: boolean;
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
  kanbanNomeDb,
  kanbanId,
  snapshotLean,
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

  const nomeDbParaLazy = String(kanbanNomeDb ?? kanbanNome ?? '').trim();
  const leanAtivo =
    snapshotLean ??
    (!cards.some(cardEhArquivadoNativo) && cardsConcluidos.length === 0);

  /** Pools carregados sob demanda (STATUS arquivados / concluídos). */
  const [lazyArquivados, setLazyArquivados] = useState<KanbanCardBrief[] | null>(null);
  const [lazyConcluidos, setLazyConcluidos] = useState<KanbanCardBrief[] | null>(null);
  const [statusPoolLoading, setStatusPoolLoading] = useState(false);
  const [statusPoolError, setStatusPoolError] = useState<string | null>(null);
  const lazyFetchGen = useRef(0);

  /** Assinatura estável: `cards`/`cardsConcluidos` mudam de referência a cada `router.refresh()`. */
  const cardsSnapshotSig = useMemo(
    () =>
      `${cards.map((c) => c.id).join(',')}|${cardsConcluidos.map((c) => c.id).join(',')}`,
    [cards, cardsConcluidos],
  );

  // Refresh do RSC: invalida caches lazy só quando o conjunto de cards realmente muda.
  useEffect(() => {
    setLazyArquivados(null);
    setLazyConcluidos(null);
    setStatusPoolError(null);
  }, [cardsSnapshotSig]);

  useEffect(() => {
    if (!leanAtivo || !nomeDbParaLazy) return;
    const status = filtros.status;
    if (status !== 'arquivados' && status !== 'concluidos') {
      setStatusPoolLoading(false);
      return;
    }
    if (status === 'arquivados' && lazyArquivados != null) {
      setStatusPoolLoading(false);
      return;
    }
    if (status === 'concluidos' && lazyConcluidos != null) {
      setStatusPoolLoading(false);
      return;
    }

    const gen = ++lazyFetchGen.current;
    let cancelled = false;
    setStatusPoolLoading(true);
    setStatusPoolError(null);

    void (async () => {
      const res = await fetchKanbanBoardStatusPool(nomeDbParaLazy, status);
      if (cancelled || gen !== lazyFetchGen.current) return;
      setStatusPoolLoading(false);
      if (!res.ok) {
        setStatusPoolError(res.error);
        return;
      }
      if (status === 'arquivados') {
        setLazyArquivados(res.cards.filter(cardEhArquivadoNativo));
      } else {
        setLazyConcluidos(res.cardsConcluidos);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    leanAtivo,
    nomeDbParaLazy,
    filtros.status,
    lazyArquivados,
    lazyConcluidos,
  ]);

  const cardsEfetivos = useMemo(() => {
    if (!lazyArquivados || lazyArquivados.length === 0) return cards;
    const ids = new Set(cards.map((c) => c.id));
    return [...cards, ...lazyArquivados.filter((c) => !ids.has(c.id))];
  }, [cards, lazyArquivados]);

  const cardsConcluidosEfetivos = lazyConcluidos ?? cardsConcluidos;

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
    for (const c of [...cardsEfetivos, ...cardsConcluidosEfetivos]) {
      const id = c.franqueado_id;
      if (!id) continue;
      const nome = (c.profiles?.full_name ?? '').trim() || 'Sem nome';
      if (!m.has(id)) m.set(id, nome);
    }
    return [...m.entries()]
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [cardsEfetivos, cardsConcluidosEfetivos]);

  const poolStatus = useMemo(
    () => poolCardsPorStatus(filtros.status, cardsEfetivos, cardsConcluidosEfetivos),
    [filtros.status, cardsEfetivos, cardsConcluidosEfetivos],
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
      m[f.id] = sortKanbanCardsPorProximaAtividade(m[f.id] ?? []);
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
  const novoCardHref = `${basePath}?novo=true`;

  const fasesAtivas = useMemo(() => fases.filter((f) => f.ativo !== false), [fases]);
  const ordemMinima = useMemo(
    () => (fasesAtivas.length > 0 ? Math.min(...fasesAtivas.map((f) => f.ordem)) : 1),
    [fasesAtivas],
  );
  const maxOrdemAtiva = useMemo(
    () => (fasesAtivas.length > 0 ? Math.max(...fasesAtivas.map((f) => f.ordem)) : 0),
    [fasesAtivas],
  );

  return (
    <div className="min-w-0 space-y-3">
      <div className="moni-kanban-toolbar relative">
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
          className="moni-kanban-fpill"
        >
          Filtros ({nAtivos})
        </button>
        <input
          type="search"
          value={buscaCard}
          onChange={(e) => setBuscaCard(e.target.value)}
          placeholder="Buscar no card (título, franqueado, datas, SLA…)…"
          aria-label="Buscar cards por qualquer informação visível no card"
          className="moni-kanban-fpill moni-kanban-fpill--search"
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
        {statusPoolLoading ? (
          <span
            className="text-xs"
            style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}
          >
            Carregando {filtros.status === 'arquivados' ? 'arquivados' : 'concluídos'}…
          </span>
        ) : null}
        {statusPoolError ? (
          <span
            className="text-xs"
            style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}
            role="alert"
          >
            {statusPoolError}
          </span>
        ) : null}
      </div>

      <section className="moni-kanban-shell relative min-w-0 w-full" aria-label="Quadro Kanban">
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
        <div ref={boardScrollRef} className="moni-kanban-board-scroll w-full min-w-0">
          <div
            className="moni-kanban-board flex flex-row flex-nowrap items-stretch"
            style={BOARD_ROW_STYLE}
            data-moni-kanban-board="desktop-row"
          >
            {fases.map((fase) => {
              const raw = rawByFase[fase.id] ?? [];
              const vis = cardsByFase[fase.id] ?? [];
              const listaVaziaPorFiltro = clientFiltersActive && raw.length > 0 && vis.length === 0;
              const isPrimeiraColuna = fase.ordem === ordemMinima;
              const isUltimaFaseAtiva = fase.ativo !== false && fase.ordem === maxOrdemAtiva;
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
                  fasesFunil={fasesAtivas}
                  isUltimaFaseAtiva={isUltimaFaseAtiva}
                  exibirAdicionarCard={isPrimeiraColuna && exibirBotaoNovoCard}
                  novoCardHref={novoCardHref}
                />
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
