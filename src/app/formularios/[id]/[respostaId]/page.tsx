import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { guardLoginRequired } from '@/lib/auth-guard';
import { isAdminRole, normalizeAccessRole } from '@/lib/authz';
import { buscarRespostaDetalhe } from '@/lib/actions/formulario-actions';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function textoValor(valor: {
  valor_texto: string | null;
  valor_numero: number | null;
  valor_data: string | null;
  valor_json: unknown;
}): string {
  if (Array.isArray(valor.valor_json)) return valor.valor_json.map((item) => String(item)).join(', ') || '—';
  if (valor.valor_data) return valor.valor_data;
  if (valor.valor_numero != null && valor.valor_texto) return valor.valor_texto;
  if (valor.valor_numero != null) return String(valor.valor_numero);
  return valor.valor_texto?.trim() || '—';
}

export default async function FormularioRespostaDetalhePage({
  params,
}: {
  params: Promise<{ id: string; respostaId: string }>;
}) {
  const { id, respostaId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  guardLoginRequired(user);
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = normalizeAccessRole((profile as { role?: string } | null)?.role);
  if (role === 'frank') redirect('/portal-frank');
  if (!isAdminRole(role) && role !== 'team') redirect('/rede-franqueados');

  const detalhe = await buscarRespostaDetalhe(respostaId);
  if (!detalhe.ok) notFound();
  if (detalhe.resposta.formulario_id !== id) notFound();
  const resposta = detalhe.resposta;

  return (
    <div className="min-h-0 bg-[var(--moni-surface-50)]">
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <Link href={`/formularios/${id}`} className="text-sm" style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-sans)' }}>
          ← Respostas
        </Link>
        <h1 className="mt-3 text-3xl" style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}>
          {resposta.formulario_nome}
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
          {resposta.status === 'enviado' ? 'Enviado' : 'Rascunho'}
          {resposta.nome_franqueado ? ` · ${resposta.nome_franqueado}` : ''}
          {resposta.numero_franquia ? ` · ${resposta.numero_franquia}` : ''}
        </p>
        <dl className="mt-8 space-y-4">
          {resposta.valores.map((valor) => (
            <div key={valor.campo_id}>
              <dt className="text-xs" style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>
                {valor.campo_nome}
              </dt>
              <dd className="text-sm" style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}>
                {textoValor(valor)}
              </dd>
            </div>
          ))}
          {resposta.arquivos.map((arquivo) => (
            <div key={arquivo.id}>
              <dt className="text-xs" style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>
                Arquivo
              </dt>
              <dd className="text-sm" style={{ fontFamily: 'var(--moni-font-sans)' }}>
                {arquivo.url ? (
                  <a href={arquivo.url} style={{ color: 'var(--moni-navy-800)' }} target="_blank" rel="noreferrer">
                    {arquivo.nome_arquivo}
                  </a>
                ) : (
                  arquivo.nome_arquivo
                )}
              </dd>
            </div>
          ))}
        </dl>
      </main>
    </div>
  );
}
