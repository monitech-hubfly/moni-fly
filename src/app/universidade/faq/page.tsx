import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getFaqArtigosPublicados, getFaqCategorias } from '@/lib/faq/queries';
import { UniversidadeSecondaryNav } from '@/components/universidade/UniversidadeSecondaryNav';
import { FaqClient } from './FaqClient';

export const dynamic = 'force-dynamic';

export default async function FaqPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/universidade/faq');

  let erro = false;
  let categorias: Awaited<ReturnType<typeof getFaqCategorias>> = [];
  let artigos: Awaited<ReturnType<typeof getFaqArtigosPublicados>> = [];
  try {
    [categorias, artigos] = await Promise.all([
      getFaqCategorias(supabase),
      getFaqArtigosPublicados(supabase),
    ]);
  } catch {
    erro = true;
  }

  return (
    <>
      <UniversidadeSecondaryNav />
      <FaqClient categorias={categorias} artigos={artigos} erro={erro} />
    </>
  );
}
