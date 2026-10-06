'use server';

import { createClient } from '@/lib/supabase/server';
import type { FaqArticle, FaqCategory } from '@/types/faq';

/**
 * Colunas físicas (migration 455): name, question, visibility text[], etc.
 * A camada pública devolve os nomes em português do contrato do FAQ.
 */
const CATEGORY_SELECT =
  'id, name, description, icon, slug, display_order, is_active';

const ARTICLE_SELECT =
  'id, category_id, question, short_answer, answer, status, display_order, responsible_area, keywords, synonyms, is_featured, visibility, review_due_at, slug, created_at, updated_at';

type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  slug: string;
  display_order: number | null;
  is_active: boolean | null;
};

type ArticleRow = {
  id: string;
  category_id: string | null;
  question: string;
  short_answer: string | null;
  answer: string | null;
  status: string;
  display_order: number | null;
  responsible_area: string | null;
  keywords: string[] | null;
  synonyms: string[] | null;
  is_featured: boolean | null;
  visibility: string[] | null;
  review_due_at: string | null;
  slug: string;
  created_at: string;
  updated_at: string;
};

function mapCategory(row: CategoryRow): FaqCategory {
  return {
    id: row.id,
    nome: row.name,
    descricao: row.description,
    icone: row.icon,
    slug: row.slug,
    ordem: row.display_order ?? 0,
    ativo: row.is_active ?? true,
  };
}

function mapVisibilidade(visibility: string[] | null): FaqArticle['visibilidade'] {
  const lista = visibility ?? [];
  if (lista.includes('todos')) return 'todos';
  if (lista.includes('admin') && !lista.includes('frank')) return 'admin';
  return 'frank';
}

function mapArticle(row: ArticleRow): FaqArticle {
  const revisao = row.review_due_at ? String(row.review_due_at).slice(0, 10) : null;
  const status = row.status === 'draft' || row.status === 'archived' ? row.status : 'published';
  return {
    id: row.id,
    categoria_id: row.category_id ?? '',
    pergunta: row.question,
    resposta_resumida: row.short_answer ?? '',
    resposta_completa: row.answer,
    status,
    ordem: row.display_order ?? 0,
    area_responsavel: row.responsible_area,
    palavras_chave: row.keywords ?? [],
    sinonimos: row.synonyms ?? [],
    destaque: Boolean(row.is_featured),
    visibilidade: mapVisibilidade(row.visibility),
    proxima_revisao: revisao,
    slug: row.slug,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function termoBusca(query: string): string {
  return query
    .trim()
    .replace(/[%_,().*\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export async function getFaqCategories(): Promise<FaqCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('faq_categories')
    .select(CATEGORY_SELECT)
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as CategoryRow[]).map(mapCategory);
}

export async function getFaqArticlesByCategory(categoriaId: string): Promise<FaqArticle[]> {
  const id = categoriaId.trim();
  if (!id) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('faq_articles')
    .select(ARTICLE_SELECT)
    .eq('category_id', id)
    .eq('status', 'published')
    .contains('visibility', ['frank'])
    .order('display_order', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ArticleRow[]).map(mapArticle);
}

export async function getFaqAllPublished(): Promise<{ categories: FaqCategory[]; articles: FaqArticle[] }> {
  const supabase = await createClient();
  const [categoriasRes, artigosRes] = await Promise.all([
    supabase
      .from('faq_categories')
      .select(CATEGORY_SELECT)
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    supabase
      .from('faq_articles')
      .select(ARTICLE_SELECT)
      .eq('status', 'published')
      .contains('visibility', ['frank'])
      .order('display_order', { ascending: true }),
  ]);
  if (categoriasRes.error) throw new Error(categoriasRes.error.message);
  if (artigosRes.error) throw new Error(artigosRes.error.message);

  const categories = ((categoriasRes.data ?? []) as CategoryRow[]).map(mapCategory);
  const ordemCategoria = new Map(categories.map((categoria) => [categoria.id, categoria.ordem]));
  const articles = ((artigosRes.data ?? []) as ArticleRow[])
    .map(mapArticle)
    .sort((a, b) => {
      const ordemA = ordemCategoria.get(a.categoria_id) ?? 0;
      const ordemB = ordemCategoria.get(b.categoria_id) ?? 0;
      if (ordemA !== ordemB) return ordemA - ordemB;
      return a.ordem - b.ordem;
    });

  return { categories, articles };
}

export async function searchFaqArticles(query: string): Promise<FaqArticle[]> {
  const termo = termoBusca(query);
  if (!termo) return [];
  const supabase = await createClient();
  const { data: leves, error } = await supabase
    .from('faq_articles')
    .select('id, question, short_answer, answer, keywords, synonyms, display_order')
    .eq('status', 'published')
    .contains('visibility', ['frank'])
    .order('display_order', { ascending: true });
  if (error) throw new Error(error.message);

  const termoLower = semAcento(termo);
  const ids = ((leves ?? []) as Array<{
    id: string;
    question: string;
    short_answer: string | null;
    answer: string | null;
    keywords: string[] | null;
    synonyms: string[] | null;
  }>)
    .filter((row) => {
      const texto = semAcento(
        [
          row.question,
          row.short_answer ?? '',
          row.answer ?? '',
          (row.keywords ?? []).join(' '),
          (row.synonyms ?? []).join(' '),
        ].join(' '),
      );
      return texto.includes(termoLower);
    })
    .slice(0, 20)
    .map((row) => row.id);
  if (ids.length === 0) return [];

  const { data, error: erroArtigos } = await supabase
    .from('faq_articles')
    .select(ARTICLE_SELECT)
    .in('id', ids);
  if (erroArtigos) throw new Error(erroArtigos.message);

  const porId = new Map(((data ?? []) as ArticleRow[]).map((row) => [row.id, mapArticle(row)]));
  return ids.map((id) => porId.get(id)).filter((artigo): artigo is FaqArticle => artigo != null);
}

/** Não rejeita: a busca na tela não espera este insert. */
export async function recordFaqSearch(query: string, results_count: number): Promise<void> {
  const texto = query.trim();
  if (!texto) return;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from('faq_searches').insert({
      query: texto.slice(0, 500),
      result_count: Math.max(0, Math.floor(results_count)),
      user_id: user?.id ?? null,
    });
    if (error) console.error('[faq] recordFaqSearch', error.message);
  } catch (error) {
    console.error('[faq] recordFaqSearch', error instanceof Error ? error.message : error);
  }
}

export async function recordFaqFeedback(articleId: string, helpful: boolean): Promise<void> {
  const id = articleId.trim();
  if (!id) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return;
  const { error } = await supabase.from('faq_feedback').insert({
    article_id: id,
    user_id: user.id,
    was_helpful: helpful,
  });
  if (error) throw new Error(error.message);
}
