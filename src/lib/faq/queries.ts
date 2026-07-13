import type { SupabaseClient } from '@supabase/supabase-js';
import type { FaqArticle, FaqArticleView, FaqCategory, FaqStatus } from './types';

const ARTICLE_SELECT =
  'id, question, slug, short_answer, answer, category_id, keywords, synonyms, visibility, status, is_featured, display_order, view_count, responsible_area, owner_user_id, reviewed_at, review_due_at, created_by, updated_by, created_at, updated_at, archived_at';

const ARTICLE_SELECT_WITH_CAT = `${ARTICLE_SELECT}, faq_categories ( name, slug )`;

type CategoriaEmbutida = { name?: string | null; slug?: string | null } | { name?: string | null; slug?: string | null }[] | null;

function nomeCat(row: { faq_categories?: CategoriaEmbutida }): { name: string | null; slug: string | null } {
  const c = row.faq_categories;
  const obj = Array.isArray(c) ? c[0] : c;
  return { name: obj?.name != null ? String(obj.name) : null, slug: obj?.slug != null ? String(obj.slug) : null };
}

export function mapCategory(r: Record<string, unknown>): FaqCategory {
  return {
    id: String(r.id),
    name: String(r.name),
    slug: String(r.slug),
    description: r.description != null ? String(r.description) : null,
    icon: r.icon != null ? String(r.icon) : null,
    display_order: Number(r.display_order ?? 0),
    is_active: r.is_active == null ? true : Boolean(r.is_active),
    created_at: r.created_at != null ? String(r.created_at) : null,
    updated_at: r.updated_at != null ? String(r.updated_at) : null,
  };
}

export function mapArticle(r: Record<string, unknown>): FaqArticleView {
  const base: FaqArticle = {
    id: String(r.id),
    question: String(r.question),
    slug: String(r.slug),
    short_answer: r.short_answer != null ? String(r.short_answer) : null,
    answer: String(r.answer),
    category_id: r.category_id != null ? String(r.category_id) : null,
    keywords: (r.keywords as string[] | null) ?? [],
    synonyms: (r.synonyms as string[] | null) ?? [],
    visibility: (r.visibility as string[] | null) ?? [],
    status: (String(r.status) as FaqStatus) ?? 'published',
    is_featured: Boolean(r.is_featured),
    display_order: Number(r.display_order ?? 0),
    view_count: Number(r.view_count ?? 0),
    responsible_area: r.responsible_area != null ? String(r.responsible_area) : null,
    owner_user_id: r.owner_user_id != null ? String(r.owner_user_id) : null,
    reviewed_at: r.reviewed_at != null ? String(r.reviewed_at) : null,
    review_due_at: r.review_due_at != null ? String(r.review_due_at) : null,
    created_by: r.created_by != null ? String(r.created_by) : null,
    updated_by: r.updated_by != null ? String(r.updated_by) : null,
    created_at: r.created_at != null ? String(r.created_at) : null,
    updated_at: r.updated_at != null ? String(r.updated_at) : null,
    archived_at: r.archived_at != null ? String(r.archived_at) : null,
  };
  const { name, slug } = nomeCat(r as { faq_categories?: CategoriaEmbutida });
  return { ...base, category_name: name, category_slug: slug };
}

/** Categorias ativas, ordenadas. (RLS já limita rascunhos/artigos.) */
export async function getFaqCategorias(supabase: SupabaseClient): Promise<FaqCategory[]> {
  const { data, error } = await supabase
    .from('faq_categories')
    .select('id, name, slug, description, icon, display_order, is_active, created_at, updated_at')
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => mapCategory(r as Record<string, unknown>));
}

/** Artigos publicados visíveis ao usuário (RLS aplica visibilidade/status). */
export async function getFaqArtigosPublicados(supabase: SupabaseClient): Promise<FaqArticleView[]> {
  const { data, error } = await supabase
    .from('faq_articles')
    .select(ARTICLE_SELECT_WITH_CAT)
    .eq('status', 'published')
    .order('display_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => mapArticle(r as Record<string, unknown>));
}

export async function getFaqArtigoPorSlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<FaqArticleView | null> {
  const s = slug.trim();
  if (!s) return null;
  const { data, error } = await supabase
    .from('faq_articles')
    .select(ARTICLE_SELECT_WITH_CAT)
    .eq('slug', s)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapArticle(data as Record<string, unknown>);
}

export async function getFaqRelacionados(
  supabase: SupabaseClient,
  articleId: string,
): Promise<FaqArticleView[]> {
  const { data: rel, error } = await supabase
    .from('faq_related_articles')
    .select('related_article_id')
    .eq('article_id', articleId);
  if (error) throw error;
  const ids = (rel ?? []).map((r) => String((r as { related_article_id: string }).related_article_id));
  if (ids.length === 0) return [];
  const { data, error: e2 } = await supabase
    .from('faq_articles')
    .select(ARTICLE_SELECT_WITH_CAT)
    .in('id', ids)
    .eq('status', 'published');
  if (e2) throw e2;
  return (data ?? []).map((r) => mapArticle(r as Record<string, unknown>));
}

/** Mesma categoria (fallback quando não há relacionados explícitos). */
export async function getFaqMesmaCategoria(
  supabase: SupabaseClient,
  categoryId: string | null,
  excluirId: string,
  limite = 4,
): Promise<FaqArticleView[]> {
  if (!categoryId) return [];
  const { data, error } = await supabase
    .from('faq_articles')
    .select(ARTICLE_SELECT_WITH_CAT)
    .eq('category_id', categoryId)
    .eq('status', 'published')
    .neq('id', excluirId)
    .order('display_order', { ascending: true })
    .limit(limite);
  if (error) throw error;
  return (data ?? []).map((r) => mapArticle(r as Record<string, unknown>));
}

// ---- Admin (staff) ----

/** Todos os artigos (qualquer status) — RLS libera só para admin/team. */
export async function getFaqArtigosAdmin(supabase: SupabaseClient): Promise<FaqArticleView[]> {
  const { data, error } = await supabase
    .from('faq_articles')
    .select(ARTICLE_SELECT_WITH_CAT)
    .order('display_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => mapArticle(r as Record<string, unknown>));
}

export async function getFaqCategoriasAdmin(supabase: SupabaseClient): Promise<FaqCategory[]> {
  const { data, error } = await supabase
    .from('faq_categories')
    .select('id, name, slug, description, icon, display_order, is_active, created_at, updated_at')
    .order('display_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => mapCategory(r as Record<string, unknown>));
}
