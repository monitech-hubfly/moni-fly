"use client";

import { useState, useMemo } from "react";
import type { RedeFranqueadosData } from "@/lib/rede-franqueados";

const PER_PAGE = 15;

type Props = {
  data: RedeFranqueadosData;
  compact?: boolean;
};

export function TabelaRedeFranqueados({ data, compact }: Props) {
  const [page, setPage] = useState(1);

  if (!data || data.rows.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-6 text-center text-stone-600 text-sm">
        <p className="font-medium">Nenhum franqueado cadastrado na rede.</p>
        <p className="mt-1">Os dados são gerenciados pela ferramenta (tabela no banco de dados).</p>
      </div>
    );
  }

  const { headers, rows } = data;
  const totalPages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * PER_PAGE;
  const rowsToShow = useMemo(() => rows.slice(start, start + PER_PAGE), [rows, start]);

  const allEmpty = useMemo(
    () => rowsToShow.every((row) => row.every((cell) => !String(cell).trim())),
    [rowsToShow]
  );

  return (
    <div className="space-y-4">
      {allEmpty && rows.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 text-sm">
          <p className="font-medium">Os registros existem, mas estão vazios.</p>
          <p className="mt-1">
            Isso costuma acontecer depois de alterar as colunas da tabela. Apague as linhas atuais no Supabase (Table Editor ou SQL) e <strong>reimporte o CSV</strong> com os cabeçalhos: N de Franquia, Nome Completo do Franqueado, Status da Franquia, E-mail do Frank, Telefone do Frank, Cidade Casa Frank, Estado Casa Frank, etc. Use o comando: <code className="bg-amber-100 px-1 rounded">npm run rede-franqueados:import -- seu-arquivo.csv</code>
          </p>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full min-w-[1400px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50">
              {headers.map((h, i) => (
                <th key={i} className="px-3 py-2 font-semibold text-stone-700 whitespace-nowrap">
                  {h || `Col ${i + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowsToShow.map((row, ri) => (
              <tr key={start + ri} className="border-b border-stone-100 hover:bg-stone-50/80">
                {headers.map((_, ci) => (
                  <td key={ci} className={`text-stone-700 ${compact ? "px-2 py-1" : "px-3 py-2"}`}>
                    {row[ci] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-stone-600 border-t border-stone-200 pt-3">
        Mostrando {start + 1}–{Math.min(start + PER_PAGE, rows.length)} de {rows.length} franqueados
      </p>

      {totalPages > 1 && (
        <nav className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-stone-500" aria-hidden="true" />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:pointer-events-none disabled:opacity-50"
            >
              Anterior
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`min-w-[2.25rem] rounded-lg border px-2 py-1.5 text-sm font-medium ${
                  p === safePage
                    ? "border-moni-primary bg-moni-primary text-white"
                    : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
                }`}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:pointer-events-none disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
