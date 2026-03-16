"use client";

import Link from "next/link";

export type ProcessoCard = {
  id: string;
  cidade: string;
  estado: string | null;
  status: string;
  etapa_atual: number;
  updated_at: string | null;
  franqueado_nome?: string | null;
  step_atual: number;
};

export function StepsKanbanColumn({
  title,
  processos,
  stepNum,
}: {
  title: string;
  processos: ProcessoCard[];
  stepNum: number;
}) {
  const hrefBase = stepNum === 1 ? "/step-one" : "/step-2";

  return (
    <div className="w-72 shrink-0 rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      <div className="bg-stone-100 px-4 py-3 border-b border-stone-200">
        <h2 className="font-semibold text-stone-800">{title}</h2>
        <p className="text-xs text-stone-500 mt-0.5">{processos.length} processo(s)</p>
      </div>
      <div className="p-2 space-y-2 max-h-[70vh] overflow-y-auto">
        {processos.map((p) => (
          <Link
            key={p.id}
            href={stepNum === 1 ? `/step-one/${p.id}` : `/step-2/${p.id}`}
            className="block rounded-lg border border-stone-200 bg-white p-3 shadow-sm hover:border-moni-accent/40 transition"
          >
            <p className="font-medium text-stone-800 text-sm">
              {p.cidade ?? "Sem cidade"}
              {p.estado ? `, ${p.estado}` : ""}
            </p>
            {p.franqueado_nome && (
              <p className="mt-0.5 text-xs text-stone-500">{p.franqueado_nome}</p>
            )}
            <p className="mt-1 text-xs text-stone-400">
              {p.status === "concluido" ? "Concluído" : p.status === "em_andamento" ? "Em andamento" : "Rascunho"}
              {p.updated_at ? ` · ${new Date(p.updated_at).toLocaleDateString("pt-BR")}` : ""}
            </p>
          </Link>
        ))}
        {processos.length === 0 && (
          <div className="rounded-lg border border-dashed border-stone-200 p-4 text-center text-sm text-stone-400">
            Nenhum processo
          </div>
        )}
      </div>
    </div>
  );
}
