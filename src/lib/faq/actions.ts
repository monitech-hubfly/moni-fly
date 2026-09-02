'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { normalizeAccessRole } from '@/lib/authz';
import { appPath } from '@/lib/universidade/paths';
import type { FaqStatus } from './types';

function revalidateFaq() {
  revalidatePath(appPath('/universidade/faq'));
  revalidatePath(appPath('/admin/universidade/faq'));
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

async function requireStaff() {
  const { supabase, user } = await requireUser();
  if (!user) return { supabase, user: null, ok: false as const, error: 'Faça login.' };
  const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = normalizeAccessRole((prof as { role?: string } | null)?.role);
  if (role !== 'admin' && role !== 'team') {
    return { supabase, user, ok: false as const, error: 'Sem permissão.' };
  }
  return { supabase, user, ok: true as const, role };
}

function slugify(s: string): string {
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/g, '');
}

// ---- Uso pelo franqueado (leitura) ----

/** Registra uma busca (métrica independente do progresso da Universidade). */
export async function registrarBuscaFaq(
  query: string,
  resultCount: number,
  selectedArticleId?: string | null,
): Promise<{ ok: boolean }> {
  const q = query.trim();
  if (!q) return { ok: false };
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false };
  await supabase.from('faq_searches').insert({
    user_id: user.id,
    query: q.slice(0, 300),
    result_count: Math.max(0, Math.trunc(resultCount)),
    selected_article_id: selectedArticleId ?? null,
  });
  return { ok: true };
}

/** Incrementa a contagem de visualizações de um artigo publicado. */
export async function incrementarViewFaq(articleId: string): Promise<{ ok: boolean }> {
  const id = articleId.trim();
  if (!id) return { ok: false };
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false };
  await supabase.rpc('faq_increment_view', { p_article_id: id });
  return { ok: true };
}

export async function enviarFeedbackFaq(input: {
  articleId: string;
  wasHelpful: boolean | null;
  needsSupport?: boolean;
  comment?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Faça login.' };
  const id = input.articleId.trim();
  if (!id) return { ok: false, error: 'Artigo inválido.' };
  const { error } = await supabase.from('faq_feedback').insert({
    article_id: id,
    user_id: user.id,
    was_helpful: input.wasHelpful,
    needs_support: input.needsSupport ?? false,
    comment: input.comment?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---- Administração (staff) ----

export type FaqArtigoInput = {
  question: string;
  answer: string;
  short_answer?: string | null;
  category_id?: string | null;
  keywords?: string[];
  synonyms?: string[];
  visibility?: string[];
  status?: FaqStatus;
  is_featured?: boolean;
  display_order?: number;
  responsible_area?: string | null;
  owner_user_id?: string | null;
  review_due_at?: string | null;
};

async function slugUnicoArtigo(supabase: Awaited<ReturnType<typeof createClient>>, base: string, ignorarId?: string): Promise<string> {
  let slug = slugify(base) || 'pergunta';
  let tentativa = slug;
  let n = 1;
  // itera até achar um slug livre
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data } = await supabase.from('faq_articles').select('id').eq('slug', tentativa).maybeSingle();
    if (!data || (ignorarId && String((data as { id: string }).id) === ignorarId)) return tentativa;
    n += 1;
    tentativa = `${slug}-${n}`;
  }
}

export async function criarArtigoFaq(input: FaqArtigoInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };
  const { supabase, user } = staff;
  const question = input.question.trim();
  const answer = input.answer.trim();
  if (!question || !answer) return { ok: false, error: 'Pergunta e resposta são obrigatórias.' };

  const slug = await slugUnicoArtigo(supabase, question);
  const { data, error } = await supabase
    .from('faq_articles')
    .insert({
      question,
      slug,
      answer,
      short_answer: input.short_answer?.trim() || null,
      category_id: input.category_id ?? null,
      keywords: input.keywords ?? [],
      synonyms: input.synonyms ?? [],
      visibility: input.visibility ?? ['frank', 'team', 'admin'],
      status: input.status ?? 'draft',
      is_featured: input.is_featured ?? false,
      display_order: input.display_order ?? 0,
      responsible_area: input.responsible_area?.trim() || null,
      owner_user_id: input.owner_user_id ?? null,
      review_due_at: input.review_due_at ?? null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select('id')
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  revalidateFaq();
  return { ok: true, id: data ? String((data as { id: string }).id) : undefined };
}

export async function editarArtigoFaq(
  id: string,
  input: Partial<FaqArtigoInput>,
): Promise<{ ok: boolean; error?: string }> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };
  const { supabase, user } = staff;
  const aid = id.trim();
  if (!aid) return { ok: false, error: 'Artigo inválido.' };

  const patch: Record<string, unknown> = { updated_by: user.id };
  if (input.question !== undefined) patch.question = input.question.trim();
  if (input.answer !== undefined) patch.answer = input.answer.trim();
  if (input.short_answer !== undefined) patch.short_answer = input.short_answer?.trim() || null;
  if (input.category_id !== undefined) patch.category_id = input.category_id ?? null;
  if (input.keywords !== undefined) patch.keywords = input.keywords;
  if (input.synonyms !== undefined) patch.synonyms = input.synonyms;
  if (input.visibility !== undefined) patch.visibility = input.visibility;
  if (input.is_featured !== undefined) patch.is_featured = input.is_featured;
  if (input.display_order !== undefined) patch.display_order = input.display_order;
  if (input.responsible_area !== undefined) patch.responsible_area = input.responsible_area?.trim() || null;
  if (input.owner_user_id !== undefined) patch.owner_user_id = input.owner_user_id ?? null;
  if (input.review_due_at !== undefined) patch.review_due_at = input.review_due_at ?? null;

  const { error } = await supabase.from('faq_articles').update(patch).eq('id', aid);
  if (error) return { ok: false, error: error.message };
  revalidateFaq();
  return { ok: true };
}

/** Muda status (publicar/despublicar/arquivar/restaurar). */
export async function definirStatusArtigoFaq(
  id: string,
  status: FaqStatus,
): Promise<{ ok: boolean; error?: string }> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };
  const { supabase, user } = staff;
  const aid = id.trim();
  if (!aid) return { ok: false, error: 'Artigo inválido.' };
  const patch: Record<string, unknown> = { status, updated_by: user.id };
  patch.archived_at = status === 'archived' ? new Date().toISOString() : null;
  if (status === 'published') patch.reviewed_at = new Date().toISOString();
  const { error } = await supabase.from('faq_articles').update(patch).eq('id', aid);
  if (error) return { ok: false, error: error.message };
  revalidateFaq();
  return { ok: true };
}

