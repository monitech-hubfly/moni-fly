'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const MAX_ANEXO_BYTES = 10 * 1024 * 1024;
const BUCKET = 'chamados-attachments';

function sanitizeNomeArquivo(nome: string): string {
  return String(nome ?? '')
    .replace(/[/\\]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

export type KanbanComentarioAnexoRow = {
  id: string;
  comentario_id: string;
  card_id: string;
  storage_path: string;
  nome_original: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
  criado_por: string | null;
  created_at: string;
};

export async function adicionarAnexoComentarioKanbanCard(
  formData: FormData,
  basePath?: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const cardId = String(formData.get('cardId') ?? '').trim();
  const comentarioId = String(formData.get('comentarioId') ?? '').trim();
  const file = formData.get('file');
  if (!cardId) return { ok: false, error: 'Card inválido.' };
  if (!comentarioId) return { ok: false, error: 'Comentário inválido.' };
  if (!(file instanceof File)) return { ok: false, error: 'Arquivo inválido.' };
  if (file.size > MAX_ANEXO_BYTES) return { ok: false, error: 'Arquivo acima de 10 MB.' };

  const { data: comentario, error: errCom } = await supabase
    .from('kanban_card_comentarios')
    .select('id, card_id')
    .eq('id', comentarioId)
    .maybeSingle();
  if (errCom || !comentario?.id) return { ok: false, error: 'Comentário não encontrado.' };
  if (String((comentario as { card_id?: string }).card_id ?? '') !== cardId) {
    return { ok: false, error: 'Comentário não pertence a este card.' };
  }

  const orig = sanitizeNomeArquivo(file.name || 'arquivo');
  const storagePath = `kanban-comentarios/${cardId}/${comentarioId}/${randomUUID()}-${orig}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, buf, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (upErr) return { ok: false, error: upErr.message };

  const { data: inserted, error: insErr } = await supabase
    .from('kanban_card_comentario_anexos')
    .insert({
      comentario_id: comentarioId,
      card_id: cardId,
      storage_path: storagePath,
      nome_original: orig,
      mime_type: file.type || null,
      tamanho_bytes: file.size,
      criado_por: user.id,
    })
    .select('id')
    .single();

  if (insErr) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return { ok: false, error: insErr.message };
  }

  revalidatePath(basePath?.trim() || '/');
  return { ok: true, id: String(inserted.id) };
}

export async function listarAnexosComentariosKanbanCard(
  cardId: string,
): Promise<{ ok: true; items: KanbanComentarioAnexoRow[] } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const cid = String(cardId ?? '').trim();
  if (!cid) return { ok: false, error: 'Card inválido.' };

  const { data, error } = await supabase
    .from('kanban_card_comentario_anexos')
    .select(
      'id, comentario_id, card_id, storage_path, nome_original, mime_type, tamanho_bytes, criado_por, created_at',
    )
    .eq('card_id', cid)
    .order('created_at', { ascending: true });

  if (error) return { ok: false, error: error.message };
  return { ok: true, items: (data ?? []) as KanbanComentarioAnexoRow[] };
}

export async function urlAssinadaAnexoComentarioKanbanCard(
  storagePath: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const path = String(storagePath ?? '').trim();
  if (!path) return { ok: false, error: 'Caminho inválido.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message ?? 'Não foi possível gerar o link.' };
  }
  return { ok: true, url: data.signedUrl };
}
