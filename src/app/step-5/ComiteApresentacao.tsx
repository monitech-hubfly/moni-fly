"use client";

import type { ComiteData } from "./actions";

export function ComiteApresentacao({ data }: { data: ComiteData }) {
  const handleBaixar = () => {
    window.print();
  };

  return (
    <div className="space-y-8">
      <div className="print:hidden flex justify-end">
        <button
          type="button"
          onClick={handleBaixar}
          className="rounded-lg bg-moni-accent px-4 py-2 text-sm font-medium text-white hover:bg-moni-accent/90"
        >
          Baixar apresentação (PDF)
        </button>
      </div>

      {/* 1. Prospecção da Cidade */}
      <section className="rounded-xl border border-stone-200 bg-white overflow-hidden print:break-inside-avoid">
        <div className="border-b border-stone-200 bg-stone-50 px-4 py-2">
          <h2 className="text-lg font-semibold text-stone-800">1. Prospecção da Cidade</h2>
        </div>
        <div className="min-h-[400px]">
          {data.pdfUrlProspeccao ? (
            <iframe
              src={data.pdfUrlProspeccao}
              title="Prospecção da Cidade"
              className="w-full h-[600px] print:hidden"
            />
          ) : (
            <div className="p-6 text-stone-500 text-sm">
              PDF da prospecção ainda não gerado. Gere na Etapa 1 do Step 1.
            </div>
          )}
        </div>
      </section>

      {/* 2. Score e Batalha de Casas */}
      <section className="rounded-xl border border-stone-200 bg-white overflow-hidden print:break-inside-avoid">
        <div className="border-b border-stone-200 bg-stone-50 px-4 py-2">
          <h2 className="text-lg font-semibold text-stone-800">2. Score e Batalha de Casas</h2>
        </div>
        <div className="min-h-[400px]">
          {data.pdfUrlScoreBatalha ? (
            <iframe
              src={data.pdfUrlScoreBatalha}
              title="Score e Batalha de Casas"
              className="w-full h-[600px] print:hidden"
            />
          ) : (
            <div className="p-6 text-stone-500 text-sm">
              PDF do Score e Batalha ainda não gerado. Gere na Etapa 6/7 do Step 1.
            </div>
          )}
        </div>
      </section>

      {/* 3. Resumo e Hipóteses */}
      <section className="rounded-xl border border-stone-200 bg-white overflow-hidden print:break-inside-avoid">
        <div className="border-b border-stone-200 bg-stone-50 px-4 py-2">
          <h2 className="text-lg font-semibold text-stone-800">3. Resumo e Hipóteses</h2>
        </div>
        <div className="p-6">
          {data.resumo ? (
            <>
              <div className="mb-4">
                <h3 className="font-medium text-stone-800">Praça</h3>
                <p className="text-sm text-stone-600">
                  {data.resumo.cidade} {data.resumo.estado ? `— ${data.resumo.estado}` : ""}
                </p>
              </div>
              {data.resumo.narrativa && (
                <div className="mb-4">
                  <h3 className="font-medium text-stone-800">Análise da praça (Etapa 1)</h3>
                  <p className="text-sm text-stone-600 whitespace-pre-wrap">{data.resumo.narrativa}</p>
                </div>
              )}
              {data.resumo.lote && (
                <div className="mb-4">
                  <h3 className="font-medium text-stone-800">Lote escolhido</h3>
                  <p className="text-sm text-stone-600">
                    Condomínio: {data.resumo.lote.condominio ?? "—"} | Área: {data.resumo.lote.area_lote_m2 ?? "—"} m² | Preço:{" "}
                    {data.resumo.lote.preco != null ? data.resumo.lote.preco.toLocaleString("pt-BR") : "—"} | R$/m²:{" "}
                    {data.resumo.lote.preco_m2 != null ? data.resumo.lote.preco_m2.toLocaleString("pt-BR") : "—"}
                  </p>
                </div>
              )}
              {data.resumo.ranking.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-medium text-stone-800">Ranking do catálogo</h3>
                  <ol className="list-decimal list-inside text-sm text-stone-600 space-y-1">
                    {data.resumo.ranking.map((r) => (
                      <li key={r.posicao}>
                        {r.posicao}º {r.nome} (média: {r.media.toFixed(2)})
                        {r.justificativa && ` — ${r.justificativa}`}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {data.resumo.bcaOpcoes.length > 0 && (
                <div>
                  <h3 className="font-medium text-stone-800">Opções de BCA</h3>
                  <ul className="text-sm text-stone-600 space-y-2">
                    {data.resumo.bcaOpcoes.map((op, i) => (
                      <li key={i}>
                        <strong>{op.titulo}</strong>
                        {op.descricao && ` — ${op.descricao}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="text-stone-500 text-sm">Dados do resumo ainda não disponíveis.</p>
          )}
        </div>
      </section>
    </div>
  );
}
