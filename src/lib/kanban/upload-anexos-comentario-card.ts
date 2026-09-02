import { adicionarAnexoComentarioKanbanCard } from '@/lib/actions/kanban-comentario-anexos';

/** Envia anexos selecionados no rascunho após o comentário ser publicado. */
export async function uploadAnexosComentarioPendentes(
  cardId: string,
  comentarioId: string,
  files: File[],
  basePath: string,
): Promise<void> {
  if (!cardId || !comentarioId || !files.length) return;
  for (const file of files) {
    const fd = new FormData();
    fd.set('cardId', cardId);
    fd.set('comentarioId', comentarioId);
    fd.set('file', file);
    await adicionarAnexoComentarioKanbanCard(fd, basePath);
  }
}
