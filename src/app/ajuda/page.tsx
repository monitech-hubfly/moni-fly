import type { FaqArticle, FaqCategory } from '@/types/faq';
import { listarFaqPublica } from '@/lib/faq/leitura-publica';
import { FaqClient } from '@/app/universidade/faq/FaqClient';

export const dynamic = 'force-dynamic';

export default async function AjudaPublicaPage() {
  let categories: FaqCategory[] = [];
  let articles: FaqArticle[] = [];
  let erro = false;
  try {
    const publicado = await listarFaqPublica();
    categories = publicado.categories;
    articles = publicado.articles;
  } catch {
    erro = true;
  }

  return <FaqClient categories={categories} articles={articles} erro={erro} publico />;
}
