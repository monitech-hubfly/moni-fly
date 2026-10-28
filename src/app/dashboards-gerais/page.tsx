import nextDynamic from 'next/dynamic';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { isRedeStaffRole } from '@/lib/authz';
import { DashboardsGeraisTabBar, type DashboardsGeraisTabId } from './DashboardsGeraisTabBar';
import { DashboardsGeraisVisaoGeral } from './DashboardsGeraisVisaoGeral';
import { DashboardsGeraisSirene } from './DashboardsGeraisSirene';

const DashboardsGeraisPipelineTab = nextDynamic(() =>
  import('./DashboardsGeraisPipelineTab').then((m) => ({ default: m.DashboardsGeraisPipelineTab })),
);

const PainelGeraisFunis = nextDynamic(() =>
  import('./PainelGeraisFunis').then((m) => ({ default: m.PainelGeraisFunis })),
);

function AbaCarregando({ texto }: { texto: string }) {
  return (
    <p className="text-sm" style={{ color: 'var(--moni-text-tertiary)' }}>
      {texto}
    </p>
  );
}

export const dynamic = 'force-dynamic';

const VALID_TABS: DashboardsGeraisTabId[] = [
  'visao-geral',
  'pipeline-franqueados',
  'pipeline-loteadores',
  'painel-funis',
  'kpis',
  'painel-sirene',
];

function EmConstrucao({ titulo }: { titulo: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-xl text-2xl"
        style={{ background: 'var(--moni-surface-100)' }}
      >
        ⚙
      </div>
      <div>
        <h2
          className="text-xl font-semibold"
          style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-display)' }}
        >
          {titulo}
        </h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
          Em construção
        </p>
        <p className="mt-1 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
          Esta seção está sendo desenvolvida e estará disponível em breve.
        </p>
      </div>
    </div>
  );
}

export default async function DashboardsGeraisPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = (profile?.role as string) ?? 'frank';

  if (!isRedeStaffRole(role)) redirect('/');

  const params = await searchParams;
  const rawTab = params.tab ?? 'visao-geral';
  const activeTab: DashboardsGeraisTabId = VALID_TABS.includes(rawTab as DashboardsGeraisTabId)
    ? (rawTab as DashboardsGeraisTabId)
    : 'visao-geral';

  return (
    <div className="min-h-0 bg-[var(--moni-surface-50)]">
      <main className="mx-auto w-full min-w-0 max-w-[1600px] px-6 py-8">
        {/* Cabeçalho */}
        <header
          className="flex flex-col gap-4 pb-0"
        >
          <h1
            className="text-3xl font-semibold tracking-tight"
            style={{ color: 'var(--color-text-primary, #0c2633)' }}
          >
            Dashboards Gerais Moní
          </h1>
        </header>

        {/* Barra de abas */}
        <Suspense fallback={null}>
          <DashboardsGeraisTabBar activeTab={activeTab} />
        </Suspense>

        {/* Conteúdo da aba */}
        <div className="mt-8">
          {/* ── Visão Geral ── */}
          {activeTab === 'visao-geral' && (
            <Suspense fallback={<AbaCarregando texto="Carregando visão geral…" />}>
              <DashboardsGeraisVisaoGeral />
            </Suspense>
          )}

          {/* ── Pipeline da Rede de Franqueados ── */}
          {activeTab === 'pipeline-franqueados' && (
            <Suspense fallback={<AbaCarregando texto="Carregando pipeline…" />}>
              <DashboardsGeraisPipelineTab />
            </Suspense>
          )}

          {/* ── Em construção ── */}
          {activeTab === 'pipeline-loteadores' && (
            <EmConstrucao titulo="Pipeline da Rede de Loteadores" />
          )}
          {activeTab === 'painel-funis' && (
            <PainelGeraisFunis />
          )}
          {activeTab === 'kpis' && (
            <EmConstrucao titulo="KPI's" />
          )}

          {/* ── Painel Geral Sirene ── */}
          {activeTab === 'painel-sirene' && (
            <Suspense fallback={<AbaCarregando texto="Carregando painel Sirene…" />}>
              <DashboardsGeraisSirene />
            </Suspense>
          )}
        </div>
      </main>
    </div>
  );
}
