import type { Metadata } from 'next';
import clsx from 'clsx';
import { redirect } from 'next/navigation';
import Casa1Hub from '@/components/casa1/Casa1Hub';
import { normalizeAccessRole } from '@/lib/authz';
import { getCasa0TudoConcluidoServer } from '@/lib/casa0-onboarding-setup';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Casa 1 — Universidade Operacional Moní',
};

export default async function Casa1Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/casa1');
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

  const casa0Concluida = await getCasa0TudoConcluidoServer(supabase, user.id);

  return (
    <div className="px-4 md:px-6">
      {!casa0Concluida ? (
        <div className="py-8">
          <div
            className={clsx(
              'relative min-h-[240px] overflow-hidden rounded-2xl border border-stone-200 bg-white p-6 shadow-sm',
              'opacity-50',
            )}
          >
            <div
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/40 px-4 backdrop-blur-[1px]"
              role="region"
              aria-label="Casa 1 bloqueada"
            >
              <p className="rounded-lg border border-stone-200 bg-white/95 px-4 py-2 text-center text-sm font-semibold text-stone-800 shadow-sm">
                Conclua a Casa 0 para desbloquear
              </p>
            </div>
          </div>
        </div>
      ) : (
        <Casa1Hub />
      )}
    </div>
  );
}
