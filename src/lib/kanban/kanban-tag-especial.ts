/** Tag padronizada em todos os funis — dourada (tokens Moní). */
export const KANBAN_TAG_ESPECIAL_NOME = '⭐Especial';

export const KANBAN_TAG_ESPECIAL_COR = '#D4AD68';

export function isKanbanTagEspecialNome(nome: string | null | undefined): boolean {
  const n = String(nome ?? '').trim();
  return n === KANBAN_TAG_ESPECIAL_NOME;
}

export type KanbanTagChipStyle = {
  className: string;
  style?: {
    background?: string;
    color?: string;
    border?: string;
  };
};

/** Estilo de chip de tag no modal / listagens. */
export function estiloChipTagKanban(nome: string, cor: string): KanbanTagChipStyle {
  if (isKanbanTagEspecialNome(nome)) {
    return { className: 'moni-tag-especial' };
  }
  const c = String(cor ?? '').trim() || '#7a6e65';
  return {
    className: 'moni-tag-chip',
    style: {
      background: `color-mix(in srgb, ${c} 14%, white)`,
      color: c,
      border: `0.5px solid ${c}`,
    },
  };
}
