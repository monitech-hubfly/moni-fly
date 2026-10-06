import { redirect } from 'next/navigation';

/**
 * O Dashboard e os Gráficos da Sirene foram movidos para /dashboards-gerais?tab=painel-sirene.
 * Esta rota redireciona para a lista de chamados.
 */
export default function SirenePage() {
  redirect('/sirene/chamados');
}
