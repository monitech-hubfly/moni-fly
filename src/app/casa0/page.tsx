import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Casa0Hub from '@/components/casa0-hub';
import { normalizeAccessRole } from '@/lib/authz';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Casa 0 — Universidade Operacional Moní',
};

export default async function Casa0Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/casa0');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = normalizeAccessRole((profile as { role?: string | null } | null)?.role);

  if (role !== 'frank' && role !== 'admin') {
    redirect(role === 'team' ? '/admin/universidade' : '/rede-franqueados');
  }

  return (
    <div className="px-4 md:px-6">
      <Casa0Hub />
    </div>
  );
}
