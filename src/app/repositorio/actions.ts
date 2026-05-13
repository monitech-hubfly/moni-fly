'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { isAdminRole, normalizeAccessRole } from '@/lib/authz';

export type RepositorioDocumentoRow = {
  id: string;
  secao_id: string;
  nome: string;
  descricao: string | null;
  storage_path: string;
  bucket: string;
  ordem: number;
  created_at: string;
};

export type RepositorioSecaoRow = {
  id: string;
  nome: string;
  ordem: number;
  created_at: string;
};

export type SecaoComDocumentos = RepositorioSecaoRow & { documentos: RepositorioDocumentoRow[] };

const REPO_PATH = '/repositorio';

function sanitizeFileName(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
  return base.length > 0 ? base : 'arquivo';
}

async function sessionAndRole() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Faça login.' };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = normalizeAccessRole((profile as { role?: string } | null)?.role);
  return { ok: true as const, user, role, supabase };
}

export async function listarRepositorio(): Promise<
  { ok: true; secoes: SecaoComDocumentos[] } | { ok: false; error: string }
> {
  const ctx = await sessionAndRole();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { supabase } = ctx;
  const { data: secoesRaw, error: secErr } = await supabase
    .from('repositorio_secoes')
    .select('id, nome, ordem, created_at')
    .order('ordem', { ascending: true });
  if (secErr) return { ok: false, error: secErr.message };

  const { data: docsRaw, error: docErr } = await supabase
    .from('repositorio_documentos')
    .select('id, secao_id, nome, descricao, storage_path, bucket, ordem, created_at')
    .order('ordem', { ascending: true });
  if (docErr) return { ok: false, error: docErr.message };

  const secoes = (secoesRaw ?? []) as RepositorioSecaoRow[];
  const docs = (docsRaw ?? []) as RepositorioDocumentoRow[];
  const porSecao = new Map<string, RepositorioDocumentoRow[]>();
  for (const d of docs) {
    const arr = porSecao.get(d.secao_id) ?? [];
    arr.push(d);
    porSecao.set(d.secao_id, arr);
  }
  const secoesComDocs: SecaoComDocumentos[] = secoes.map((s) => ({
    ...s,
    documentos: porSecao.get(s.id) ?? [],
  }));
  return { ok: true, secoes: secoesComDocs };
}

export async function adicionarSecao(nome: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await sessionAndRole();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!isAdminRole(ctx.role)) return { ok: false, error: 'Apenas administradores podem criar seções.' };

  const label = nome.trim();
  if (!label) return { ok: false, error: 'Informe o nome da seção.' };

  const admin = createAdminClient();
  const { data: maxRow } = await admin.from('repositorio_secoes').select('ordem').order('ordem', { ascending: false }).limit(1).maybeSingle();
  const nextOrdem = Number((maxRow as { ordem?: number } | null)?.ordem ?? 0) + 1;
  const { error } = await admin.from('repositorio_secoes').insert({ nome: label, ordem: nextOrdem });
  if (error) return { ok: false, error: error.message };
  revalidatePath(REPO_PATH);
  return { ok: true };
}

export async function adicionarDocumento(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await sessionAndRole();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!isAdminRole(ctx.role)) return { ok: false, error: 'Apenas administradores podem enviar documentos.' };

  const secao_id = String(formData.get('secao_id') ?? '').trim();
  const nome = String(formData.get('nome') ?? '').trim();
  const descricaoRaw = formData.get('descricao');
  const descricao =
    descricaoRaw == null || String(descricaoRaw).trim() === '' ? null : String(descricaoRaw).trim();
  const arquivo = formData.get('arquivo');

  if (!secao_id) return { ok: false, error: 'Seção inválida.' };
  if (!nome) return { ok: false, error: 'Informe o nome do documento.' };
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, error: 'Selecione um arquivo.' };
  }

  const bucket = 'documentos-templates';
  const safe = sanitizeFileName(arquivo.name);
  const storage_path = `repositorio/${secao_id}/${randomUUID()}_${safe}`;

  const buf = Buffer.from(await arquivo.arrayBuffer());
  const admin = createAdminClient();

  const { error: upErr } = await admin.storage.from(bucket).upload(storage_path, buf, {
    contentType: arquivo.type || 'application/octet-stream',
    upsert: false,
  });
  if (upErr) return { ok: false, error: upErr.message };

  const { data: maxDoc } = await admin
    .from('repositorio_documentos')
    .select('ordem')
    .eq('secao_id', secao_id)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrdem = Number((maxDoc as { ordem?: number } | null)?.ordem ?? 0) + 1;

  const { error: insErr } = await admin.from('repositorio_documentos').insert({
    secao_id,
    nome,
    descricao,
    storage_path,
    bucket,
    criado_por: ctx.user.id,
    ordem: nextOrdem,
  });
  if (insErr) {
    await admin.storage.from(bucket).remove([storage_path]);
    return { ok: false, error: insErr.message };
  }

  revalidatePath(REPO_PATH);
  return { ok: true };
}

export async function baixarDocumento(
  id: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const ctx = await sessionAndRole();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { supabase } = ctx;
  const { data: row, error } = await supabase
    .from('repositorio_documentos')
    .select('id, storage_path, bucket')
    .eq('id', id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!row) return { ok: false, error: 'Documento não encontrado.' };

  const doc = row as { id: string; storage_path: string; bucket: string };
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: 'Serviço indisponível.' };
  }

  const { data: signed, error: signErr } = await admin.storage
    .from(doc.bucket)
    .createSignedUrl(doc.storage_path, 3600);
  if (signErr || !signed?.signedUrl) {
    return { ok: false, error: signErr?.message ?? 'Não foi possível gerar o link.' };
  }
  return { ok: true, url: signed.signedUrl };
}

export async function deletarDocumento(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await sessionAndRole();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!isAdminRole(ctx.role)) return { ok: false, error: 'Apenas administradores podem remover documentos.' };

  const admin = createAdminClient();
  const { data: row, error: selErr } = await admin
    .from('repositorio_documentos')
    .select('storage_path, bucket')
    .eq('id', id)
    .maybeSingle();
  if (selErr) return { ok: false, error: selErr.message };
  if (!row) return { ok: false, error: 'Documento não encontrado.' };

  const doc = row as { storage_path: string; bucket: string };
  await admin.storage.from(doc.bucket).remove([doc.storage_path]);

  const { error: delErr } = await admin.from('repositorio_documentos').delete().eq('id', id);
  if (delErr) return { ok: false, error: delErr.message };

  revalidatePath(REPO_PATH);
  return { ok: true };
}
