export interface FaqCategory {
  id: string;
  nome: string;
  descricao: string | null;
  icone: string | null;
  slug: string;
  ordem: number;
  ativo: boolean;
}

export interface FaqArticle {
  id: string;
  categoria_id: string;
  pergunta: string;
  resposta_resumida: string;
  resposta_completa: string | null;
  status: 'draft' | 'published' | 'archived';
  ordem: number;
  area_responsavel: string | null;
  palavras_chave: string[];
  sinonimos: string[];
  destaque: boolean;
  visibilidade: 'frank' | 'admin' | 'todos';
  proxima_revisao: string | null;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface FaqCategoryWithArticles extends FaqCategory {
  artigos: FaqArticle[];
}
