export type FaqStatus = 'draft' | 'published' | 'archived';

export type FaqCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type FaqArticle = {
  id: string;
  question: string;
  slug: string;
  short_answer: string | null;
  answer: string;
  category_id: string | null;
  keywords: string[];
  synonyms: string[];
  visibility: string[];
  status: FaqStatus;
  is_featured: boolean;
  display_order: number;
  view_count: number;
  responsible_area: string | null;
  owner_user_id: string | null;
  reviewed_at: string | null;
  review_due_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  archived_at: string | null;
};

/** Artigo já com nome/slug da categoria resolvidos (para exibição). */
export type FaqArticleView = FaqArticle & {
  category_name: string | null;
  category_slug: string | null;
};

export type FaqArticleDetalhe = {
  artigo: FaqArticleView;
  relacionados: FaqArticleView[];
};
