'use server';

import { randomUUID } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import {
  htmlComentarioParaTextoPlano,
  extrairIdsMencoes,
  extrairNomesMencionados,
  type PerfilMencao,
} from '@/lib/kanban/mencao-comentario';

const BUCKET = 'chamados-attachments';
const PREFIX = 'agenda-comentarios';
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type ComentarioAnexo = {
  id: string;
  storage_path: string;
  nome_original: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
};

export type ComentarioItem = {
  id: string;
  profile_id: string;
  autor_nome: string | null;
  texto: string;
  mencoes: string[];
  criado_em: string;
  anexos: ComentarioAnexo[];
};

// ── Helper: resolve grupo_id para um gantt_id ─────────────────────────────────

async function resolverGrupoId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ganttId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('gantt_planejamento')
    .select('recorrencia_grupo_id')
    .eq('id', ganttId)
    .maybeSingle();
  return (data as { recorrencia_grupo_id?: string | null } | null)?.recorrencia_grupo_id ?? null;
}

// ── Listar comentários ────────────────────────────────────────────────────────

export async function listarComentarios(
  ganttId: string,
): Promise<{ ok: true; items: ComentarioItem[] } | { ok: false; error: string }> {
  const supabase = await createClient();
  const grupoId = await resolverGrupoId(supabase, ganttId);

  const q = supabase
    .from('gantt_comentarios')
    .select(`
      id, profile_id, texto, mencoes, criado_em,
      profiles!profile_id(full_name),
      gantt_comentario_anexos(id, storage_path, nome_original, mime_type, tamanho_bytes)
    `)
    .order('criado_em', { ascending: false });

  const { data, error } = await (grupoId
    ? q.eq('grupo_id', grupoId)
    : q.eq('gantt_id', ganttId));

  if (error) return { ok: false, error: error.message };

  const items: ComentarioItem[] = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    profile_id: r.profile_id as string,
    autor_nome: ((r.profiles as { full_name?: string } | null)?.full_name) ?? null,
    texto: r.texto as string,
    mencoes: (r.mencoes as string[]) ?? [],
    criado_em: r.criado_em as string,
    anexos: ((r.gantt_comentario_anexos as Record<string, unknown>[]) ?? []).map((a) => ({
      id: a.id as string,
      storage_path: a.storage_path as string,
      nome_original: a.nome_original as string,
      mime_type: (a.mime_type as string | null) ?? null,
      tamanho_bytes: (a.tamanho_bytes as number | null) ?? null,
    })),
  }));

  return { ok: true, items };
}

// ── Criar comentário ──────────────────────────────────────────────────────────

export async function criarComentario(params: {
  ganttId: string;
  htmlTexto: string;
  mencoes: string[];   // IDs já resolvidos pelo client
  ganttTitulo: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado' };

  const grupoId = await resolverGrupoId(supabase, params.ganttId);
  const textoPlano = htmlComentarioParaTextoPlano(params.htmlTexto);

  const payload: Record<string, unknown> = {
    profile_id: user.id,
    texto: textoPlano || params.htmlTexto,
    mencoes: params.mencoes,
  };
  if (grupoId) payload.grupo_id = grupoId;
  else payload.gantt_id = params.ganttId;

  const { data, error } = await supabase
    .from('gantt_comentarios')
    .insert(payload)
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };

  // Notificar mencionados (não bloqueia o retorno)
  if (params.mencoes.length > 0) {
    void notificarMencoes({
      mencoes: params.mencoes,
      autorId: user.id,
      ganttId: params.ganttId,
      ganttTitulo: params.ganttTitulo,
    });
  }

  return { ok: true, id: (data as { id: string }).id };
}

// ── Notificar mencionados via alertas ─────────────────────────────────────────

