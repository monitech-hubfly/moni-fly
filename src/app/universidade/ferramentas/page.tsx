import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getBiblioteca } from '@/lib/universidade/queries';
import { BibliotecaClient } from '../biblioteca/BibliotecaClient';

export const dynamic = 'force-dynamic';

export default async function UniversidadeFerramentasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/universidade/ferramentas');

  const itens = await getBiblioteca(supabase);

  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const nomeFranqueado =
    (typeof meta?.full_name === 'string' && meta.full_name.trim()) ||
    (typeof meta?.name === 'string' && meta.name.trim()) ||
    user.email?.split('@')[0]?.trim() ||
    null;

  return <BibliotecaClient itens={itens} nomeFranqueado={nomeFranqueado} />;
}
