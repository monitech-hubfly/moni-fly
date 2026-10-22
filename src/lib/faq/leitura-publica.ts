import { createAdminClient } from '@/lib/supabase/admin';
import type { FaqArticle, FaqCategory } from '@/types/faq';

const CATEGORY_SELECT = 'id, name, description, icon, slug, display_order, is_active';
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

function mapArticle(row: ArticleRow): FaqArticle {
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
    visibilidade: 'frank',
    proxima_revisao: row.review_due_at ? String(row.review_due_at).slice(0, 10) : null,
    slug: row.slug,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listarFaqPublica(): Promise<{ categories: FaqCategory[]; articles: FaqArticle[] }> {
  const admin = createAdminClient();
  const [categoriasRes, artigosRes] = await Promise.all([
    admin.from('faq_categories').select(CATEGORY_SELECT).eq('is_active', true).order('display_order', { ascending: true }),
    admin
      .from('faq_articles')
      .select(ARTICLE_SELECT)
      .eq('status', 'published')
      .order('display_order', { ascending: true }),
  ]);
  if (categoriasRes.error) throw new Error(categoriasRes.error.message);
  if (artigosRes.error) throw new Error(artigosRes.error.message);

  const categories = ((categoriasRes.data ?? []) as CategoryRow[]).map(mapCategory);
  const ordemCategoria = new Map(categories.map((categoria) => [categoria.id, categoria.ordem]));
  const articles = ((artigosRes.data ?? []) as ArticleRow[])
    .map(mapArticle)
    .filter((artigo) => artigo.categoria_id && (artigo.resposta_completa ?? '').trim())
    .sort((a, b) => {
      const ordemA = ordemCategoria.get(a.categoria_id) ?? 0;
      const ordemB = ordemCategoria.get(b.categoria_id) ?? 0;
      if (ordemA !== ordemB) return ordemA - ordemB;
      return a.ordem - b.ordem;
    });
  return { categories, articles };
}
