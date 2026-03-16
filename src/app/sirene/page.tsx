import { redirect } from 'next/navigation';
import { getDashboardData } from './actions';
import { DashboardSirene } from './DashboardSirene';

export default async function SirenePage() {
  const result = await getDashboardData();
  if (!result.ok) redirect('/login');

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <DashboardSirene
        emAberto={result.emAberto}
        emAndamento={result.emAndamento}
        concluidos={result.concluidos}
        tempoMedioPrimeiroAtendimento={result.tempoMedioPrimeiroAtendimento}
        porStatus={result.porStatus}
        satisfacaoPct={result.satisfacaoPct}
        chamadosComTrava={result.chamadosComTrava}
        recentesComTrava={result.recentesComTrava}
        minhasTarefas={result.minhasTarefas}
      />
    </main>
  );
}
