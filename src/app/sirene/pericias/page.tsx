import { redirect } from 'next/navigation';
import { listChamadosParaVincularPericia, listPericiasComChamados } from '../actions';
import { PericiasConteudo } from './PericiasConteudo';

export default async function SirenePericiasPage() {
  const [r1, r2] = await Promise.all([
    listChamadosParaVincularPericia(),
    listPericiasComChamados(),
  ]);
  const canetaOuBombeiro = r1.ok;
  const chamadosPendentes = r1.ok ? r1.chamados : [];
  const periciasPlanejamento = r2.ok ? r2.pericias : [];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold text-white">Perícias (Caneta Verde)</h1>
      <p className="mt-1 text-stone-400">
        Vincule chamados (com tema e mapeamento preenchidos) ao planejamento de perícias. Filtre e
        analise chamados por nome de perícia.
      </p>
      {!canetaOuBombeiro ? (
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
          Apenas Bombeiro ou Caneta Verde podem acessar esta aba.
        </div>
      ) : (
        <PericiasConteudo
          chamadosPendentesInicial={chamadosPendentes}
          periciasPlanejamentoInicial={periciasPlanejamento}
        />
      )}
    </main>
  );
}
