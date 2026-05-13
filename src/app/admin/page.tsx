import { guardLoginRequired } from '@/lib/auth-guard';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { normalizeAccessRole } from '@/lib/authz';

export const dynamic = 'force-dynamic';

export default async function AdminHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  guardLoginRequired(user);

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (normalizeAccessRole((me as { role?: string } | null)?.role) !== 'admin') {
    redirect('/rede-franqueados');
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--moni-surface-50)' }}>
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
          Administração
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
          Ferramentas restritas a administradores.
        </p>
        <ul className="mt-8 space-y-3">
          <li>
            <Link
              href="/admin/usuarios"
              className="block rounded-xl border px-4 py-4 text-sm font-medium transition hover:opacity-95"
              style={{
                borderColor: 'var(--moni-border-default)',
                background: 'var(--moni-surface-0)',
                color: 'var(--moni-navy-800)',
              }}
            >
              Gerenciar usuários
            </Link>
          </li>
          <li>
            <Link
              href="/admin/sla"
              className="block rounded-xl border px-4 py-4 text-sm font-medium transition hover:opacity-95"
              style={{
                borderColor: 'var(--moni-border-default)',
                background: 'var(--moni-surface-0)',
                color: 'var(--moni-navy-800)',
              }}
            >
              SLA das fases
            </Link>
          </li>
        </ul>
      </main>
    </div>
  );
}
