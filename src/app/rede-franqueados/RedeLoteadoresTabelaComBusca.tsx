'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { TabelaRedeLoteadoresEditavel } from '@/components/TabelaRedeLoteadoresEditavel';
import { RedeTabelaToolbarBusca } from '@/app/rede-franqueados/RedeTabelaToolbarBusca';
import { ordenarRedeLoteadoresPorNome, redeLoteadorRowMatchesBusca, type RedeLoteadorRow } from '@/lib/rede-loteadores';

type Props = {
  rows: RedeLoteadorRow[];
  children?: ReactNode;
  solicitarCriacao?: number;
};

export function RedeLoteadoresTabelaComBusca({ rows, children, solicitarCriacao = 0 }: Props) {
  const [busca, setBusca] = useState('');

  const rowsFiltradas = useMemo(() => {
    const q = busca.trim();
    const base = q ? rows.filter((r) => redeLoteadorRowMatchesBusca(r, q)) : rows;
    return ordenarRedeLoteadoresPorNome(base);
  }, [rows, busca]);

  return (
    <div className="space-y-4">
      <RedeTabelaToolbarBusca
        value={busca}
        onChange={setBusca}
        placeholder="Pesquisar loteadores…"
        ariaLabel="Pesquisar loteadores"
      >
        {children}
      </RedeTabelaToolbarBusca>
      <TabelaRedeLoteadoresEditavel
        rows={rowsFiltradas}
        totalSemBusca={rows.length}
        buscaAtiva={busca.trim().length > 0}
        buscaResetKey={busca}
        solicitarCriacao={solicitarCriacao}
      />
    </div>
  );
}
