import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getNotificacoesResumo } from './actions';
import { SireneShell } from './SireneShell';

export default async function SireneLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();
  const userName = (profile?.full_name as string)?.trim() || user.email?.split('@')[0] || 'Usuário';

  const { totalNaoLidas, ultimas } = await getNotificacoesResumo();

  return (
    <SireneShell userName={userName} totalNaoLidas={totalNaoLidas} ultimasNotificacoes={ultimas}>
      {children}
    </SireneShell>
  );
}
