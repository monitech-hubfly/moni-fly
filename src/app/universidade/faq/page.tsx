import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getFaqAllPublished } from '@/lib/actions/faq-actions';
import type { FaqArticle, FaqCategory } from '@/types/faq';
import { FaqClient } from './FaqClient';

export const dynamic = 'force-dynamic';

export default async function FaqPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/universidade/faq');

  let categories: FaqCategory[] = [];
  let articles: FaqArticle[] = [];
  let erro = false;
  try {
    const publicado = await getFaqAllPublished();
    categories = publicado.categories;
    articles = publicado.articles;
  } catch {
    erro = true;
  }

  return <FaqClient categories={categories} articles={articles} erro={erro} />;
}
