'use client';

import { useMemo } from 'react';
import { KanbanColumn } from './KanbanColumn';
import type { KanbanCardBrief, KanbanFase } from './types';

export type KanbanBoardProps = {
  fases: KanbanFase[];
  cards: KanbanCardBrief[];
  basePath: string;
  userRole: string;
  columnAccent?: string;
  cardQueryParam?: string;
};

/**
 * Colunas do kanban (fases × cards). O `KanbanWrapper` deve envolver a página para modal por `?card=`.
 */
export function KanbanBoard({
  fases,
  cards,
  basePath,
  userRole,
  columnAccent = 'var(--moni-kanban-stepone)',
  cardQueryParam,
}: KanbanBoardProps) {
  const cardsByFase = useMemo(() => {
    const m: Record<string, KanbanCardBrief[]> = {};
    for (const f of fases) m[f.id] = [];
    for (const c of cards) {
      if (!m[c.fase_id]) m[c.fase_id] = [];
      m[c.fase_id].push(c);
    }
    return m;
  }, [fases, cards]);

  return (
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
  );
}
