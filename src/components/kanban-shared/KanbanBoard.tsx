'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { usePermissoes } from '@/lib/hooks/usePermissoes';
import { podeComFallbackStaff } from '@/lib/permissoes-types';
import { fetchKanbanBoardStatusPool } from '@/lib/actions/kanban-board-snapshot';
import { fetchKanbanBoardDeferredEnrichment } from '@/lib/actions/kanban-board-enrichment';
import { fetchKanbanComentariosCountPorCardIds } from '@/lib/actions/kanban-comentarios';
import { fetchKanbanProximasAtividadesPorCardIds } from '@/lib/actions/kanban-proximas-atividades';
import { ExportKanbanButton } from './ExportKanbanButton';
import { KanbanBoardFiltrosPanel } from './KanbanBoardFiltrosPanel';
import { KanbanColumn } from './KanbanColumn';
import {
  cardPassaFiltrosBoard,
  countKanbanBoardFiltrosAtivos,
  KANBAN_BOARD_FILTROS_DEFAULT,
  poolCardsPorStatus,
  cardIdMatchBuscaKanban,
  textoMatchBuscaKanbanPalavras,
  textoVisivelCardKanbanFechado,
  type KanbanBoardFiltros,
} from './kanbanBoardFiltros';
import { hipotesesOrdemMinima } from '@/lib/kanban/kanban-paralelas-chips';
import { sortKanbanCardsPorProximaAtividade } from '@/lib/kanban/kanban-proxima-atividade-ordem';
import type { KanbanNomeDisplay, KanbanCardBrief, KanbanFase, KanbanProximaAtividadeAberta } from './types';
import { isFaseConclusaoKanban } from '@/lib/kanban/kanban-fase-conclusao';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { isMarketingKanbanId, type MarketingFrente } from '@/lib/kanban/funis-marketing';
import { fetchMarketingPerfilDestino } from '@/lib/actions/marketing-kanban';
import {
  MarketingKanbanExtras,
  type MarketingStatusFiltro,
} from './MarketingKanbanExtras';

const BOARD_ROW_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'nowrap',
  alignItems: 'stretch',
};

function cardEhArquivadoNativo(c: KanbanCardBrief): boolean {
  return c.origem !== 'legado' && Boolean(c.arquivado);
}

function statusPrecisaPoolArquivados(status: KanbanBoardFiltros['status']): boolean {
  return status === 'arquivados' || status === 'perdas' || status === 'ganhos';
}

