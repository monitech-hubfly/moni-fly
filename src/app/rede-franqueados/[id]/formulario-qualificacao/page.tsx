import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { normalizeAccessRole } from '@/lib/authz';
import { buscarHistoricoFormularios } from '@/lib/actions/formulario-qualificacao';
import FormularioQualificacaoForm from './FormularioQualificacaoForm';

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

  // Frank: so pode ver a propria rede
  if (accessRole === 'frank') {
    if (!prof?.rede_franqueado_id || prof.rede_franqueado_id !== id) {
      redirect('/portal-frank');
    }
  } else if (accessRole !== 'admin') {
    redirect('/rede-franqueados');
  }

  const { data: rede, error: redeErr } = await supabase
    .from('rede_franqueados')
    .select('id, n_franquia, nome_completo')
    .eq('id', id)
    .single();

  if (redeErr || !rede) notFound();

  const { data: historico } = await buscarHistoricoFormularios(id);

  const nFranquia = String(rede.n_franquia ?? '');
  const nomeCompleto = String(rede.nome_completo ?? '');

  return (
    <div>
      {/* Breadcrumb */}
      <nav style={{ padding: '12px 24px', background: '#0F1E33' }}>
        <Link
          href={`/rede-franqueados/${id}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#94A3B8', textDecoration: 'none' }}
        >
          <ChevronLeft size={13} />
          Voltar ao cadastro
        </Link>
      </nav>

      <FormularioQualificacaoForm
        redeId={id}
        nFranquia={nFranquia}
        nomeCompleto={nomeCompleto}
        historico={historico ?? []}
      />
    </div>
  );
}