async function notificarMencoes(params: {
  mencoes: string[];
  autorId: string;
  ganttId: string;
  ganttTitulo: string;
}) {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();

    const { data: autor } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', params.autorId)
      .maybeSingle();
    const autorNome = (autor as { full_name?: string } | null)?.full_name ?? 'Alguém';

    const destinatarios = params.mencoes.filter(uid => uid !== params.autorId);
    if (destinatarios.length === 0) return;

    const inserts = destinatarios.map(uid => ({
      user_id: uid,
      tipo: 'mencao_agenda_comentario',
      mensagem: `${autorNome} mencionou você em: ${params.ganttTitulo}`,
      referencia_path: '/carometro/todo-planning',
    }));

    await admin.from('alertas').insert(inserts);
  } catch (e) {
    console.error('[notificarMencoes agenda]', e);
  }
}

// ── Excluir comentário ────────────────────────────────────────────────────────

export async function excluirComentario(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from('gantt_comentarios').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Upload de anexo ───────────────────────────────────────────────────────────

function sanitize(nome: string): string {
  return nome.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
}

export async function uploadAnexoComentarioAgenda(
  formData: FormData,
): Promise<{ ok: true; id: string; path: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado' };

  const comentarioId = formData.get('comentario_id') as string;
  const ganttId = formData.get('gantt_id') as string;
  const file = formData.get('file') as File | null;
  if (!file) return { ok: false, error: 'Nenhum arquivo enviado' };
  if (file.size > MAX_BYTES) return { ok: false, error: `Arquivo muito grande (máx ${MAX_BYTES / 1024 / 1024} MB)` };

  const uuid = randomUUID();
  const storagePath = `${PREFIX}/${ganttId}/${comentarioId}/${uuid}-${sanitize(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type });

  if (uploadError) return { ok: false, error: uploadError.message };

  const { data: inserted, error: dbError } = await supabase
    .from('gantt_comentario_anexos')
    .insert({
      comentario_id: comentarioId,
      storage_path: storagePath,
      nome_original: file.name,
      mime_type: file.type || null,
      tamanho_bytes: file.size,
    })
    .select('id')
    .single();

  if (dbError) {
    void supabase.storage.from(BUCKET).remove([storagePath]);
    return { ok: false, error: dbError.message };
  }

  return { ok: true, id: (inserted as { id: string }).id, path: storagePath };
}

// ── URL assinada para anexo ───────────────────────────────────────────────────

export async function urlAssinadaAnexoAgenda(
  storagePath: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600);
  if (error || !data?.signedUrl) return { ok: false, error: error?.message ?? 'Erro ao gerar URL' };
  return { ok: true, url: data.signedUrl };
}

// ── Buscar usuários Team+Admin para @menções ──────────────────────────────────

export async function buscarTeamAdminsParaMencao(
  query: string,
): Promise<{ id: string; nome: string }[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const q = query.trim();
  let req = supabase
    .from('profiles')
    .select('id, full_name')
    .in('role', ['team', 'admin'])
    .order('full_name')
    .limit(10);

  if (q.length >= 1) {
    req = req.ilike('full_name', `%${q}%`);
  } else {
    req = req.not('full_name', 'is', null).neq('full_name', '');
  }

  const { data } = await req;
  return ((data ?? []) as { id: string; full_name: string }[])
    .map(r => ({ id: r.id, nome: r.full_name ?? '' }))
    .filter(r => r.nome);
}

// ── Resolver IDs de menção a partir do HTML (usado pelo cliente) ──────────────

export async function resolverIdsMencoes(
  htmlTexto: string,
): Promise<string[]> {
  const supabase = await createClient();
  const textoPlano = htmlComentarioParaTextoPlano(htmlTexto);
  const nomes = extrairNomesMencionados(textoPlano);
  if (nomes.length === 0) return [];

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('role', ['team', 'admin'])
    .not('full_name', 'is', null);

  const perfis: PerfilMencao[] = ((data ?? []) as { id: string; full_name: string }[])
    .map(r => ({ id: r.id, nome: r.full_name ?? '' }));

  return extrairIdsMencoes(textoPlano, perfis);
}
