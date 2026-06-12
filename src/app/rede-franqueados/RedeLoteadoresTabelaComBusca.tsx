'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { TabelaRedeLoteadoresEditavel } from '@/components/TabelaRedeLoteadoresEditavel';
import { ordenarRedeLoteadoresPorNome, redeLoteadorRowMatchesBusca, type RedeLoteadorRow } from '@/lib/rede-loteadores';

type Props = {
  rows: RedeLoteadorRow[];
};

export function RedeLoteadoresTabelaComBusca({ rows }: Props) {
  const [busca, setBusca] = useState('');

  const rowsFiltradas = useMemo(() => {
    const q = busca.trim();
    const base = q ? rows.filter((r) => redeLoteadorRowMatchesBusca(r, q)) : rows;
    return ordenarRedeLoteadoresPorNome(base);
  }, [rows, busca]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
          aria-hidden
        />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Pesquisar loteadores…"
          className="w-full rounded-lg border border-stone-200 bg-white py-2 pl-9 pr-3 text-sm text-stone-800 shadow-sm placeholder:text-stone-400 focus:border-[#0c2633] focus:outline-none focus:ring-1 focus:ring-[#0c2633]/30"
          aria-label="Pesquisar loteadores"
        />
      </div>
      <TabelaRedeLoteadoresEditavel
        rows={rowsFiltradas}
        totalSemBusca={rows.length}
        buscaAtiva={busca.trim().length > 0}
        buscaResetKey={busca}
      />
    </div>
  );
}
