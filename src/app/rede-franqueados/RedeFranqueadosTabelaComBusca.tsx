'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  ordenarRedePorNFranquia,
  redeFranqueadoRowMatchesBusca,
  type RedeFranqueadoRowDb,
} from '@/lib/rede-franqueados';
import { TabelaRedeFranqueadosEditavel } from '@/components/TabelaRedeFranqueadosEditavel';
import { RedeTabelaToolbarBusca } from '@/app/rede-franqueados/RedeTabelaToolbarBusca';
import { DiagnosticoRedeSumario } from '@/components/diagnostico-rede/DiagnosticoRedeSumario';
import { calcPriority } from '@/lib/rede-diagnostico-engine';

type Props = {
  rows: RedeFranqueadoRowDb[];
  canEditRows?: boolean;
  maskSensitiveColumns?: boolean;
  /** Mostra labels internos de diagnóstico (Alta Prontidão, etc.). */
  internalView?: boolean;
  children?: ReactNode;
};

const PRIORITIES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'AD', 'NC'] as const;
type PrioFilter = (typeof PRIORITIES)[number] | 'TODOS';

export function RedeFranqueadosTabelaComBusca({
  rows,
  canEditRows,
  maskSensitiveColumns,
  internalView = false,
  children,
}: Props) {
  const [busca, setBusca] = useState('');
  const [prioFilter, setPrioFilter] = useState<PrioFilter>('TODOS');

  const rowsFiltradas = useMemo(() => {
    const q = busca.trim();
    let base = q ? rows.filter((r) => redeFranqueadoRowMatchesBusca(r, q)) : rows;
    if (prioFilter !== 'TODOS') {
      base = base.filter((r) => calcPriority(r) === prioFilter);
    }
    return ordenarRedePorNFranquia(base);
  }, [rows, busca, prioFilter]);

  return (
    <div className="space-y-4">
      {/* Resumo diagnóstico */}
      <DiagnosticoRedeSumario rows={rows} />

      {/* Toolbar busca + filtros de prioridade */}
      <RedeTabelaToolbarBusca
        value={busca}
        onChange={setBusca}
        placeholder="Pesquisar em qualquer coluna da planilha…"
        ariaLabel="Pesquisar franqueados na tabela"
      >
        {/* Chips de prioridade */}
        <div className="flex flex-wrap gap-1">
          {(['TODOS', ...PRIORITIES] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPrioFilter(p)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                prioFilter === p
                  ? 'bg-stone-700 text-white'
                  : 'border border-stone-300 bg-white text-stone-600 hover:bg-stone-50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        {children}
      </RedeTabelaToolbarBusca>

      <TabelaRedeFranqueadosEditavel
        rows={rowsFiltradas}
        canEditRows={canEditRows}
        maskSensitiveColumns={maskSensitiveColumns}
        totalSemBusca={rows.length}
        buscaAtiva={busca.trim().length > 0 || prioFilter !== 'TODOS'}
        buscaResetKey={`${busca}|${prioFilter}`}
        internalView={internalView}
      />
    </div>
  );
}