function labelStatusPoolLoading(status: KanbanBoardFiltros['status']): string {
  if (status === 'concluidos') return 'concluídos';
  if (status === 'perdas') return 'perdas';
  if (status === 'ganhos') return 'ganhos';
  return 'arquivados';
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
  /** Após paint: busca paralelas, responsável e calculadora SLA no client. */
  deferEnrichments?: boolean;
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
  deferEnrichments = false,
}: KanbanBoardProps) {
  const hipotesesOrdemMin = useMemo(() => hipotesesOrdemMinima(fases), [fases]);
  const { pode } = usePermissoes();
  const [filtros, setFiltros] = useState<KanbanBoardFiltros>(KANBAN_BOARD_FILTROS_DEFAULT);
  const [filtrosDraft, setFiltrosDraft] = useState<KanbanBoardFiltros>(KANBAN_BOARD_FILTROS_DEFAULT);
  const [buscaCard, setBuscaCard] = useState('');
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const isMarketing = isMarketingKanbanId(kanbanId);
  const isProgramacao = kanbanId === KANBAN_IDS.MARKETING_PROGRAMACAO;
  const [mktStatus, setMktStatus] = useState<MarketingStatusFiltro>('todos');
  const [mktFrente, setMktFrente] = useState<'todas' | MarketingFrente>('todas');
  const [perfilPorCard, setPerfilPorCard] = useState<Record<string, string>>({});
  const filtrosPopoverRef = useRef<HTMLDivElement>(null);
  const filtrosBtnRef = useRef<HTMLButtonElement>(null);
  const boardScrollRef = useRef<HTMLDivElement>(null);
  const [scrollHintLeft, setScrollHintLeft] = useState(false);
  const [scrollHintRight, setScrollHintRight] = useState(false);

  const nomeDbParaLazy = String(kanbanNomeDb ?? kanbanNome ?? '').trim();
  const showPerdaGanhoFiltros = nomeDbParaLazy === 'Funding' || kanbanNome === 'Funding';
  const leanAtivo =
    snapshotLean ??
    (!cards.some(cardEhArquivadoNativo) && cardsConcluidos.length === 0);

  /** Pools carregados sob demanda (STATUS arquivados / concluídos). */
  const [lazyArquivados, setLazyArquivados] = useState<KanbanCardBrief[] | null>(null);
  const [lazyConcluidos, setLazyConcluidos] = useState<KanbanCardBrief[] | null>(null);
  const [statusPoolLoading, setStatusPoolLoading] = useState(false);
  const [statusPoolError, setStatusPoolError] = useState<string | null>(null);
  const lazyFetchGen = useRef(0);
  const enrichmentFetchGen = useRef(0);
  const comentariosFetchGen = useRef(0);
  const proximasAtividadesFetchGen = useRef(0);

  /** Patches de enrichments adiados (paralelas, avatar responsável, calculadora). */
  const [enrichmentByCardId, setEnrichmentByCardId] = useState<
    Record<string, Partial<KanbanCardBrief>>
  >({});
  /** Balão 💬 no card fechado — batch após paint (opt-in em KanbanColumn). */
  const [comentariosCountPorCard, setComentariosCountPorCard] = useState<Record<string, number>>(
    {},
  );
  /** Lista aberta no popover — batch após paint (evita server action por clique). */
  const [proximasAtividadesPorCard, setProximasAtividadesPorCard] = useState<
    Record<string, KanbanProximaAtividadeAberta[]>
  >({});
  const [proximasAtividadesBatchPronto, setProximasAtividadesBatchPronto] = useState(false);
  /** Posições otimistas do DnD (fase + ordem) até o servidor confirmar / RSC atualizar. */
  const [dndPosByCardId, setDndPosByCardId] = useState<
    Record<string, { fase_id: string; ordem_coluna: number }>
  >({});
  const dndPosRef = useRef(dndPosByCardId);
  dndPosRef.current = dndPosByCardId;
  /** Patches otimistas de próxima atividade (sem refresh do board). */
  const [proximaPatchByCardId, setProximaPatchByCardId] = useState<
    Record<string, { proxima_atividade: string | null; prazo_atividade: string | null }>
  >({});

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
    setEnrichmentByCardId({});
    setComentariosCountPorCard({});
    setProximasAtividadesPorCard({});
    setProximasAtividadesBatchPronto(false);
    setDndPosByCardId({});
    setProximaPatchByCardId({});
  }, [cardsSnapshotSig]);

  useEffect(() => {
    if (!isProgramacao) return;
    const ids = [...cards, ...cardsConcluidos].map((c) => c.id);
    if (ids.length === 0) {
      setPerfilPorCard({});
      return;
    }
    let cancelled = false;
    void fetchMarketingPerfilDestino(ids).then((map) => {
      if (!cancelled) setPerfilPorCard(map);
    });
    return () => {
      cancelled = true;
    };
  }, [isProgramacao, cardsSnapshotSig, cards, cardsConcluidos]);

  useEffect(() => {
    if (!deferEnrichments || !nomeDbParaLazy || !kanbanId) return;

    const gen = ++enrichmentFetchGen.current;
    let cancelled = false;

    void (async () => {
      const res = await fetchKanbanBoardDeferredEnrichment(nomeDbParaLazy, kanbanId);
      if (cancelled || gen !== enrichmentFetchGen.current) return;
      if (res.ok) setEnrichmentByCardId(res.patches);
    })();

    return () => {
      cancelled = true;
    };
  }, [deferEnrichments, nomeDbParaLazy, kanbanId, cardsSnapshotSig]);

  const cardIdsParaContagem = useMemo(() => {
    const ids = new Set<string>();
    const fontes = [
      ...cards,
      ...cardsConcluidos,
      ...(lazyArquivados ?? []),
      ...(lazyConcluidos ?? []),
    ];
    for (const c of fontes) {
      const id = String(c.id ?? '').trim();
      if (id) ids.add(id);
    }
    return [...ids];
  }, [cardsSnapshotSig, lazyArquivados, lazyConcluidos]);

  useEffect(() => {
    if (cardIdsParaContagem.length === 0) {
      setComentariosCountPorCard({});
      return;
    }

    const gen = ++comentariosFetchGen.current;
    let cancelled = false;

    void (async () => {
      const res = await fetchKanbanComentariosCountPorCardIds(cardIdsParaContagem);
      if (cancelled || gen !== comentariosFetchGen.current) return;
      if (res.ok) setComentariosCountPorCard(res.counts);
    })();

    return () => {
      cancelled = true;
    };
  }, [cardIdsParaContagem]);

  useEffect(() => {
    if (cardIdsParaContagem.length === 0) {
      setProximasAtividadesPorCard({});
      setProximasAtividadesBatchPronto(true);
      return;
    }

    const gen = ++proximasAtividadesFetchGen.current;
    let cancelled = false;
    setProximasAtividadesBatchPronto(false);

    void (async () => {
      const res = await fetchKanbanProximasAtividadesPorCardIds(cardIdsParaContagem);
      if (cancelled || gen !== proximasAtividadesFetchGen.current) return;
      if (res.ok) setProximasAtividadesPorCard(res.byCardId);
      setProximasAtividadesBatchPronto(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [cardIdsParaContagem]);

  useEffect(() => {
    if (!leanAtivo || !nomeDbParaLazy) return;
    const status = filtros.status;
    if (!statusPrecisaPoolArquivados(status) && status !== 'concluidos') {
      setStatusPoolLoading(false);
      return;
    }
    if (statusPrecisaPoolArquivados(status) && lazyArquivados != null) {
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
      const poolStatus = statusPrecisaPoolArquivados(status) ? 'arquivados' : 'concluidos';
      const res = await fetchKanbanBoardStatusPool(nomeDbParaLazy, poolStatus);
      if (cancelled || gen !== lazyFetchGen.current) return;
      setStatusPoolLoading(false);
      if (!res.ok) {
        setStatusPoolError(res.error);
        return;
      }
      if (statusPrecisaPoolArquivados(status)) {
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

  const mergeEnrichment = (c: KanbanCardBrief): KanbanCardBrief => {
    const patch = enrichmentByCardId[c.id];
    let withEnrich = patch ? { ...c, ...patch } : c;
    const prox = proximaPatchByCardId[c.id];
    if (prox) {
      withEnrich = {
        ...withEnrich,
        proxima_atividade: prox.proxima_atividade,
        prazo_atividade: prox.prazo_atividade,
      };
    }
    const dnd = dndPosByCardId[c.id];
    return dnd
      ? { ...withEnrich, fase_id: dnd.fase_id, ordem_coluna: dnd.ordem_coluna }
      : withEnrich;
  };

  const cardsComEnrichment = useMemo(
    () => cards.map(mergeEnrichment),
    [cards, enrichmentByCardId, dndPosByCardId, proximaPatchByCardId],
  );

  const cardsConcluidosComEnrichment = useMemo(
    () => cardsConcluidos.map(mergeEnrichment),
    [cardsConcluidos, enrichmentByCardId, dndPosByCardId, proximaPatchByCardId],
  );

  const cardsEfetivos = useMemo(() => {
    if (!lazyArquivados || lazyArquivados.length === 0) return cardsComEnrichment;
    const ids = new Set(cardsComEnrichment.map((c) => c.id));
    return [
      ...cardsComEnrichment,
      ...lazyArquivados.filter((c) => !ids.has(c.id)).map(mergeEnrichment),
    ];
  }, [cardsComEnrichment, lazyArquivados, enrichmentByCardId]);

  const cardsConcluidosEfetivos = lazyConcluidos ?? cardsConcluidosComEnrichment;

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

  const textoBuscaPorCardId = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of poolStatus) {
      const fase = faseMap.get(c.fase_id) ?? null;
      map.set(
        c.id,
        textoVisivelCardKanbanFechado(c, {
          kanbanId,
          kanbanNome: typeof kanbanNome === 'string' ? kanbanNome : nomeDbParaLazy || null,
          fase,
          hipotesesOrdemMin: hipotesesOrdemMin,
        }),
      );
    }
    return map;
  }, [poolStatus, faseMap, kanbanId, kanbanNome, nomeDbParaLazy, hipotesesOrdemMin]);

  const cardsFiltrados = useMemo(() => {
    const busca = buscaCard.trim();
    const fasesOrd = fases.filter((f) => f.ativo !== false);
    const ordemMin = fasesOrd.length > 0 ? Math.min(...fasesOrd.map((f) => f.ordem)) : 1;
    return poolStatus.filter((c) => {
      if (!cardPassaFiltrosBoard(c, filtros, faseMap, currentUserId)) return false;
      if (
        busca &&
        !cardIdMatchBuscaKanban(c.id, busca) &&
        !textoMatchBuscaKanbanPalavras(textoBuscaPorCardId.get(c.id) ?? '', busca)
      ) {
        return false;
      }
      if (isMarketing && mktStatus !== 'todos') {
        const concluido = c.origem !== 'legado' && Boolean(c.concluido);
        const ordem = faseMap.get(c.fase_id)?.ordem ?? ordemMin;
        if (mktStatus === 'concluido' && !concluido) return false;
        if (mktStatus === 'em_aberto' && (concluido || ordem > ordemMin)) return false;
        if (mktStatus === 'em_andamento' && (concluido || ordem <= ordemMin)) return false;
      }
      if (isProgramacao && mktFrente !== 'todas') {
        if ((perfilPorCard[c.id] ?? '') !== mktFrente) return false;
      }
      return true;
    });
  }, [
    poolStatus,
    filtros,
    faseMap,
    currentUserId,
    buscaCard,
    textoBuscaPorCardId,
    isMarketing,
    mktStatus,
    isProgramacao,
    mktFrente,
    perfilPorCard,
    fases,
  ]);

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

  const applyOptimisticDnD = useCallback(
    (input: {
      cardId: string;
      fromFaseId: string;
      toFaseId: string;
      beforeCardId: string | null;
    }): Record<string, { fase_id: string; ordem_coluna: number }> | null => {
      const snapshot = { ...dndPosRef.current };
      const movedId = input.cardId.trim();
      if (!movedId) return null;

      const fonte = [...cardsEfetivos, ...cardsConcluidosEfetivos];
      const byId = new Map(fonte.map((c) => [c.id, c]));
      const moved = byId.get(movedId);
      if (!moved) return null;

      const destCards = fonte
        .filter((c) => c.fase_id === input.toFaseId && c.id !== movedId)
        .sort((a, b) => {
          const oa = a.ordem_coluna ?? 0;
          const ob = b.ordem_coluna ?? 0;
          if (oa !== ob) return oa - ob;
          return a.id.localeCompare(b.id);
        });

      let insertAt = destCards.length;
      if (input.beforeCardId) {
        const idx = destCards.findIndex((c) => c.id === input.beforeCardId);
        if (idx >= 0) insertAt = idx;
      }
      const ordered = [...destCards];
      ordered.splice(insertAt, 0, { ...moved, fase_id: input.toFaseId });

      setDndPosByCardId((prev) => {
        const next = { ...prev };
        if (input.fromFaseId !== input.toFaseId) {
          const origemRestante = fonte
            .filter((c) => c.fase_id === input.fromFaseId && c.id !== movedId)
            .sort((a, b) => (a.ordem_coluna ?? 0) - (b.ordem_coluna ?? 0));
          origemRestante.forEach((c, i) => {
            next[c.id] = { fase_id: input.fromFaseId, ordem_coluna: i };
          });
        }
        ordered.forEach((c, i) => {
          next[c.id] = { fase_id: input.toFaseId, ordem_coluna: i };
        });
        return next;
      });
      return snapshot;
    },
    [cardsEfetivos, cardsConcluidosEfetivos],
  );

  const rollbackDnD = useCallback(
    (snapshot: Record<string, { fase_id: string; ordem_coluna: number }> | null) => {
      setDndPosByCardId(snapshot ?? {});
    },
    [],
  );

  const onProximaAtividadeBoardSync = useCallback(
    (
      cardId: string,
      sync: {
        proxima_atividade: string | null;
        prazo_atividade: string | null;
        atividadesAbertas?: KanbanProximaAtividadeAberta[];
      },
    ) => {
      const id = String(cardId ?? '').trim();
      if (!id) return;
      setProximaPatchByCardId((prev) => ({
        ...prev,
        [id]: {
          proxima_atividade: sync.proxima_atividade,
          prazo_atividade: sync.prazo_atividade,
        },
      }));
      if (sync.atividadesAbertas !== undefined) {
        setProximasAtividadesPorCard((prev) => ({
          ...prev,
          [id]: sync.atividadesAbertas!,
        }));
      }
    },
    [],
  );

  const nAtivos = countKanbanBoardFiltrosAtivos(filtros);
  const corretoresFiltroOpcoes = useMemo(() => {
    if (kanbanId !== KANBAN_IDS.CORRETORES) {
      return { corretores: [] as string[], imobiliarias: [] as string[], tipologias: [] as string[] };
    }
    const corretores = new Set<string>();
    const imobiliarias = new Set<string>();
    const tipologias = new Set<string>();
    for (const c of [...cardsEfetivos, ...cardsConcluidosEfetivos]) {
      const n = String(c.nome_corretor ?? '').trim();
      const i = String(c.imobiliaria_corretor ?? '').trim();
      const t = String(c.tipologia_interesse ?? '').trim();
      if (n) corretores.add(n);
      if (i) imobiliarias.add(i);
      if (t) tipologias.add(t);
    }
    return {
      corretores: [...corretores].sort((a, b) => a.localeCompare(b, 'pt-BR')),
      imobiliarias: [...imobiliarias].sort((a, b) => a.localeCompare(b, 'pt-BR')),
      tipologias: [...tipologias].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    };
  }, [kanbanId, cardsEfetivos, cardsConcluidosEfetivos]);
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

  const totalMarketing = cardsEfetivos.length + cardsConcluidosEfetivos.length;
  const concluidosMarketing = cardsConcluidosEfetivos.length;

  return (
    <div className="min-w-0 space-y-3">
      {isMarketing ? (
        <MarketingKanbanExtras
          kanbanId={kanbanId}
          totalCards={totalMarketing}
          cardsConcluidos={concluidosMarketing}
          statusFiltro={mktStatus}
          onStatusFiltro={setMktStatus}
          frente={mktFrente}
          onFrente={setMktFrente}
        />
      ) : null}
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
          placeholder="Buscar no card (título, ID, tags, SLA, paralelas…)…"
          aria-label="Buscar cards por título, ID (UUID), tags ou informações visíveis no card"
          className="moni-kanban-fpill moni-kanban-fpill--search"
        />
        <ExportKanbanButton
          kanbanId={kanbanId}
          kanbanNome={kanbanNome}
          fases={fases}
          cards={cardsFiltrados}
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
              showPerdaGanhoFiltros={showPerdaGanhoFiltros}
              corretoresOpcoes={corretoresFiltroOpcoes.corretores}
              imobiliariasOpcoes={corretoresFiltroOpcoes.imobiliarias}
              tipologiasOpcoes={corretoresFiltroOpcoes.tipologias}
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
            Carregando {labelStatusPoolLoading(filtros.status)}…
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
              const isFaseConclusao = isFaseConclusaoKanban(fase) || isUltimaFaseAtiva;
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
                  isFaseConclusao={isFaseConclusao}
                  exibirAdicionarCard={isPrimeiraColuna && exibirBotaoNovoCard}
                  novoCardHref={novoCardHref}
                  comentariosCountPorCard={comentariosCountPorCard}
                  proximasAtividadesPorCard={proximasAtividadesPorCard}
                  proximasAtividadesBatchPronto={proximasAtividadesBatchPronto}
                  onOptimisticDnD={applyOptimisticDnD}
                  onRollbackDnD={rollbackDnD}
                  onProximaAtividadeBoardSync={onProximaAtividadeBoardSync}
                />
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
