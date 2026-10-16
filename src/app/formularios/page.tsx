import Link from 'next/link';
import { redirect } from 'next/navigation';
import { guardLoginRequired } from '@/lib/auth-guard';
import { isAdminRole, normalizeAccessRole } from '@/lib/authz';
import { listarFormulariosAtivos } from '@/lib/actions/formulario-actions';
import { createClient } from '@/lib/supabase/server';
import { GerarLinkFormularioButton } from '@/components/formularios/GerarLinkFormularioButton';

export const dynamic = 'force-dynamic';

export default async function FormulariosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  guardLoginRequired(user);
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = normalizeAccessRole((profile as { role?: string } | null)?.role);
  if (role === 'frank') redirect('/portal-frank');
  if (!isAdminRole(role) && role !== 'team') redirect('/rede-franqueados');

  const data = await listarFormulariosAtivos();

  return (
    <div className="min-h-0 bg-[var(--moni-surface-50)]">
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="text-3xl" style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}>
          Formulários
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
          Modelos enviados por link público. O franqueado preenche sem entrar no Hub.
        </p>
        {!data.ok ? (
          <p className="mt-6 text-sm" style={{ color: 'var(--moni-status-overdue-text)' }}>
            {data.error}
          </p>
        ) : (
          <ul className="mt-8 space-y-4">
            {data.formularios.map((formulario) => (
              <li
                key={formulario.id}
                className="space-y-3 p-5"
                style={{
                  background: 'var(--moni-surface-0)',
                  border: 'var(--moni-border-width) solid var(--moni-border-default)',
                  borderRadius: 'var(--moni-radius-lg)',
                  boxShadow: 'var(--moni-shadow-card)',
                }}
              >
                <h2 className="text-xl" style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}>
                  {formulario.nome}
                </h2>
                {formulario.descricao ? (
                  <p className="text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
                    {formulario.descricao}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/formularios/${formulario.id}`}
                    className="inline-flex min-h-[44px] items-center px-4 text-sm font-semibold"
                    style={{
                      borderRadius: 'var(--moni-radius-md)',
                      border: 'var(--moni-border-width) solid var(--moni-border-default)',
                      color: 'var(--moni-text-primary)',
                      fontFamily: 'var(--moni-font-sans)',
                    }}
                  >
                    Ver respostas
                  </Link>
                  <GerarLinkFormularioButton formularioId={formulario.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
