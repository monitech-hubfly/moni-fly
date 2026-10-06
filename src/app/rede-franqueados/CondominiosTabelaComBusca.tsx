'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { TabelaCondominiosEditavel } from '@/components/TabelaCondominiosEditavel';
import { RedeTabelaToolbarBusca } from '@/app/rede-franqueados/RedeTabelaToolbarBusca';
import { useDebounce } from '@/hooks/useDebounce';
import {
  condominioRowMatchesBusca,
  filtrarLinhasEmBrancoCondominios,
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
  const debouncedBusca = useDebounce(busca);

  const rowsComCadastro = useMemo(() => filtrarLinhasEmBrancoCondominios(rows), [rows]);

  const rowsFiltradas = useMemo(() => {
    const q = debouncedBusca.trim();
    const base = q ? rowsComCadastro.filter((r) => condominioRowMatchesBusca(r, q)) : rowsComCadastro;
    return ordenarCondominiosPorNome(base);
  }, [rowsComCadastro, debouncedBusca]);

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
        totalSemBusca={rowsComCadastro.length}
        buscaAtiva={busca.trim().length > 0}
        buscaResetKey={busca}
        solicitarCriacao={solicitarCriacao}
      />
    </div>
  );
}
