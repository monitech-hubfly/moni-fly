'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import {
  ordenarRedePorNFranquia,
  redeFranqueadoRowMatchesBusca,
  type RedeFranqueadoRowDb,
} from '@/lib/rede-franqueados';
import { TabelaRedeFranqueadosEditavel } from '@/components/TabelaRedeFranqueadosEditavel';

type Props = {
  rows: RedeFranqueadoRowDb[];
  canEditRows?: boolean;
  maskSensitiveColumns?: boolean;
  children?: ReactNode;
};

export function RedeFranqueadosTabelaComBusca({
  rows,
  canEditRows,
  maskSensitiveColumns,
  children,
}: Props) {
  const [busca, setBusca] = useState('');

  const rowsFiltradas = useMemo(() => {
    const q = busca.trim();
    const base = q ? rows.filter((r) => redeFranqueadoRowMatchesBusca(r, q)) : rows;
    return ordenarRedePorNFranquia(base);
  }, [rows, busca]);

  return (
    <div className="space-y-4">
      <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-0.5">
        <div className="relative min-w-[12rem] max-w-md shrink-0 sm:min-w-[200px] sm:flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
            aria-hidden
          />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar em qualquer coluna da planilha…"
            className="w-full rounded-lg border border-stone-200 bg-white py-2 pl-9 pr-3 text-sm text-stone-800 shadow-sm placeholder:text-stone-400 focus:border-[#0c2633] focus:outline-none focus:ring-1 focus:ring-[#0c2633]/30"
            aria-label="Pesquisar franqueados na tabela"
          />
        </div>
        {children ? (
          <div className="relative ml-auto flex shrink-0 flex-nowrap items-center justify-end gap-2">
            {children}
          </div>
        ) : null}
      </div>
      <TabelaRedeFranqueadosEditavel
        rows={rowsFiltradas}
        canEditRows={canEditRows}
        maskSensitiveColumns={maskSensitiveColumns}
        totalSemBusca={rows.length}
        buscaAtiva={busca.trim().length > 0}
      />
    </div>
  );
}
