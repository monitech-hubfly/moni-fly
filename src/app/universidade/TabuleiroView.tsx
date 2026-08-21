import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCasasComProgresso, getCertificados } from '@/lib/universidade/queries';
import { UniversidadeTabuleiroClient } from './UniversidadeTabuleiroClient';
import { UniversidadeSecondaryNav } from '@/components/universidade/UniversidadeSecondaryNav';

/** View compartilhada do Tabuleiro (usada por /universidade e /universidade/tabuleiro). */
export async function TabuleiroView({ nextPath }: { nextPath: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);

  const [casas, certificados] = await Promise.all([
    getCasasComProgresso(supabase, user.id),
    getCertificados(supabase, user.id),
  ]);

  return (
    <>
      <UniversidadeSecondaryNav />
      <UniversidadeTabuleiroClient casas={casas} certificados={certificados} />
    </>
  );
}
