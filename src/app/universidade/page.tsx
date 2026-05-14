import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCasasComProgresso, getCertificados } from '@/lib/universidade/queries';
import { UniversidadeTabuleiroClient } from './UniversidadeTabuleiroClient';

export const dynamic = 'force-dynamic';

export default async function UniversidadePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/universidade');

  const [casas, certificados] = await Promise.all([
    getCasasComProgresso(supabase, user.id),
    getCertificados(supabase, user.id),
  ]);

  return <UniversidadeTabuleiroClient casas={casas} certificados={certificados} />;
}
