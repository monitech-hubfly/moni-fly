import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { normalizeAccessRole } from '@/lib/authz';
import { buscarHistoricoFormularios } from '@/lib/actions/formulario-qualificacao';
import { FormularioQualificacaoForm } from './FormularioQualificacaoForm';

export const dynamic = 'force-dynamic';

export default async function FormularioQualificacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    redirect(`/login?redirectTo=${encodeURIComponent(`/rede-franqueados/${id}/formulario-qualificacao`)}`);

  const { data: prof } = await supabase
    .from('profiles')
    .select('role, rede_franqueado_id')
    .eq('id', user.id)
    .single();

  const accessRole = normalizeAccessRole(prof?.role ?? '');

  // Frank: só pode ver a própria rede
  if (accessRole === 'frank') {
    if (!prof?.rede_franqueado_id || prof.rede_franqueado_id !== id) {
      redirect('/portal-frank');
    }
  } else if (accessRole !== 'admin') {
    redirect('/rede-franqueados');
  }

  // Buscar dados do franqueado
  const { data: rede, error: redeErr } = await supabase
    .from('rede_franqueados')
    .select('id, n_franquia, nome_completo')
    .eq('id', id)
    .single();

  if (redeErr || !rede) notFound();

  // Buscar histórico
  const { data: historico } = await buscarHistoricoFormularios(id);

  const nFranquia = String(rede.n_franquia ?? '');
  const nomeCompleto = String(rede.nome_completo ?? '');

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6">
        <Link
          href={`/rede-franqueados/${id}`}
          className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800"
        >
          <ChevronLeft size={13} />
          Voltar ao cadastro
        </Link>
      </nav>

      {/* Cabeçalho */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-stone-900">Formulário de Qualificação</h1>
        {nomeCompleto && (
          <p className="mt-1 text-sm text-stone-500">
            {nomeCompleto}
            {nFranquia ? <> &middot; <span className="font-medium">{nFranquia}</span></> : null}
          </p>
        )}
      </div>

      <FormularioQualificacaoForm
        redeId={id}
        nFranquia={nFranquia}
        nomeCompleto={nomeCompleto}
        historico={historico ?? []}
      />
    </div>
  );
}
