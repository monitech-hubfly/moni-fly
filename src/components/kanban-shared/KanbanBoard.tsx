'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePermissoes } from '@/lib/hooks/usePermissoes';
import { KanbanBoardFiltrosPanel } from './KanbanBoardFiltrosPanel';
import { KanbanColumn } from './KanbanColumn';
import {
  cardPassaFiltrosBoard,
  countKanbanBoardFiltrosAtivos,
  KANBAN_BOARD_FILTROS_DEFAULT,
  poolCardsPorStatus,
  type KanbanBoardFiltros,
} from './kanbanBoardFiltros';
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
  /** Exibe o atalho “+ Novo card” (`?novo=true`) quando `pode('criar_cards')`. */
  mostrarLinkNovoCard?: boolean;
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
}: KanbanBoardProps) {
  const { pode } = usePermissoes();
  const [filtros, setFiltros] = useState<KanbanBoardFiltros>(KANBAN_BOARD_FILTROS_DEFAULT);
  const [filtrosDraft, setFiltrosDraft] = useState<KanbanBoardFiltros>(KANBAN_BOARD_FILTROS_DEFAULT);
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const filtrosPopoverRef = useRef<HTMLDivElement>(null);
  const filtrosBtnRef = useRef<HTMLButtonElement>(null);

  /** DEBUG PROD: comparar id completo vs URL (?card=) — remover após diagnóstico */
  useEffect(() => {
    for (const c of cards) {
      console.log(
        '[DEBUG] KanbanBoard card.id (ativos):',
        JSON.stringify(c.id),
        'len=',
        c.id?.length,
        c,
      );
    }
    for (const c of cardsConcluidos) {
      console.log(
        '[DEBUG] KanbanBoard card.id (concluidos):',
        JSON.stringify(c.id),
        'len=',
        c.id?.length,
        c,
      );
    }
  }, [cards, cardsConcluidos]);

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

  const cardsFiltrados = useMemo(
    () => poolStatus.filter((c) => cardPassaFiltrosBoard(c, filtros, faseMap, currentUserId)),
    [poolStatus, filtros, faseMap, currentUserId],
  );

  const clientFiltersActive = countKanbanBoardFiltrosAtivos(filtros) > 0;

  const cardsByFase = useMemo(() => {
    const m: Record<string, KanbanCardBrief[]> = {};
    for (const f of fases) m[f.id] = [];
    for (const c of cardsFiltrados) {
      if (!m[c.fase_id]) m[c.fase_id] = [];
      m[c.fase_id].push(c);
    }
    return m;
  }, [fases, cardsFiltrados]);

  const nAtivos = countKanbanBoardFiltrosAtivos(filtros);
  const podeCriarCards = pode('criar_cards');

  return (
    <div className="space-y-3">
      <div className="relative flex flex-wrap items-center gap-3">
        {mostrarLinkNovoCard && podeCriarCards ? (
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
            />
          );
        })}
      </div>
    </div>
  );
}
