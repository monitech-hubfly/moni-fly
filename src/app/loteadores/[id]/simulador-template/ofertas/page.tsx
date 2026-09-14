import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { guardLoginRequired } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';
import { isRedeStaffRole, normalizeAccessRole } from '@/lib/authz';
import { carregarSimuladorTemplateDoCard } from '@/lib/actions/loteamento-simulador-template';
import { rowToTemplateConfig } from '@/lib/loteamento-simulador-template';
import { CalculadoraOferta } from '@/components/simulador/CalculadoraOferta';
import { SimuladorOfertasClient } from './SimuladorOfertasClient';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = { params: Promise<{ id: string }> };

export default async function SimuladorOfertasPage({ params }: Props) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  guardLoginRequired(user);

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const access = normalizeAccessRole((profile as { role?: string } | null)?.role);
  if (!isRedeStaffRole(access)) {
    redirect('/loteadores');
  }

  const loaded = await carregarSimuladorTemplateDoCard(id);
  if (!loaded.ok) {
    if (/não encontrado|não pertence/i.test(loaded.error)) notFound();
    return (
      <main
        className="mx-auto max-w-5xl px-4 py-8 sm:px-6"
        style={{ background: 'var(--moni-surface-50)', minHeight: '100%' }}
      >
        <Link
          href={`/loteadores/${id}/simulador-template`}
          className="text-sm"
          style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-sans)' }}
        >
          ← Voltar ao template
        </Link>
        <div
          className="moni-tag-atrasado mt-6 px-4 py-3 text-sm"
          style={{ borderRadius: 'var(--moni-radius-md)' }}
        >
          {loaded.error}
        </div>
      </main>
    );
  }

  return (
    <main
        className="mx-auto max-w-5xl px-4 py-8 sm:px-6"
        style={{ background: 'var(--moni-surface-50)', minHeight: '100%' }}
      >
        <Link
          href={`/loteadores/${id}/simulador-template`}
          className="text-sm"
          style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-sans)' }}
        >
          ← Voltar ao template
        </Link>
        <h1
          className="mt-4 text-3xl sm:text-4xl"
          style={{
            fontFamily: 'var(--moni-font-display)',
            color: 'var(--moni-text-primary)',
          }}
        >
          Ofertas do simulador
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
          {loaded.cardTitulo}
          {loaded.loteadorNome ? ` · ${loaded.loteadorNome}` : ''}
        </p>
        <p className="mt-1 text-sm" style={{ color: 'var(--moni-text-tertiary)' }}>
          Uma oferta por lote ou modelo de casa. O template traz as premissas da loteadora.
        </p>
        <div className="mt-8 flex flex-col gap-10">
          {loaded.template ? (
            <>
              <SimuladorOfertasClient ofertas={loaded.simulacoes} />
              <CalculadoraOferta
                template={rowToTemplateConfig(loaded.template)}
                loteadorId={id}
                kanbanCardId={id}
              />
            </>
          ) : (
          <div
            className="rounded-[var(--moni-radius-lg)] p-5"
            style={{
              border: 'var(--moni-border-width) solid var(--moni-border-default)',
              background: 'var(--moni-surface-0)',
              boxShadow: 'var(--moni-shadow-card)',
            }}
          >
            <p className="text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
              Salve o template antes de criar ofertas.
            </p>
            <Link
              href={`/loteadores/${id}/simulador-template`}
              className="mt-4 inline-flex min-h-[44px] items-center rounded-[var(--moni-radius-md)] px-4 text-sm font-medium text-white"
              style={{ background: 'var(--moni-navy-800)' }}
            >
              Ir ao template
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
