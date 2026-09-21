import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { guardLoginRequired } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';
import { isRedeStaffRole } from '@/lib/authz';
import { persistSeededStaffRoleIfNeeded } from '@/lib/seeded-staff-role';
import { carregarSimuladorOfertaDoCard } from '@/lib/actions/loteamento-simulador-template';
import { carregarImobSimulacoesCard } from '@/lib/kanban/carregar-imob-simulacoes-card';
import { rotuloEmpreendimentoOrigem } from '@/lib/kanban/imob-simulacoes-card';
import { OfertaDetalheCliente } from './OfertaDetalheCliente';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const linkVoltaStyle = {
  color: 'var(--moni-navy-800)',
  fontFamily: 'var(--moni-font-sans)',
} as const;

function LinksVoltaOferta({ cardId }: { cardId: string }) {
  return (
    <nav className="flex flex-col items-start gap-1" aria-label="Voltar">
      <Link
        href={`/loteadores/${cardId}/simulador-template/ofertas`}
        className="inline-flex min-h-[44px] items-center text-sm sm:min-h-0"
        style={linkVoltaStyle}
      >
        ← Voltar às ofertas
      </Link>
      <Link
        href={`/loteadores?card=${cardId}`}
        className="inline-flex min-h-[44px] items-center text-sm sm:min-h-0"
        style={linkVoltaStyle}
      >
        ← Voltar ao card
      </Link>
    </nav>
  );
}

type Props = { params: Promise<{ id: string; ofertaId: string }> };

export default async function SimuladorOfertaDetalhePage({ params }: Props) {
  const { id, ofertaId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(ofertaId)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  guardLoginRequired(user);

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const access = await persistSeededStaffRoleIfNeeded(
    supabase,
    { id: user.id, email: user.email },
    (profile as { role?: string } | null)?.role,
  );
  if (!isRedeStaffRole(access)) {
    redirect('/loteadores');
  }

  const loaded = await carregarSimuladorOfertaDoCard(id, ofertaId);
  if (!loaded.ok) {
    if (/não encontrad/i.test(loaded.error)) notFound();
    return (
      <main
        className="mx-auto max-w-5xl px-4 py-8 sm:px-6"
        style={{ background: 'var(--moni-surface-50)', minHeight: '100%' }}
      >
        <LinksVoltaOferta cardId={id} />
        <div
          className="moni-tag-atrasado mt-6 px-4 py-3 text-sm"
          style={{ borderRadius: 'var(--moni-radius-md)' }}
        >
          {loaded.error}
        </div>
      </main>
    );
  }

  const oferta = loaded.oferta;

  let empreendimentoLabel: string | null = null;
  if (oferta.empreendimento_id) {
    const imob = await carregarImobSimulacoesCard(supabase, id);
    if (imob.ok) {
      const empreendimentos = imob.itens.filter(
        (it) => (it.tipo ?? 'empreendimento') !== 'showroom',
      );
      const idx = empreendimentos.findIndex((it) => it.id === oferta.empreendimento_id);
      if (idx >= 0) {
        empreendimentoLabel = rotuloEmpreendimentoOrigem(empreendimentos[idx], idx + 1);
      }
    }
  }

  const dataGeracao = oferta.created_at
    ? new Date(oferta.created_at).toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : null;

  return (
    <main
      className="mx-auto max-w-5xl px-4 py-8 sm:px-6"
      style={{ background: 'var(--moni-surface-50)', minHeight: '100%' }}
    >
      <LinksVoltaOferta cardId={id} />
      <h1
        className="mt-4 text-3xl sm:text-4xl"
        style={{
          fontFamily: 'var(--moni-font-display)',
          color: 'var(--moni-text-primary)',
        }}
      >
        {oferta.nome || 'Oferta sem nome'}
      </h1>
      {loaded.loteadorNome ? (
        <p className="mt-2 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
          {loaded.loteadorNome}
        </p>
      ) : null}
      {dataGeracao ? (
        <p className="mt-1 text-sm" style={{ color: 'var(--moni-text-tertiary)' }}>
          Gerada em {dataGeracao}
        </p>
      ) : null}
      {empreendimentoLabel ? (
        <p className="mt-1 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
          Empreendimento: {empreendimentoLabel}
        </p>
      ) : null}

      <div className="mt-8">
        <OfertaDetalheCliente
          oferta={oferta}
          template={loaded.template}
          cardId={id}
        />
      </div>
    </main>
  );
}
