import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { guardLoginRequired } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';
import { isRedeStaffRole } from '@/lib/authz';
import { persistSeededStaffRoleIfNeeded } from '@/lib/seeded-staff-role';
import { carregarSimuladorTemplateDoCard } from '@/lib/actions/loteamento-simulador-template';
import { rowToSimuladorTemplateDraft } from '@/lib/loteamento-simulador-template';
import { SimuladorTemplateForm } from './SimuladorTemplateForm';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = { params: Promise<{ id: string }> };

export default async function SimuladorTemplatePage({ params }: Props) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  guardLoginRequired(user);

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const access = await persistSeededStaffRoleIfNeeded(
    supabase,
    { id: user.id, email: user.email },
    (profile as { role?: string } | null)?.role,
  );
  if (!isRedeStaffRole(access)) {
    redirect('/loteadores');
  }

  const loaded = await carregarSimuladorTemplateDoCard(id);
  if (!loaded.ok) {
    if (/não encontrado|não pertence/i.test(loaded.error)) notFound();
    return (
      <main
        className="mx-auto max-w-3xl px-4 py-8 sm:px-6"
        style={{ background: 'var(--moni-surface-50)', minHeight: '100%' }}
      >
        <Link
          href={`/loteadores?card=${id}`}
          className="text-sm"
          style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-sans)' }}
        >
          ← Voltar ao Funil Loteadores
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
      className="mx-auto max-w-3xl px-4 py-8 sm:px-6"
      style={{ background: 'var(--moni-surface-50)', minHeight: '100%' }}
    >
      <Link
        href={`/loteadores?card=${id}`}
        className="text-sm"
        style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-sans)' }}
      >
        ← Voltar ao card
      </Link>
      <h1
        className="mt-4 text-3xl sm:text-4xl"
        style={{
          fontFamily: 'var(--moni-font-display)',
          color: 'var(--moni-text-primary)',
        }}
      >
        Template do simulador
      </h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
        {loaded.cardTitulo}
        {loaded.loteadorNome ? ` · ${loaded.loteadorNome}` : ''}
      </p>
      <p className="mt-1 text-sm" style={{ color: 'var(--moni-text-tertiary)' }}>
        Percentuais e premissas deste loteamento. Ao salvar, o link e o QR para o corretor aparecem nesta tela.
      </p>
      <Link
        href={`/loteadores/${id}/simulador-template/ofertas`}
        className="mt-3 inline-flex min-h-[44px] items-center text-sm font-medium"
        style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-sans)' }}
      >
        Ir para ofertas →
      </Link>
      <div className="mt-8">
        <SimuladorTemplateForm
          cardId={id}
          cardTitulo={loaded.cardTitulo}
          draftInicial={rowToSimuladorTemplateDraft(loaded.template)}
          linkInicial={loaded.link}
        />
      </div>
    </main>
  );
}
