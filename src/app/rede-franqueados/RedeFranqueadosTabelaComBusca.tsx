'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  ordenarRedePorNFranquia,
  redeFranqueadoRowMatchesBusca,
  type RedeFranqueadoRowDb,
} from '@/lib/rede-franqueados';
import { TabelaRedeFranqueadosEditavel } from '@/components/TabelaRedeFranqueadosEditavel';
import { RedeTabelaToolbarBusca } from '@/app/rede-franqueados/RedeTabelaToolbarBusca';

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
      <RedeTabelaToolbarBusca
        value={busca}
        onChange={setBusca}
        placeholder="Pesquisar em qualquer coluna da planilha…"
        ariaLabel="Pesquisar franqueados na tabela"
      >
        {children}
      </RedeTabelaToolbarBusca>
      <TabelaRedeFranqueadosEditavel
        rows={rowsFiltradas}
        canEditRows={canEditRows}
        maskSensitiveColumns={maskSensitiveColumns}
        totalSemBusca={rows.length}
        buscaAtiva={busca.trim().length > 0}
        buscaResetKey={busca}
      />
    </div>
  );
}
