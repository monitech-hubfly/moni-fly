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

/**
 * Estilo de chip de tag no board / modal.
 * Tags de conteúdo usam o padrão pill “Média” via CSS (`moni-tag-chip` + tokens);
 * a cor do cadastro é ignorada (sem laranja / sem roxo por tag).
 * Especial no board é estrela no título — aqui só cai no modal/listagens.
 */
export function estiloChipTagKanban(nome: string, _cor?: string): KanbanTagChipStyle {
  if (isKanbanTagEspecialNome(nome)) {
    return { className: 'moni-tag-especial' };
  }
  return { className: 'moni-tag-chip' };
}
