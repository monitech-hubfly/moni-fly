import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import {
  FRANQUEADO_EMPRESA_STATUS_LABEL,
  fetchFranqueadoEmpresasRows,
  formatContaBancariaEmpresa,
  type FranqueadoEmpresaRow,
} from '@/lib/franqueado-empresas';
import { normalizeAccessRole } from '@/lib/authz';

export const dynamic = 'force-dynamic';

function EmpresaCard({
  titulo,
  empresa,
  docsHref,
}: {
  titulo: string;
  empresa: FranqueadoEmpresaRow | null;
  docsHref: string;
}) {
  if (!empresa) {
    return (
      <div
        className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm"
        style={{ border: '0.5px solid var(--moni-border-default)' }}
      >
        <h2 className="text-lg font-semibold text-stone-900">{titulo}</h2>
        <p className="mt-3 text-sm text-stone-500">Não cadastrada.</p>
      </div>
    );
  }

  const conta = formatContaBancariaEmpresa(
    empresa.conta_banco,
    empresa.conta_agencia,
    empresa.conta_numero,
  );

  return (
    <div
      className="flex h-full flex-col rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm"
      style={{ border: '0.5px solid var(--moni-border-default)' }}
    >
      <h2 className="text-lg font-semibold text-stone-900">{titulo}</h2>
      <dl className="mt-4 flex-1 space-y-3 text-sm">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-stone-500">Razão social</dt>
          <dd className="mt-0.5 text-stone-800">{empresa.razao_social?.trim() || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-stone-500">CNPJ</dt>
          <dd className="mt-0.5 text-stone-800">{empresa.cnpj?.trim() || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-stone-500">
            Inscrição municipal
          </dt>
          <dd className="mt-0.5 text-stone-800">{empresa.inscricao_municipal?.trim() || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-stone-500">
            Inscrição estadual
          </dt>
          <dd className="mt-0.5 text-stone-800">{empresa.inscricao_estadual?.trim() || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-stone-500">Status</dt>
          <dd className="mt-0.5 text-stone-800">
            {FRANQUEADO_EMPRESA_STATUS_LABEL[empresa.status] ?? empresa.status}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-stone-500">Conta bancária</dt>
          <dd className="mt-0.5 text-stone-800">{conta}</dd>
        </div>
      </dl>
      <Link
        href={docsHref}
        className="mt-6 inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
        style={{ background: 'var(--moni-navy-800)', borderRadius: 'var(--moni-radius-md)' }}
      >
        Ver documentos
      </Link>
    </div>
  );
}

export default async function MinhasEmpresasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?next=/minhas-empresas');

  const { data: prof } = await supabase
    .from('profiles')
    .select('role, rede_franqueado_id')
    .eq('id', user.id)
    .maybeSingle();

  const role = normalizeAccessRole((prof as { role?: string | null } | null)?.role);
  if (role !== 'frank') redirect('/');

  const redeId = String(
    (prof as { rede_franqueado_id?: string | null } | null)?.rede_franqueado_id ?? '',
  ).trim();

  if (!redeId) {
    return (
      <div className="min-h-screen bg-[var(--moni-surface-50)]">
        <main className="mx-auto max-w-3xl px-6 py-10">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-stone-900">
            <Building2 className="h-7 w-7 text-moni-primary" aria-hidden />
            Minhas Empresas
          </h1>
          <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Seu perfil ainda não está vinculado a uma linha da rede. Entre em contato com a equipe Moní.
          </p>
        </main>
      </div>
    );
  }

  const todas = await fetchFranqueadoEmpresasRows(supabase);

  if (todas === null) {
    return (
      <div className="min-h-screen bg-[var(--moni-surface-50)]">
        <main className="mx-auto max-w-3xl px-6 py-10">
          <h1 className="text-2xl font-bold text-stone-900">Minhas Empresas</h1>
          <p className="mt-4 text-sm text-red-700">Não foi possível carregar os dados das empresas.</p>
        </main>
      </div>
    );
  }

  const rows = todas.filter((e) => e.rede_franqueado_id === redeId);
  const incorporadora = rows.find((e) => e.tipo === 'incorporadora') ?? null;
  const gestora = rows.find((e) => e.tipo === 'gestora') ?? null;
  const nenhuma = !incorporadora && !gestora;
  const docsHref = `/rede-franqueados/${redeId}#empresas`;

  return (
    <div className="min-h-screen bg-[var(--moni-surface-50)]">
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-stone-900">
          <Building2 className="h-7 w-7 text-moni-primary" aria-hidden />
          Minhas Empresas
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          Dados cadastrais da sua Incorporadora e Gestora (somente leitura).
        </p>

        {nenhuma ? (
          <p className="mt-8 rounded-lg border border-stone-200 bg-white px-5 py-4 text-sm text-stone-700 shadow-sm">
            Seus dados de Incorporadora e Gestora ainda não foram preenchidos. Entre em contato com a equipe
            Moní.
          </p>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <EmpresaCard titulo="Incorporadora" empresa={incorporadora} docsHref={docsHref} />
            <EmpresaCard titulo="Gestora" empresa={gestora} docsHref={docsHref} />
          </div>
        )}
      </main>
    </div>
  );
}
