'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { TabelaRedeLoteadoresEditavel } from '@/components/TabelaRedeLoteadoresEditavel';
import { RedeTabelaToolbarBusca } from '@/app/rede-franqueados/RedeTabelaToolbarBusca';
import { ordenarRedeLoteadoresPorCodigo, filtrarLinhasEmBrancoRedeLoteadores, redeLoteadorRowMatchesBusca, type RedeLoteadorRow } from '@/lib/rede-loteadores';

type Props = {
  rows: RedeLoteadorRow[];
  children?: ReactNode;
  solicitarCriacao?: number;
};

export function RedeLoteadoresTabelaComBusca({ rows, children, solicitarCriacao = 0 }: Props) {
  const [busca, setBusca] = useState('');

  const rowsComCadastro = useMemo(() => filtrarLinhasEmBrancoRedeLoteadores(rows), [rows]);

  const rowsFiltradas = useMemo(() => {
    const q = busca.trim();
    const base = q ? rowsComCadastro.filter((r) => redeLoteadorRowMatchesBusca(r, q)) : rowsComCadastro;
    return ordenarRedeLoteadoresPorCodigo(base);
  }, [rowsComCadastro, busca]);

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
        totalSemBusca={rowsComCadastro.length}
        buscaAtiva={busca.trim().length > 0}
        buscaResetKey={busca}
        solicitarCriacao={solicitarCriacao}
      />
    </div>
  );
}
