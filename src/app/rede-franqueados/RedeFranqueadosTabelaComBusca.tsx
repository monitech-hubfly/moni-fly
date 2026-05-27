'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { redeFranqueadoRowMatchesBusca, type RedeFranqueadoRowDb } from '@/lib/rede-franqueados';
import { TabelaRedeFranqueadosEditavel } from '@/components/TabelaRedeFranqueadosEditavel';

type Props = {
  rows: RedeFranqueadoRowDb[];
  canEditRows?: boolean;
  children?: ReactNode;
};

export function RedeFranqueadosTabelaComBusca({ rows, canEditRows, children }: Props) {
  const [busca, setBusca] = useState('');

  const rowsFiltradas = useMemo(() => {
    const q = busca.trim();
    if (!q) return rows;
    return rows.filter((r) => redeFranqueadoRowMatchesBusca(r, q));
  }, [rows, busca]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[200px] flex-1 max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
            aria-hidden
          />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar em qualquer coluna da planilha…"
            className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-9 pr-3 text-sm text-stone-800 placeholder:text-stone-400 focus:border-moni-primary focus:outline-none focus:ring-1 focus:ring-moni-primary"
            aria-label="Pesquisar franqueados na tabela"
          />
        </div>
        {children ? <div className="flex flex-wrap items-center justify-end gap-3">{children}</div> : null}
      </div>
      <TabelaRedeFranqueadosEditavel
        rows={rowsFiltradas}
        canEditRows={canEditRows}
        totalSemBusca={rows.length}
        buscaAtiva={busca.trim().length > 0}
      />
    </div>
  );
}
