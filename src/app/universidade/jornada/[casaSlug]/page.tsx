import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCasaBySlug, getProgressoUsuario, verificarDesbloqueioDb } from '@/lib/universidade/queries';
import { CasaJornadaClient } from './CasaJornadaClient';

export const dynamic = 'force-dynamic';

export default async function UniversidadeJornadaCasaPage({ params }: { params: { casaSlug: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/universidade/jornada/${params.casaSlug}`);

  const slug = decodeURIComponent(params.casaSlug);
  const casa = await getCasaBySlug(supabase, slug);
  if (!casa) notFound();

  const unlocked = await verificarDesbloqueioDb(supabase, user.id, casa.numero);
  if (!unlocked) redirect('/universidade');

  const progresso = await getProgressoUsuario(supabase, user.id);

  return <CasaJornadaClient casa={casa} progresso={progresso} />;
}
