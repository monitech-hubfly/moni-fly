'use client';

import { useMemo, useState } from 'react';
import { KanbanColumn } from './KanbanColumn';
import type { KanbanCardBrief, KanbanFase } from './types';

export type KanbanBoardProps = {
  fases: KanbanFase[];
  cards: KanbanCardBrief[];
  /** Nativo: cards com `concluido` (toggle “Mostrar concluídos”). */
  cardsConcluidos?: KanbanCardBrief[];
  basePath: string;
  userRole: string;
  columnAccent?: string;
  cardQueryParam?: string;
};

function isCardArquivado(c: KanbanCardBrief): boolean {
  return c.origem !== 'legado' && Boolean(c.arquivado);
}

/**
 * Colunas do kanban (fases × cards). O `KanbanWrapper` deve envolver a página para modal por `?card=`.
 * Toggles “Mostrar arquivados” / “Mostrar concluídos”: mutuamente exclusivos no filtro (como o de arquivados).
 */
export function KanbanBoard({
  fases,
  cards,
  cardsConcluidos = [],
  basePath,
  userRole,
  columnAccent = 'var(--moni-kanban-stepone)',
  cardQueryParam,
}: KanbanBoardProps) {
  const [mostrarArquivados, setMostrarArquivados] = useState(false);
  const [mostrarConcluidos, setMostrarConcluidos] = useState(false);

  const cardsVisiveis = useMemo(() => {
    if (mostrarArquivados) return cards.filter((c) => isCardArquivado(c));
    if (mostrarConcluidos) return cardsConcluidos;
    return cards.filter((c) => {
      if (c.origem === 'legado') return true;
      return !c.arquivado && !c.concluido;
    });
  }, [cards, cardsConcluidos, mostrarArquivados, mostrarConcluidos]);

  const cardsByFase = useMemo(() => {
    const m: Record<string, KanbanCardBrief[]> = {};
    for (const f of fases) m[f.id] = [];
    for (const c of cardsVisiveis) {
      if (!m[c.fase_id]) m[c.fase_id] = [];
      m[c.fase_id].push(c);
    }
    return m;
  }, [fases, cardsVisiveis]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setMostrarArquivados((v) => !v);
            setMostrarConcluidos(false);
          }}
          className="text-xs font-medium underline-offset-2 transition hover:underline"
          style={{ color: 'var(--moni-text-tertiary)' }}
        >
          {mostrarArquivados ? 'Ocultar arquivados' : 'Mostrar arquivados'}
        </button>
        <button
          type="button"
          onClick={() => {
            setMostrarConcluidos((v) => !v);
            setMostrarArquivados(false);
          }}
          className="text-xs font-medium underline-offset-2 transition hover:underline"
          style={{ color: 'var(--moni-text-tertiary)' }}
        >
          {mostrarConcluidos ? 'Ocultar concluídos' : 'Mostrar concluídos'}
        </button>
      </div>
      <div className="moni-kanban-board flex min-w-max gap-4">
        {fases.map((fase) => (
          <KanbanColumn
            key={fase.id}
            fase={fase}
            cards={cardsByFase[fase.id] ?? []}
            basePath={basePath}
            cardQueryParam={cardQueryParam}
            userRole={userRole}
            columnAccent={columnAccent}
          />
        ))}
      </div>
    </div>
  );
}
