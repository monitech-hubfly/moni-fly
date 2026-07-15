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
   * `full` — Especial + demais tags (padrão).
   * `especial` — só o destaque ★ Especial (sem pill / sem ×).
   * `chips` — só tags não-Especiais em chip.
   */
  modo?: 'full' | 'especial' | 'chips';
};

/** Destaque ★ Especial — tipografia dourada, sem formato de tag/pill. */
function EspecialDestaque({ nome }: { nome: string }) {
  return (
    <span className="moni-kanban-card-especial" title={nome}>
      <span className="moni-kanban-card-especial-star" aria-hidden>
        ★
      </span>
      <span>Especial</span>
    </span>
  );
}

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

  const especiais = list.filter((t) => isKanbanTagEspecialNome(t.nome));
  const chips = list.filter((t) => !isKanbanTagEspecialNome(t.nome));

  if (modo === 'especial') {
    if (especiais.length === 0) return null;
    return (
      <div
        className={`moni-kanban-card-especial-row ${className}`.trim()}
        aria-label="Destaque Especial"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {especiais.map((t) => (
          <EspecialDestaque key={t.id || t.tag_id} nome={t.nome} />
        ))}
      </div>
    );
  }

  const listChips = modo === 'chips' ? chips : modo === 'full' ? list : chips;
  if (modo === 'chips' && chips.length === 0) return null;
  if (modo === 'full' && especiais.length > 0) {
    // full com Especial: renderiza destaque + chips (sem pill Especial)
    return (
      <div className={`moni-kanban-card-tags-block ${className}`.trim()}>
        <KanbanCardBoardTags tags={list} modo="especial" />
        <KanbanCardBoardTags
          tags={list}
          modo="chips"
          editable={editable}
          onRemoveTag={onRemoveTag}
        />
      </div>
    );
  }

  if (listChips.length === 0) return null;

  return (
    <div
      className={`moni-kanban-card-tags-chips ${className}`.trim()}
      aria-label="Tags do card"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {listChips.map((t) => {
        const chip = estiloChipTagKanban(t.nome, t.cor);
        const podeRemover = editable && Boolean(onRemoveTag) && Boolean(t.id);
        return (
          <span
            key={t.id || t.tag_id}
            className={`${chip.className}${podeRemover ? ' moni-kanban-card-tag-chip--removable' : ''}`}
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
