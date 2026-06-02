import { redirect } from 'next/navigation';

import { isAppFullyPublic } from '@/lib/public-rede-novos';

import { getDashboardData } from './actions';

import { DashboardSirene } from './DashboardSirene';



export default async function SirenePage({

  searchParams,

}: {

  searchParams: Promise<{ tipo?: string }>;

}) {

  const params = await searchParams;

  const filtroTipoParam = params.tipo === 'padrao' || params.tipo === 'hdm' ? params.tipo : 'todos';



  const result = await getDashboardData(filtroTipoParam);

  if (!result.ok) {

    if (!isAppFullyPublic()) redirect('/login');

    return (

      <main className="mx-auto max-w-7xl px-4 py-8">

        <p className="text-sm text-stone-600">

          {(result as { error?: string }).error ?? 'Não foi possível carregar o Sirene.'}

        </p>

      </main>

    );

  }



  return (

    <main className="mx-auto max-w-7xl px-4 py-8">

      <DashboardSirene

        emAberto={result.emAberto}

        emAndamento={result.emAndamento}

        concluidos={result.concluidos}

        tempoMedioPrimeiroAtendimento={result.tempoMedioPrimeiroAtendimento}

        slaAtrasados={result.slaAtrasados}

        slaVenceHoje={result.slaVenceHoje}

        aguardandoJulgamento={result.aguardandoJulgamento}

        porStatus={result.porStatus}

        por_tipo={result.por_tipo}

        por_prioridade_abertos={result.por_prioridade_abertos}

        chamadosBreakdown={result.chamadosBreakdown}

        atividadesBreakdown={result.atividadesBreakdown}

        satisfacaoPct={result.satisfacaoPct}

        satisfacao_total={result.satisfacao_total}

        satisfacao_aprovados={result.satisfacao_aprovados}

        chamadosComTrava={result.chamadosComTrava}

        recentesComTrava={result.recentesComTrava}

        chamadosAtrasados={result.chamadosAtrasados}

        aguardando_julgamento_lista={result.aguardando_julgamento_lista}

        topicos_por_status={result.topicos_por_status}

        minhasTarefas={result.minhasTarefas}

        por_responsavel={result.por_responsavel}

        por_criador={result.por_criador}

        abertos_por_time={result.abertos_por_time}

        abertos_por_funil={result.abertos_por_funil}

        top_franqueados={result.top_franqueados}

        top_temas={result.top_temas}

        filtroTipo={filtroTipoParam}

      />

    </main>

  );

}

