import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getBiblioteca } from '@/lib/universidade/queries';
import { BibliotecaClient } from './BibliotecaClient';

export const dynamic = 'force-dynamic';

export default async function UniversidadeBibliotecaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/universidade/biblioteca');

  const itens = await getBiblioteca(supabase);
  return <BibliotecaClient itens={itens} />;
}
