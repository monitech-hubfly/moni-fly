'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  moniCapitalCadastroMatchesBusca,
  ordenarMoniCapitalCadastros,
  type MoniCapitalCadastroRow,
} from '@/lib/moni-capital-cadastros';
import { RedeTabelaToolbarBusca } from '@/app/rede-franqueados/RedeTabelaToolbarBusca';
import { CadastrosMoniCapitalTabela } from './CadastrosMoniCapitalTabela';

type Props = {
  rows: MoniCapitalCadastroRow[];
  loadError?: boolean;
  children?: ReactNode;
};

export function CadastrosMoniCapitalTabelaComBusca({ rows, loadError, children }: Props) {
  const [busca, setBusca] = useState('');

  const todasLinhas = useMemo(() => ordenarMoniCapitalCadastros(rows), [rows]);

  const linhasFiltradas = useMemo(() => {
    const q = busca.trim();
    if (!q) return todasLinhas;
    return todasLinhas.filter((r) => moniCapitalCadastroMatchesBusca(r, q));
  }, [todasLinhas, busca]);

  if (loadError) {
    return (
      <p className="text-sm" style={{ color: 'var(--moni-status-overdue-text)' }}>
        Erro ao carregar cadastros Moní Capital. Confira se a migration 435 foi aplicada no Supabase.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <RedeTabelaToolbarBusca
        value={busca}
        onChange={setBusca}
        placeholder="Pesquisar broker ou investidor…"
        ariaLabel="Pesquisar cadastros Moní Capital"
      >
        {children}
      </RedeTabelaToolbarBusca>
      <CadastrosMoniCapitalTabela
        linhas={linhasFiltradas}
        totalSemBusca={todasLinhas.length}
        buscaAtiva={busca.trim().length > 0}
        buscaResetKey={busca}
      />
    </div>
  );
}
