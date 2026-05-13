import { redirect } from 'next/navigation';
import { listChamados } from '../actions';
import { KanbanBoard } from '../KanbanBoard';

export default async function SireneKanbanPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const params = await searchParams;
  const filtroTipo = params.tipo === 'padrao' || params.tipo === 'hdm' ? params.tipo : undefined;
  const listResult = await listChamados(filtroTipo);
  const chamados = listResult.ok ? listResult.chamados : [];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold text-white">Organização (Kanban)</h1>
      <p className="mt-1 text-stone-400">
        Visão em colunas por status. Filtre por tipo e clique no card para abrir o chamado.
      </p>
      <div className="mt-6">
        <KanbanBoard chamados={chamados} />
      </div>
    </main>
  );
}
