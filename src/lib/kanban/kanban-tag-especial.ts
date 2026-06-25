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
  return {
    className: 'inline-flex max-w-full items-center gap-0.5 rounded-md px-1.5 py-px text-[10px] font-semibold leading-tight',
    style: {
      background: `${cor}22`,
      color: cor,
      border: `0.5px solid color-mix(in srgb, ${cor} 55%, transparent)`,
    },
  };
}
