'use client';

import { X } from 'lucide-react';
import { estiloChipTagKanban } from '@/lib/kanban/kanban-tag-especial';

export type KanbanCardBoardTag = {
  id: string;
  tag_id: string;
  nome: string;
  cor: string;
};

type Props = {
  tags?: KanbanCardBoardTag[];
  className?: string;
  /** Exibe botão de remover em cada tag (card fechado no board). */
  editable?: boolean;
  onRemoveTag?: (cardTagId: string) => void;
};

/** Tags visíveis no card fechado do board (todos os funis). */
export function KanbanCardBoardTags({
  tags,
  className = '',
  editable = false,
  onRemoveTag,
}: Props) {
  const list = tags ?? [];
  if (list.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap gap-1 ${className}`.trim()}
      aria-label="Tags do card"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {list.map((t) => {
        const chip = estiloChipTagKanban(t.nome, t.cor);
        const podeRemover = editable && Boolean(onRemoveTag) && Boolean(t.id);
        return (
          <span
            key={t.id || t.tag_id}
            className={`${chip.className}${podeRemover ? ' inline-flex max-w-full items-center gap-0.5 pr-0.5' : ''}`}
            style={chip.style}
            title={t.nome}
          >
            <span className={podeRemover ? 'truncate' : undefined}>{t.nome}</span>
            {podeRemover ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const ok = window.confirm(`Remover a tag "${t.nome}" deste card?`);
                  if (!ok) return;
                  onRemoveTag?.(t.id);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="moni-kanban-board-tag-remove shrink-0 rounded-full p-0 text-current opacity-50 transition hover:bg-black/5 hover:opacity-100"
                aria-label={`Remover tag ${t.nome}`}
              >
                <X className="h-2 w-2" strokeWidth={2.5} aria-hidden />
              </button>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
