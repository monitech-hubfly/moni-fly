'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { TabelaCondominiosEditavel } from '@/components/TabelaCondominiosEditavel';
import { RedeTabelaToolbarBusca } from '@/app/rede-franqueados/RedeTabelaToolbarBusca';
import {
  condominioRowMatchesBusca,
  ordenarCondominiosPorNome,
  type CondominioRow,
} from '@/lib/condominios';

type Props = {
  rows: CondominioRow[];
  canEdit?: boolean;
  children?: ReactNode;
  solicitarCriacao?: number;
};

export function CondominiosTabelaComBusca({
  rows,
  canEdit = true,
  children,
  solicitarCriacao = 0,
}: Props) {
  const [busca, setBusca] = useState('');

  const rowsFiltradas = useMemo(() => {
    const q = busca.trim();
    const base = q ? rows.filter((r) => condominioRowMatchesBusca(r, q)) : rows;
    return ordenarCondominiosPorNome(base);
  }, [rows, busca]);

  return (
    <div className="space-y-4">
      <RedeTabelaToolbarBusca
        value={busca}
        onChange={setBusca}
        placeholder="Pesquisar condomínios…"
        ariaLabel="Pesquisar condomínios"
      >
        {children}
      </RedeTabelaToolbarBusca>
      <TabelaCondominiosEditavel
        rows={rowsFiltradas}
        canEdit={canEdit}
        totalSemBusca={rows.length}
        buscaAtiva={busca.trim().length > 0}
        buscaResetKey={busca}
        solicitarCriacao={solicitarCriacao}
      />
    </div>
  );
}
