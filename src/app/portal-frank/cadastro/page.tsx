import Link from 'next/link';
import { validarTokenConviteFrank } from '@/app/portal-frank/actions';
import { CadastroConviteForm } from './CadastroConviteForm';

export const dynamic = 'force-dynamic';

type Search = { [key: string]: string | string[] | undefined };

export default async function PortalFrankCadastroPage({ searchParams }: { searchParams: Search }) {
  const raw = searchParams.token;
  const token = typeof raw === 'string' ? raw.trim() : Array.isArray(raw) ? String(raw[0] ?? '').trim() : '';

  const val = token ? await validarTokenConviteFrank(token) : ({ ok: false, error: 'Token ausente.' } as const);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--moni-surface-50)] px-4 py-12">
      <div
        className="w-full max-w-2xl rounded-xl border bg-white p-8 shadow-sm"
        style={{ borderColor: 'var(--moni-border-default)' }}
      >
        <h1 className="text-xl font-semibold text-stone-900">Cadastro — Portal do Franqueado</h1>
        {!val.ok ? (
          <>
            <p className="mt-2 text-sm text-red-600">{val.error}</p>
            <p className="mt-4 text-center text-sm">
              <Link href="/portal-frank/login" className="text-moni-primary hover:underline">
                Ir para o login
              </Link>
            </p>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-stone-500">Convite válido. Defina sua senha.</p>
            <CadastroConviteForm token={token} emailConvite={val.emailConvite} redePrefill={val.rede} />
          </>
        )}
      </div>
    </div>
  );
}
