import { adicionarAnexoSubchamado } from '@/lib/actions/card-actions';

/** Envia anexos selecionados no rascunho após a atividade ser criada. */
export async function uploadAnexosAtividadePendentes(
  topicoId: string,
  files: File[],
  uploaderNome: string,
  basePath: string,
): Promise<void> {
  if (!topicoId || !files.length) return;
  for (const file of files) {
    const fd = new FormData();
    fd.set('subchamadoId', topicoId);
    fd.set('uploaderNome', uploaderNome);
    fd.set('file', file);
    await adicionarAnexoSubchamado(fd, basePath);
  }
}
