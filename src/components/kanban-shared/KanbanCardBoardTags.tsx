'use client';

import { X } from 'lucide-react';
import {
  estiloChipTagKanban,
  isKanbanTagEspecialNome,
} from '@/lib/kanban/kanban-tag-especial';

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
  /**
   * `full` — Especial ignorado no board (estrela no título) + chips.
   * `especial` — legado no-op (estrela vai no título via KanbanColumn).
   * `chips` — só tags não-Especiais em chip padrão Média.
   */
  modo?: 'full' | 'especial' | 'chips';
};

/** Tags visíveis no card fechado do board (todos os funis). */
export function KanbanCardBoardTags({
  tags,
  className = '',
  editable = false,
  onRemoveTag,
  modo = 'full',
}: Props) {
  const list = tags ?? [];
  if (list.length === 0) return null;

  // Especial não é chip nem linha — a estrela fica no título (KanbanColumn).
  if (modo === 'especial') return null;

  const chips = list.filter((t) => !isKanbanTagEspecialNome(t.nome));
  if (chips.length === 0) return null;

  return (
    <div
      className={`moni-kanban-card-tags-chips ${className}`.trim()}
      aria-label="Tags do card"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {chips.map((t) => {
        const chip = estiloChipTagKanban(t.nome, t.cor);
        const podeRemover = editable && Boolean(onRemoveTag) && Boolean(t.id);
        return (
          <span
            key={t.id || t.tag_id}
            className={`${chip.className}${podeRemover ? ' moni-kanban-card-tag-chip--removable' : ''}`}
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
