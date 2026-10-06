import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { guardLoginRequired } from '@/lib/auth-guard';
import { isAdminRole, normalizeAccessRole } from '@/lib/authz';
import { listarRespostasFormulario } from '@/lib/actions/formulario-actions';
import { createClient } from '@/lib/supabase/server';
import { GerarLinkFormularioButton } from '@/components/formularios/GerarLinkFormularioButton';
import { RespostasFormularioLista } from '@/components/formularios/RespostasFormularioLista';

export const dynamic = 'force-dynamic';

export default async function FormularioRespostasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  guardLoginRequired(user);
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = normalizeAccessRole((profile as { role?: string } | null)?.role);
  if (role === 'frank') redirect('/portal-frank');
  if (!isAdminRole(role) && role !== 'team') redirect('/rede-franqueados');

  const { data: form } = await supabase.from('formularios').select('id, nome, descricao').eq('id', id).maybeSingle();
  if (!form) notFound();
  const respostas = await listarRespostasFormulario(id);

  return (
    <div className="min-h-0 bg-[var(--moni-surface-50)]">
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <Link href="/formularios" className="text-sm" style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-sans)' }}>
          ← Formulários
        </Link>
        <h1 className="mt-3 text-3xl" style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}>
          {(form as { nome: string }).nome}
        </h1>
        <div className="mt-4">
          <GerarLinkFormularioButton formularioId={id} />
        </div>
        <div className="mt-8">
          {respostas.ok ? (
            <RespostasFormularioLista respostas={respostas.respostas} />
          ) : (
            <p className="text-sm" style={{ color: 'var(--moni-status-overdue-text)' }}>
              {respostas.error}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
