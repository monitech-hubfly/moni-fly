import { buscarDadosGraficos } from './actions';
import { GraficosConteudo } from './GraficosConteudo';

export const dynamic = 'force-dynamic';

export default async function SireneGraficosPage({
  searchParams,
}: {
  searchParams?: { mes?: string };
}) {
  const mes = searchParams?.mes;
  const result = await buscarDadosGraficos(mes);

  if (!result.ok) {
    return (
      <main className="mx-auto w-full max-w-[1200px] px-6 py-8">
        <p className="text-red-700">Erro ao carregar gráficos: {result.error}</p>
      </main>
    );
  }

  const mesInicial = mes ?? result.data.mesesDisponiveis.at(-1) ?? new Date().toISOString().slice(0, 7);

  return (
    <GraficosConteudo
      initialData={result.data}
      initialMes={mesInicial}
    />
  );
}
