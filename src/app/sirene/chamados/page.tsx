import { redirect } from "next/navigation";
import { listChamados } from "../actions";
import { ChamadosLista } from "../ChamadosLista";

type SearchParams = { tipo?: string };

export default async function SireneChamadosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const filtroTipo =
    params.tipo === "padrao" || params.tipo === "hdm" ? params.tipo : undefined;
  const listResult = await listChamados(filtroTipo);
  const chamados = listResult.ok ? listResult.chamados : [];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold text-white">Chamados</h1>
      <p className="mt-1 text-stone-400">
        Lista de chamados. Filtre por tipo (Todos / Padrão / HDM) e abra um novo chamado.
      </p>
      <section className="mt-6">
        <ChamadosLista chamados={chamados} />
      </section>
    </main>
  );
}
