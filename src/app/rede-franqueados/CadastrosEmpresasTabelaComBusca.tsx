'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  buildCadastrosEmpresasLinhas,
  cadastroEmpresasLinhaMatchesBusca,
  type FranqueadoEmpresaRow,
} from '@/lib/franqueado-empresas';
import {
  buildCadastrosEmpresasLinhasComSpe,
  speMatchesBusca,
  type FranqueadoSpeRow,
} from '@/lib/franqueado-spe';
import type { RedeFranqueadoRowDb } from '@/lib/rede-franqueados';
import { RedeTabelaToolbarBusca } from '@/app/rede-franqueados/RedeTabelaToolbarBusca';
import { CadastrosEmpresasTabela } from './CadastrosEmpresasTabela';

type Props = {
  redeRows: RedeFranqueadoRowDb[];
  empresasRows: FranqueadoEmpresaRow[];
  spesRows?: FranqueadoSpeRow[];
  empresasLoadError?: boolean;
  spesLoadError?: boolean;
  children?: ReactNode;
};

export function CadastrosEmpresasTabelaComBusca({
  redeRows,
  empresasRows,
  spesRows = [],
  empresasLoadError,
  spesLoadError,
  children,
}: Props) {
  const [busca, setBusca] = useState('');

  const baseLinhas = useMemo(
    () => buildCadastrosEmpresasLinhas(redeRows, empresasRows),
    [redeRows, empresasRows],
  );

  const todasLinhas = useMemo(
    () => buildCadastrosEmpresasLinhasComSpe(redeRows, baseLinhas, spesRows),
    [redeRows, baseLinhas, spesRows],
  );

  const linhasFiltradas = useMemo(() => {
    const q = busca.trim();
    if (!q) return todasLinhas;
    return todasLinhas.filter(
      (l) => cadastroEmpresasLinhaMatchesBusca(l, q) || l.spes.some((s) => speMatchesBusca(s, q)),
    );
  }, [todasLinhas, busca]);

  if (empresasLoadError || spesLoadError) {
    return (
      <p className="text-sm text-red-600">
        Erro ao carregar cadastros de empresa/SPE. Confira se as migrations 207 e 320 foram aplicadas no Supabase.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <RedeTabelaToolbarBusca
        value={busca}
        onChange={setBusca}
        placeholder="Pesquisar franqueado ou empresa…"
        ariaLabel="Pesquisar cadastros de empresas"
      >
        {children}
      </RedeTabelaToolbarBusca>
      <CadastrosEmpresasTabela
        linhas={linhasFiltradas}
        totalSemBusca={todasLinhas.length}
        buscaAtiva={busca.trim().length > 0}
        buscaResetKey={busca}
      />
    </div>
  );
}
