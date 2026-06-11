'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
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
import { CadastrosEmpresasTabela } from './CadastrosEmpresasTabela';

type Props = {
  redeRows: RedeFranqueadoRowDb[];
  empresasRows: FranqueadoEmpresaRow[];
  spesRows?: FranqueadoSpeRow[];
  empresasLoadError?: boolean;
  spesLoadError?: boolean;
};

export function CadastrosEmpresasTabelaComBusca({
  redeRows,
  empresasRows,
  spesRows = [],
  empresasLoadError,
  spesLoadError,
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
      <div className="relative max-w-md">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
          aria-hidden
        />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Pesquisar franqueado ou empresa…"
          className="w-full rounded-lg border border-stone-200 bg-white py-2 pl-9 pr-3 text-sm text-stone-800 shadow-sm placeholder:text-stone-400 focus:border-[#0c2633] focus:outline-none focus:ring-1 focus:ring-[#0c2633]/30"
          aria-label="Pesquisar cadastros de empresas"
        />
      </div>
      <CadastrosEmpresasTabela
        linhas={linhasFiltradas}
        totalSemBusca={todasLinhas.length}
        buscaAtiva={busca.trim().length > 0}
      />
    </div>
  );
}
