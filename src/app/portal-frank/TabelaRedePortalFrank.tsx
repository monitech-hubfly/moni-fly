'use client';

import { useEffect, useMemo, useState } from 'react';
import type { RedeFranqueadoRowPortalFrank } from '@/lib/rede-franqueados';
import { RedeFranqueadoCellClamp } from '@/components/RedeFranqueadoCellClamp';
import {
  COLUNAS_REDE_FRANQUEADOS,
  REDE_FRANQUEADOS_DB_KEYS,
  type RedeFranqueadoDbKey,
} from '@/lib/rede-franqueados';
import { ocultarRegionalEAtuacaoNaVisaoFranqueado } from '@/lib/rede-visibilidade-franqueado';

type Props = { rows: RedeFranqueadoRowPortalFrank[] };

/** Mesmo tamanho de página que `TabelaRedeFranqueadosEditavel` / `TabelaRedeFranqueados`. */
const PER_PAGE = 15;

/** Colunas visíveis ao franqueado, na mesma ordem lógica da tabela principal (`REDE_FRANQUEADOS_DB_KEYS`). */
const FRANK_KEYS = [
  'n_franquia',
  'modalidade',
  'nome_completo',
  'status_franquia',
  'regional',
  'area_atuacao',
  'email_frank',
  'telefone_frank',
] as const satisfies readonly (keyof RedeFranqueadoRowPortalFrank)[];

function labelForKey(k: string): string {
  const idx = REDE_FRANQUEADOS_DB_KEYS.indexOf(k as RedeFranqueadoDbKey);
  return idx >= 0 ? COLUNAS_REDE_FRANQUEADOS[idx] : k;
}

function textoCelulaPortalFrank(r: RedeFranqueadoRowPortalFrank, k: (typeof FRANK_KEYS)[number]): string {
  if (
    (k === 'regional' || k === 'area_atuacao') &&
    ocultarRegionalEAtuacaoNaVisaoFranqueado(r.n_franquia)
  ) {
    return '';
  }
  return String(r[k] ?? '');
}

export function TabelaRedePortalFrank({ rows }: Props) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * PER_PAGE;
  const pageRows = useMemo(() => rows.slice(start, start + PER_PAGE), [rows, start]);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-6 text-center text-sm text-stone-600">
        <p className="font-medium">Nenhum franqueado cadastrado na rede.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full min-w-[960px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50">
              {FRANK_KEYS.map((k) => (
                <th key={k} className="whitespace-nowrap px-3 py-2 font-semibold text-stone-700">
                  {labelForKey(k)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => (
              <tr key={r.id} className="border-b border-stone-100 align-top hover:bg-stone-50/80">
                {FRANK_KEYS.map((k) => (
                  <td key={k} className="min-w-0 max-w-[14rem] overflow-hidden px-3 py-2 align-top text-stone-700">
                    <RedeFranqueadoCellClamp text={textoCelulaPortalFrank(r, k)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="border-t border-stone-200 pt-3 text-sm text-stone-600">
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
                    ? 'border-moni-primary bg-moni-primary text-white'
                    : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
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
