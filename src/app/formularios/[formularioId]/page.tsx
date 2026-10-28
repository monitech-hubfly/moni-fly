import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listarRespostasDoFormulario } from '@/lib/actions/formulario-actions';
import { RespostasFormularioTabela } from '@/components/formularios/RespostasFormularioTabela';
import { GerarLinkFormularioButton } from '@/components/formularios/GerarLinkFormularioButton';

interface Props {
  params: Promise<{ formularioId: string }>;
}

export const dynamic = 'force-dynamic';

export default async function FormularioRespostasPage({ params }: Props) {
  const { formularioId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role === 'frank' || profile?.role === 'franqueado') {
    redirect('/portal-frank');
  }

  const { data: formulario } = await supabase
    .from('formularios')
    .select('id, nome, categoria')
    .eq('id', formularioId)
    .single();
  if (!formulario) redirect('/formularios');

  const respostas = await listarRespostasDoFormulario(formularioId);
  const categoria = String(formulario.categoria ?? '').trim();
  const total = respostas.length === 1 ? '1 envio' : `${respostas.length} envios`;

  return (
    <div className="min-h-0 bg-[var(--moni-surface-50)]">
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <Link href="/formularios" className="text-sm" style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-sans)' }}>
          ← Formulários
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            {categoria ? (
              <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>
                {categoria}
              </p>
            ) : null}
            <h1 className="text-3xl" style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}>
              {formulario.nome}
            </h1>
            <p className="text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
              {total}. Uma linha por card ou franquia, com o envio mais recente. Clique para ver as respostas.
            </p>
          </div>
          <GerarLinkFormularioButton formularioId={formulario.id} formularioNome={formulario.nome} />
        </div>
        <div
          className="mt-8 overflow-hidden"
          style={{
            background: 'var(--moni-surface-0)',
            border: 'var(--moni-border-width) solid var(--moni-border-default)',
            borderRadius: 'var(--moni-radius-lg)',
          }}
        >
          <RespostasFormularioTabela respostas={respostas} />
        </div>
      </main>
    </div>
  );
}
