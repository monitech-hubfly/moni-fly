import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
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
  const role = String((prof as { role?: string | null } | null)?.role ?? '').toLowerCase();
  const staff = role === 'admin' || role === 'team' || role === 'consultor';
  const frank = role === 'frank' || role === 'franqueado';

  if (!staff && !frank) redirect('/');

  if (frank) {
    const rid = (prof as { rede_franqueado_id?: string | null } | null)?.rede_franqueado_id;
    const own = rid != null && String(rid) === id;
    if (!own) redirect('/portal-frank/rede');
  }

  const { data: row, error } = await supabase
    .from('rede_franqueados')
    .select('id, nome_completo, n_franquia, anexo_cof_path, anexo_contrato_path')
    .eq('id', id)
    .maybeSingle();

  if (error || !row) notFound();

  const nome = String((row as { nome_completo?: string | null }).nome_completo ?? '').trim() || 'Franqueado';
  const nfr = String((row as { n_franquia?: string | null }).n_franquia ?? '').trim();
  const pathCof = (row as { anexo_cof_path?: string | null }).anexo_cof_path ?? null;
  const pathContrato = (row as { anexo_contrato_path?: string | null }).anexo_contrato_path ?? null;
  const hasCof = Boolean(pathCof && String(pathCof).trim());
  const hasContrato = Boolean(pathContrato && String(pathContrato).trim());

  const voltarHref = staff ? '/rede-franqueados' : '/portal-frank/rede';
  const voltarLabel = staff ? 'Voltar à rede' : 'Voltar à rede (portal)';

  return (
    <div className="min-h-screen bg-stone-50">
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link href={voltarHref} className="mb-4 inline-block text-sm text-moni-primary hover:underline">
          ← {voltarLabel}
        </Link>
        <h1 className="text-xl font-bold text-moni-dark">{nome}</h1>
        {nfr ? <p className="mt-1 text-sm text-stone-600">Nº franquia: {nfr}</p> : null}

        <div className="mt-8">
          {staff ? (
            <RedeFranqueadoDetalheDocs redeId={id} pathCof={pathCof} pathContrato={pathContrato} />
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
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
