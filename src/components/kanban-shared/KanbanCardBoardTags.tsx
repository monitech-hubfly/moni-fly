'use client';

import { estiloChipTagKanban } from '@/lib/kanban/kanban-tag-especial';

type KanbanCardBoardTag = {
  tag_id: string;
  nome: string;
  cor: string;
};

type Props = {
  tags?: KanbanCardBoardTag[];
  className?: string;
};

/** Tags visíveis no card fechado do board (todos os funis). */
export function KanbanCardBoardTags({ tags, className = '' }: Props) {
  const list = tags ?? [];
  if (list.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1 ${className}`.trim()} aria-label="Tags do card">
      {list.map((t) => {
        const chip = estiloChipTagKanban(t.nome, t.cor);
        return (
          <span key={t.tag_id} className={chip.className} style={chip.style} title={t.nome}>
            {t.nome}
          </span>
        );
      })}
    </div>
  );
}
