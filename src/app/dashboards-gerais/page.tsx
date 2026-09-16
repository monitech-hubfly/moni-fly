import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { isRedeStaffRole } from '@/lib/authz';
import { fetchRedeFranqueadosRows } from '@/lib/rede-franqueados';
import { getDashboardData } from '@/app/sirene/actions';
import { buscarDadosGraficos } from '@/app/sirene/graficos/actions';
import { RedeDashboard } from '@/app/rede-franqueados/RedeDashboard';
import { DashboardSirene } from '@/app/sirene/DashboardSirene';
import { GraficosConteudo } from '@/app/sirene/graficos/GraficosConteudo';
import { DashboardsGeraisTabBar, type DashboardsGeraisTabId } from './DashboardsGeraisTabBar';
import { DashboardsGeraisPipelineTab } from './DashboardsGeraisPipelineTab';

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

  // ─── Busca dados conforme a aba ativa ────────────────────────────────────────

  let redeRows = null;
  let sireneResult = null;
  let graficosResult = null;

  if (activeTab === 'visao-geral') {
    redeRows = await fetchRedeFranqueadosRows(supabase);
  } else if (activeTab === 'painel-sirene') {
    [sireneResult, graficosResult] = await Promise.all([
      getDashboardData('todos'),
      buscarDadosGraficos(undefined),
    ]);
  }

  // ─── Mes inicial para gráficos ───────────────────────────────────────────────

  const graficosInitialMes =
    graficosResult?.ok
      ? (graficosResult.data.melhorMesInicial ??
        graficosResult.data.mesesDisponiveis.at(-1) ??
        new Date().toISOString().slice(0, 7))
      : new Date().toISOString().slice(0, 7);

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
            redeRows ? (
              <RedeDashboard rows={redeRows} />
            ) : (
              <p className="text-sm text-red-600">Erro ao carregar a visão geral.</p>
            )
          )}

          {/* ── Pipeline da Rede de Franqueados ── */}
          {activeTab === 'pipeline-franqueados' && (
            <Suspense fallback={<p className="text-sm text-stone-500">Carregando pipeline…</p>}>
              <DashboardsGeraisPipelineTab />
            </Suspense>
          )}

          {/* ── Em construção ── */}
          {activeTab === 'pipeline-loteadores' && (
            <EmConstrucao titulo="Pipeline da Rede de Loteadores" />
          )}
          {activeTab === 'painel-funis' && (
            <EmConstrucao titulo="Painel Geral Funis" />
          )}
          {activeTab === 'kpis' && (
            <EmConstrucao titulo="KPI's" />
          )}

          {/* ── Painel Geral Sirene ── */}
          {activeTab === 'painel-sirene' && (
            <div className="space-y-10">
              {sireneResult?.ok ? (
                <DashboardSirene
                  emAberto={sireneResult.emAberto}
                  emAndamento={sireneResult.emAndamento}
                  concluidos={sireneResult.concluidos}
                  tempoMedioPrimeiroAtendimento={sireneResult.tempoMedioPrimeiroAtendimento}
                  slaAtrasados={sireneResult.slaAtrasados}
                  slaVenceHoje={sireneResult.slaVenceHoje}
                  aguardandoJulgamento={sireneResult.aguardandoJulgamento}
                  porStatus={sireneResult.porStatus}
                  por_tipo={sireneResult.por_tipo}
                  por_prioridade_abertos={sireneResult.por_prioridade_abertos}
                  chamadosBreakdown={sireneResult.chamadosBreakdown}
                  atividadesBreakdown={sireneResult.atividadesBreakdown}
                  satisfacaoPct={sireneResult.satisfacaoPct}
                  satisfacao_total={sireneResult.satisfacao_total}
                  satisfacao_aprovados={sireneResult.satisfacao_aprovados}
                  chamadosComTrava={sireneResult.chamadosComTrava}
                  recentesComTrava={sireneResult.recentesComTrava}
                  chamadosAtrasados={sireneResult.chamadosAtrasados}
                  aguardando_julgamento_lista={sireneResult.aguardando_julgamento_lista}
                  topicos_por_status={sireneResult.topicos_por_status}
                  por_responsavel={sireneResult.por_responsavel}
                  por_criador={sireneResult.por_criador}
                  abertos_por_time={sireneResult.abertos_por_time}
                  abertos_por_funil={sireneResult.abertos_por_funil}
                  top_franqueados={sireneResult.top_franqueados}
                  top_temas={sireneResult.top_temas}
                  chamados_destaque={sireneResult.chamados_destaque}
                  filtroTipo="todos"
                />
              ) : (
                <p className="text-sm text-red-600">
                  Erro ao carregar o painel Sirene.
                </p>
              )}

              {graficosResult?.ok && (
                <div>
                  <div
                    className="mb-6 border-t pt-8"
                    style={{ borderColor: 'var(--moni-border-default)' }}
                  >
                    <h2
                      className="text-xl font-semibold"
                      style={{
                        color: 'var(--moni-navy-800)',
                        fontFamily: 'var(--moni-font-display)',
                      }}
                    >
                      Gráficos
                    </h2>
                    <p className="mt-1 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
                      Análise histórica de chamados.
                    </p>
                  </div>
                  <GraficosConteudo
                    initialData={graficosResult.data}
                    initialMes={graficosInitialMes}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
