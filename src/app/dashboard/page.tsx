import { redirect } from 'next/navigation';
import { normalizeAccessRole } from '@/lib/authz';
import { guardLoginRequired } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';

/** Hub de redirecionamento (ex.: acesso negado ao Funil Contratações). */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  guardLoginRequired(user);

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (normalizeAccessRole((profile as { role?: string | null } | null)?.role) === 'frank') {
    redirect('/portal-frank');
  }

  redirect('/dashboard-novos-negocios');
}