export async function excluirArtigoFaq(id: string): Promise<{ ok: boolean; error?: string }> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };
  const { supabase } = staff;
  const { error } = await supabase.from('faq_articles').delete().eq('id', id.trim());
  if (error) return { ok: false, error: error.message };
  revalidateFaq();
  return { ok: true };
}

export async function definirRelacionadosFaq(
  articleId: string,
  relacionadosIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };
  const { supabase } = staff;
  const aid = articleId.trim();
  if (!aid) return { ok: false, error: 'Artigo inválido.' };
  await supabase.from('faq_related_articles').delete().eq('article_id', aid);
  const linhas = relacionadosIds
    .map((r) => r.trim())
    .filter((r) => r && r !== aid)
    .map((r) => ({ article_id: aid, related_article_id: r }));
  if (linhas.length > 0) {
    const { error } = await supabase.from('faq_related_articles').insert(linhas);
    if (error) return { ok: false, error: error.message };
  }
  revalidateFaq();
  return { ok: true };
}

// ---- Categorias (staff) ----

export type FaqCategoriaInput = {
  name: string;
  description?: string | null;
  icon?: string | null;
  display_order?: number;
  is_active?: boolean;
};

export async function criarCategoriaFaq(input: FaqCategoriaInput): Promise<{ ok: boolean; error?: string }> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };
  const { supabase } = staff;
  const name = input.name.trim();
  if (!name) return { ok: false, error: 'Nome obrigatório.' };
  let slug = slugify(name) || 'categoria';
  const { data: existe } = await supabase.from('faq_categories').select('id').eq('slug', slug).maybeSingle();
  if (existe) slug = `${slug}-${Date.now().toString(36)}`;
  const { error } = await supabase.from('faq_categories').insert({
    name,
    slug,
    description: input.description?.trim() || null,
    icon: input.icon?.trim() || null,
    display_order: input.display_order ?? 999,
    is_active: input.is_active ?? true,
  });
  if (error) return { ok: false, error: error.message };
  revalidateFaq();
  return { ok: true };
}

export async function editarCategoriaFaq(
  id: string,
  input: Partial<FaqCategoriaInput>,
): Promise<{ ok: boolean; error?: string }> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };
  const { supabase } = staff;
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description?.trim() || null;
  if (input.icon !== undefined) patch.icon = input.icon?.trim() || null;
  if (input.display_order !== undefined) patch.display_order = input.display_order;
  if (input.is_active !== undefined) patch.is_active = input.is_active;
  const { error } = await supabase.from('faq_categories').update(patch).eq('id', id.trim());
  if (error) return { ok: false, error: error.message };
  revalidateFaq();
  return { ok: true };
}
