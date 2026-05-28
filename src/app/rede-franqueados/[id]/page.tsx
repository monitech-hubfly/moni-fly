import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { normalizeAccessRole } from '@/lib/authz';
import { fetchRedeFranqueadoDetalheForPage } from '@/lib/rede-franqueados';
import { RedeFranqueadoDetalheDocs } from './RedeFranqueadoDetalheDocs';

export const dynamic = 'force-dynamic';

export default async function RedeFranqueadoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirectTo=${encodeURIComponent(`/rede-franqueados/${id}`)}`);

  const { data: prof } = await supabase
    .from('profiles')
    .select('role, rede_franqueado_id')
    .eq('id', user.id)
    .maybeSingle();
  const access = normalizeAccessRole((prof as { role?: string | null } | null)?.role);
  const staff = access === 'admin' || access === 'team';
  const frank = access === 'frank';

  if (!staff && !frank) redirect('/');

  if (frank) {
    const rid = (prof as { rede_franqueado_id?: string | null } | null)?.rede_franqueado_id;
    const own = rid != null && String(rid) === id;
    if (!own) redirect('/portal-frank/rede');
  }

  const { row, error: loadError } = await fetchRedeFranqueadoDetalheForPage(supabase, id, {
    staffUseAdminFallback: staff,
  });

  if (loadError && !row) {
    return (
      <div className="min-h-screen bg-[var(--moni-surface-50)]">
        <main className="mx-auto max-w-5xl px-6 py-8">
          <Link href="/rede-franqueados" className="mb-4 inline-block text-sm text-[#0c2633] hover:underline">
            ← Voltar à rede
          </Link>
          <div className="rounded-lg border border-red-200/80 border-l-4 border-l-red-600 bg-red-50/90 px-4 py-3 text-sm text-red-900">
            Não foi possível carregar este franqueado: {loadError}
          </div>
        </main>
      </div>
    );
  }

  if (!row) notFound();

  const nome = String(row.nome_completo ?? '').trim() || 'Franqueado';
  const nfr = String(row.n_franquia ?? '').trim();
  const pathCof = row.anexo_cof_path ?? null;
  const pathContrato = row.anexo_contrato_path ?? null;
  const pathNumeroFranquia = row.anexo_numero_franquia_path ?? null;
  const hasCof = Boolean(pathCof && String(pathCof).trim());
  const hasContrato = Boolean(pathContrato && String(pathContrato).trim());
  const hasNumeroFranquia = Boolean(pathNumeroFranquia && String(pathNumeroFranquia).trim());

  const voltarHref = staff ? '/rede-franqueados' : '/portal-frank/rede';
  const voltarLabel = staff ? 'Voltar à rede' : 'Voltar à rede (portal)';

  return (
    <div className="min-h-screen bg-[var(--moni-surface-50)]">
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Link href={voltarHref} className="mb-4 inline-block text-sm text-[#0c2633] hover:underline">
          ← {voltarLabel}
        </Link>
        <h1 className="text-xl font-bold text-moni-dark">{nome}</h1>
        {nfr ? <p className="mt-1 text-sm text-stone-600">Nº franquia: {nfr}</p> : null}

        <div className="mt-8">
          {staff ? (
            <RedeFranqueadoDetalheDocs
              redeId={id}
              pathCof={pathCof}
              pathContrato={pathContrato}
              pathNumeroFranquia={pathNumeroFranquia}
            />
          ) : (
            <div className="space-y-6 rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-stone-600">
                Os documentos assinados ficam armazenados pela equipe Moni. Você vê apenas se já há arquivo
                cadastrado; o download fica restrito ao time interno.
              </p>
              <div>
                <h2 className="text-sm font-semibold text-stone-800">COF assinado</h2>
                <p className="mt-1 text-sm text-stone-700">{hasCof ? 'Arquivo cadastrado.' : 'Nenhum arquivo cadastrado.'}</p>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-stone-800">Contrato assinado</h2>
                <p className="mt-1 text-sm text-stone-700">
                  {hasContrato ? 'Arquivo cadastrado.' : 'Nenhum arquivo cadastrado.'}
                </p>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-stone-800">Documento de número de franquia</h2>
                <p className="mt-1 text-sm text-stone-700">
                  {hasNumeroFranquia ? 'Arquivo cadastrado.' : 'Nenhum arquivo cadastrado.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
