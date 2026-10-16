import dynamic from 'next/dynamic';
import { getDashboardData } from '@/app/sirene/actions';
import { buscarDadosGraficos } from '@/app/sirene/graficos/actions';

const DashboardSirene = dynamic(() =>
  import('@/app/sirene/DashboardSirene').then((m) => ({ default: m.DashboardSirene })),
);

const GraficosConteudo = dynamic(() =>
  import('@/app/sirene/graficos/GraficosConteudo').then((m) => ({ default: m.GraficosConteudo })),
);

export async function DashboardsGeraisSirene() {
  const [sireneResult, graficosResult] = await Promise.all([
    getDashboardData('todos'),
    buscarDadosGraficos(undefined),
  ]);

  const graficosInitialMes = graficosResult?.ok
    ? (graficosResult.data.melhorMesInicial ??
      graficosResult.data.mesesDisponiveis.at(-1) ??
      new Date().toISOString().slice(0, 7))
    : new Date().toISOString().slice(0, 7);

  return (
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
        <p className="text-sm" style={{ color: 'var(--moni-status-overdue-text)' }}>
          Erro ao carregar o painel Sirene.
        </p>
      )}

      {graficosResult?.ok && (
        <div>
          <div className="mb-6 border-t pt-8" style={{ borderColor: 'var(--moni-border-default)' }}>
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
          <GraficosConteudo initialData={graficosResult.data} initialMes={graficosInitialMes} />
        </div>
      )}
    </div>
  );
}
