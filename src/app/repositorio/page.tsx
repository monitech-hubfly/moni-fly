import Link from 'next/link';
import { redirect } from 'next/navigation';
import { guardLoginRequired } from '@/lib/auth-guard';
import { isAdminRole, normalizeAccessRole } from '@/lib/authz';
import { createClient } from '@/lib/supabase/server';
import { listarRepositorio } from './actions';
import { RepositorioClient } from './RepositorioClient';

export default async function RepositorioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  guardLoginRequired(user);

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = normalizeAccessRole((profile as { role?: string } | null)?.role);

  if (role === 'frank') redirect('/portal-frank');
  if (!isAdminRole(role) && role !== 'team') redirect('/rede-franqueados');

  const data = await listarRepositorio();
  const secoes = data.ok ? data.secoes : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 via-white to-stone-50">
      <header className="border-b border-stone-200/80 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-4 px-4">
          <Link href="/" className="text-sm font-medium text-moni-primary hover:underline">
            ← Início
          </Link>
          <span className="text-stone-300">/</span>
          <span className="text-sm font-medium text-stone-700">Repositório</span>
        </div>
      </header>

      <main>
        {!data.ok ? (
          <div className="mx-auto max-w-4xl px-4 py-10">
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {data.error}
            </p>
          </div>
        ) : (
          <RepositorioClient initialSecoes={secoes} isAdmin={isAdminRole(role)} />
        )}
      </main>
    </div>
  );
}
