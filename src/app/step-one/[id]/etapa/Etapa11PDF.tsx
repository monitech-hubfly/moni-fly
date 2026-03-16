"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { saveEtapa11, registerPdfExport } from "./actions";

export type ResumoProcesso = {
  cidade: string;
  estado: string | null;
  narrativa: string;
  lote: {
    condominio: string | null;
    area_lote_m2: number | null;
    preco: number | null;
    preco_m2: number | null;
  } | null;
  ranking: { posicao: number; nome: string; media: number; justificativa?: string }[];
  bcaOpcoes: { titulo: string; descricao?: string }[];
};

export function Etapa11PDF({
  processoId,
  resumo,
  modeloEscolhidoNome,
}: {
  processoId: string;
  resumo: ResumoProcesso;
  modeloEscolhidoNome: string;
}) {
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleConcluir = async () => {
    await registerPdfExport(processoId, {
      hipotese: "Hipótese Step One",
      modelo_escolhido: modeloEscolhidoNome || null,
    });
    const res = await saveEtapa11(processoId, { concluida: true });
    if (res.ok) router.refresh();
  };

  return (
    <div className="mt-6 space-y-6">
      <p className="text-sm text-stone-600">
        Resumo consolidado do processo. Use &quot;Imprimir / Salvar como PDF&quot; para gerar o documento e depois marque a etapa como concluída.
      </p>

      <div ref={printRef} className="rounded-lg border border-stone-200 bg-white p-6 print:border-0 print:shadow-none">
        <h2 className="text-lg font-bold text-moni-dark mb-4">Resumo — PDF de hipóteses</h2>

        <section className="mb-4">
          <h3 className="font-medium text-stone-800">Praça</h3>
          <p className="text-sm text-stone-600">
            {resumo.cidade} {resumo.estado ? `— ${resumo.estado}` : ""}
          </p>
        </section>

        {resumo.narrativa && (
          <section className="mb-4">
            <h3 className="font-medium text-stone-800">Análise da praça (Etapa 1)</h3>
            <p className="text-sm text-stone-600 whitespace-pre-wrap">{resumo.narrativa}</p>
          </section>
        )}

        {resumo.lote && (
          <section className="mb-4">
            <h3 className="font-medium text-stone-800">Lote escolhido</h3>
            <p className="text-sm text-stone-600">
              Condomínio: {resumo.lote.condominio ?? "—"} | Área: {resumo.lote.area_lote_m2 ?? "—"} m² | Preço:{" "}
              {resumo.lote.preco != null ? resumo.lote.preco.toLocaleString("pt-BR") : "—"} | R$/m²:{" "}
              {resumo.lote.preco_m2 != null ? resumo.lote.preco_m2.toLocaleString("pt-BR") : "—"}
            </p>
          </section>
        )}

        {resumo.ranking.length > 0 && (
          <section className="mb-4">
            <h3 className="font-medium text-stone-800">Ranking do catálogo</h3>
            <ol className="list-decimal list-inside text-sm text-stone-600 space-y-1">
              {resumo.ranking.map((r) => (
                <li key={r.posicao}>
                  {r.posicao}º {r.nome} (média: {r.media.toFixed(2)})
                  {r.justificativa && ` — ${r.justificativa}`}
                </li>
              ))}
            </ol>
          </section>
        )}

        {resumo.bcaOpcoes.length > 0 && (
          <section className="mb-4">
            <h3 className="font-medium text-stone-800">Opções de BCA</h3>
            <ul className="text-sm text-stone-600 space-y-2">
              {resumo.bcaOpcoes.map((op, i) => (
                <li key={i}>
                  <strong>{op.titulo}</strong>
                  {op.descricao && ` — ${op.descricao}`}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="flex flex-wrap gap-3 print:hidden">
        <button type="button" onClick={handlePrint} className="btn-primary">
          Imprimir / Salvar como PDF
        </button>
        <button type="button" onClick={handleConcluir} className="btn-primary">
          Marcar etapa como concluída
        </button>
      </div>
    </div>
  );
}
