'use client';

import React from 'react';

export type CasaRowPDF = {
  id: string;
  foto_url: string | null;
  preco: number | null;
};

export type ScoreBatalhaRow = {
  casa: CasaRowPDF;
  precoLabel: string;
  notaPreco: number;
  notaProduto: number;
  notaLocalizacao: number;
  notaFinal: number;
  resultado: 'G' | 'E' | 'P';
};

/** Layout do relatório SCORE & BATALHA para impressão/PDF (igual ao template em anexo).
 * omitImages=true evita imagens externas na captura (CORS) e usa placeholder para o PDF não sair em branco. */
export function ScoreBatalhaPDFContent({
  rows,
  omitImages = false,
}: {
  rows: ScoreBatalhaRow[];
  omitImages?: boolean;
}) {
  return (
    <div
      className="bg-white text-stone-800"
      style={{ width: '210mm', minHeight: '297mm', padding: '16px', boxSizing: 'border-box' }}
    >
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-4 border-b border-stone-300 pb-3">
        <div>
          <h1 className="text-2xl font-bold leading-tight text-stone-800">
            SCORE &<br />
            <span className="ml-6">BATALHA</span>
          </h1>
        </div>
        <div className="shrink-0 text-right">
          <p className="mb-1 text-xs font-bold uppercase text-stone-700">Tabela de referência</p>
          <ul className="space-y-0.5 text-xs text-stone-600">
            <li>-2: estamos muito piores</li>
            <li>-1: estamos piores</li>
            <li>0: estamos iguais</li>
            <li>+1: estamos melhores</li>
            <li>+2: estamos muito melhores</li>
            <li className="mt-1 border-t border-stone-200 pt-1">
              G: Ganhador / E: Empate / P: Perdedor
            </li>
          </ul>
        </div>
      </div>

      {/* Tabela principal */}
      <table className="w-full border-collapse text-sm" style={{ tableLayout: 'fixed' }}>
        <thead>
          <tr className="border-b-2 border-stone-300">
            <th className="w-[28%] p-2 text-left font-semibold text-stone-700">Competidor</th>
            <th className="w-[14%] p-2 text-center font-semibold text-stone-700">Preço</th>
            <th className="w-[14%] p-2 text-center font-semibold text-stone-700">Produto</th>
            <th className="w-[18%] p-2 text-center font-semibold text-stone-700">
              Atributos do Lote
            </th>
            <th className="w-[26%] border-l-2 border-r-2 border-amber-200 bg-amber-50/80 p-2 text-center font-semibold text-stone-700">
              Resultado batalha
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.casa.id} className="border-b border-stone-200">
              <td className="p-2 align-top">
                <div className="relative inline-block aspect-[4/3] w-full max-w-[180px] overflow-hidden rounded bg-stone-100">
                  {!omitImages && row.casa.foto_url ? (
                    <img
                      src={row.casa.foto_url}
                      alt=""
                      className="h-full w-full object-cover"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-stone-400">
                      {omitImages ? 'Foto' : 'Sem foto'}
                    </div>
                  )}
                  <span className="absolute bottom-1 left-1 rounded bg-amber-400 px-2 py-0.5 text-xs font-bold text-white">
                    {row.precoLabel}
                  </span>
                </div>
              </td>
              <td className="p-2 text-center align-middle">{row.notaPreco}</td>
              <td className="p-2 text-center align-middle">{row.notaProduto}</td>
              <td className="p-2 text-center align-middle">{row.notaLocalizacao}</td>
              <td className="border-l-2 border-r-2 border-amber-200 bg-amber-50/50 p-2 text-center align-middle">
                <span className="font-bold text-stone-900">{row.notaFinal}</span>
                <br />
                <span
                  className={`text-sm font-semibold ${
                    row.resultado === 'G'
                      ? 'text-green-600'
                      : row.resultado === 'P'
                        ? 'text-red-600'
                        : 'text-amber-700'
                  }`}
                >
                  {row.resultado}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
