import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { guardLoginRequired } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';
import { isRedeStaffRole } from '@/lib/authz';
import { persistSeededStaffRoleIfNeeded } from '@/lib/seeded-staff-role';
import { carregarSimuladorOfertaDoCard } from '@/lib/actions/loteamento-simulador-template';
import { formatarMoedaBr } from '@/lib/loteamento-simulador-template';
import { OfertaDetalheLeitura } from '@/components/simulador/OfertaDetalheLeitura';
import { BotaoImprimirOferta } from '@/components/simulador/BotaoImprimirOferta';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = { params: Promise<{ id: string; ofertaId: string }> };

export default async function SimuladorOfertaDetalhePage({ params }: Props) {
  const { id, ofertaId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(ofertaId)) notFound();

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

  const loaded = await carregarSimuladorOfertaDoCard(id, ofertaId);
  if (!loaded.ok) {
    if (/não encontrad/i.test(loaded.error)) notFound();
    return (
      <main
        className="mx-auto max-w-6xl px-4 py-8 sm:px-6"
        style={{ background: 'var(--moni-surface-50)', minHeight: '100%' }}
      >
        <Link
          href={`/loteadores/${id}/simulador-template/ofertas`}
          className="text-sm"
          style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-sans)' }}
        >
          ← Voltar às ofertas
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

  const o = loaded.oferta;
  const nomeOferta = o.nome?.trim() || 'Oferta';
  const nomeLoteador = loaded.loteadorNome?.trim() || loaded.template?.nome?.trim() || '—';
  const dataGeracao = new Date().toLocaleDateString('pt-BR');
  const linhas: Array<{ label: string; valor: string }> = [
    { label: 'Valor do lote', valor: formatarMoedaBr(o.valor_lote) },
    { label: 'Valor da casa', valor: formatarMoedaBr(o.valor_casa) },
    { label: 'Customização', valor: formatarMoedaBr(o.valor_customizacao) },
    { label: 'Valor já pago à loteadora', valor: formatarMoedaBr(o.valor_ja_pago) },
    { label: 'Parcela mensal', valor: formatarMoedaBr(o.parcela_mensal) },
    { label: 'Prazo', valor: o.prazo_meses != null ? `${o.prazo_meses} meses` : '—' },
    { label: 'Renda', valor: formatarMoedaBr(o.renda_cliente ?? o.renda_informada_cliente) },
  ];

  return (
    <main
      className="mx-auto max-w-6xl px-4 py-8 sm:px-6"
      style={{ background: 'var(--moni-surface-50)', minHeight: '100%' }}
    >
      <Link
        href={`/loteadores/${id}/simulador-template/ofertas`}
        className="print-screen-only text-sm"
        style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-sans)' }}
      >
        ← Voltar às ofertas
      </Link>
      <div className="print-header">
        <p
          className="text-xl"
          style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
        >
          {nomeOferta}
        </p>
        <p className="mt-1 text-sm" style={{ fontFamily: 'var(--moni-font-sans)' }}>
          {nomeLoteador}
        </p>
        <p className="mt-1 text-xs" style={{ fontFamily: 'var(--moni-font-sans)' }}>
          Data de geração: {dataGeracao}
        </p>
        <p className="mt-1 text-xs" style={{ fontFamily: 'var(--moni-font-sans)' }}>
          Documento gerado pelo Simulador de Pagamentos Moní
        </p>
      </div>
      <h1
        className="print-screen-only mt-4 text-3xl sm:text-4xl"
        style={{
          fontFamily: 'var(--moni-font-display)',
          color: 'var(--moni-text-primary)',
        }}
      >
        {nomeOferta}
      </h1>
      <div
        className="print-no-break mt-8 rounded-[var(--moni-radius-lg)] p-4 sm:p-5"
        style={{
          border: 'var(--moni-border-width) solid var(--moni-border-default)',
          background: 'var(--moni-surface-0)',
          boxShadow: 'var(--moni-shadow-card)',
        }}
      >
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {linhas.map((l) => (
            <div key={l.label}>
              <dt
                className="text-[11px]"
                style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}
              >
                {l.label}
              </dt>
              <dd
                className="text-sm"
                style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}
              >
                {l.valor}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <OfertaDetalheLeitura oferta={o} template={loaded.template} />
      <BotaoImprimirOferta />
    </main>
  );
}
