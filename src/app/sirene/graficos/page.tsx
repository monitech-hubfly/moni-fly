import { buscarDadosGraficos } from './actions';
import { GraficosConteudo } from './GraficosConteudo';

export const dynamic = 'force-dynamic';

export default async function SireneGraficosPage() {
  const result = await buscarDadosGraficos();

  if (!result.ok) {
    return (
      <main className="mx-auto w-full max-w-[1200px] px-6 py-8">
        <p className="text-red-700">Erro ao carregar gráficos: {result.error}</p>
      </main>
    );
  }

  return <GraficosConteudo data={result.data} />;
}
