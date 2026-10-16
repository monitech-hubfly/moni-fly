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
    .select('id, n_franquia, nome_completo, cidade_casa_frank, estado_casa_frank, formulario_public_token')
    .eq('id', id)
    .single();

  if (redeErr || !rede) notFound();

  const { data: historico } = await buscarHistoricoFormularios(id);

  const nFranquia = String(rede.n_franquia ?? '');
  const nomeCompleto = String(rede.nome_completo ?? '');
  const cidadeInicial = String(rede.cidade_casa_frank ?? '');
  const estadoInicial = String(rede.estado_casa_frank ?? '');
  const publicToken = String((rede as unknown as Record<string, unknown>).formulario_public_token ?? '');

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

      {/* Public link for staff */}
      <div style={{ background: '#F0F4FF', borderBottom: '1px solid #C7D2FE', padding: '12px 24px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Link publico do formulario:</span>
          <code style={{ fontSize: 11, background: 'white', border: '1px solid #C7D2FE', borderRadius: 4, padding: '3px 8px', color: '#1E40AF', wordBreak: 'break-all' }}>
            {`${process.env.NEXT_PUBLIC_APP_URL || ''}/f/${publicToken}`}
          </code>
        </div>
      </div>

      <FormularioQualificacaoForm
        redeId={id}
        nFranquia={nFranquia}
        nomeCompleto={nomeCompleto}
        cidadeInicial={cidadeInicial}
        estadoInicial={estadoInicial}
        historico={historico ?? []}
        publicToken={publicToken}
      />
    </div>
  );
}
