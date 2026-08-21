'use client';

import { useState } from 'react';
import type { PipelineFunilMesUnidadeRow } from '@/lib/kanban/pipeline-cards-types';

const FUNIL_TABELA_MAX_LINHAS = 4;

type Props = {
  porUnidade: PipelineFunilMesUnidadeRow[];
  porUnidadeZeradas: PipelineFunilMesUnidadeRow[];
  temZerosGlobal: boolean;
};

export function PipelineFunilColunaUnidadeTabela({ porUnidade, porUnidadeZeradas, temZerosGlobal }: Props) {
  const [showZeros, setShowZeros] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const temZeros = porUnidadeZeradas.length > 0;
  const rows = showZeros ? [...porUnidade, ...porUnidadeZeradas] : porUnidade;
  const hasMore = rows.length > FUNIL_TABELA_MAX_LINHAS;
  const visibleRows = expanded || !hasMore ? rows : rows.slice(0, FUNIL_TABELA_MAX_LINHAS);
  const restante = rows.length - FUNIL_TABELA_MAX_LINHAS;

  const linkBtnClass =
    'min-h-[28px] w-full text-left text-[10px] font-medium underline-offset-2 hover:underline';

  return (
    <div className="mt-3 flex min-h-0 flex-1 flex-col">
      <table className="w-full text-left text-[10px]">
        <thead>
          <tr style={{ borderBottom: '0.5px solid var(--moni-border-subtle, var(--moni-border-default))' }}>
            <th className="pb-1.5 pr-1 font-semibold uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
              FK
            </th>
            <th className="pb-1.5 text-right font-semibold uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
              Qtd
            </th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.length === 0 ? (
            <tr>
              <td colSpan={2} className="py-2" style={{ color: 'var(--moni-text-tertiary)' }}>
                —
              </td>
            </tr>
          ) : (
            visibleRows.map((row) => (
              <tr
                key={row.redeId}
                style={{ borderBottom: '0.5px solid var(--moni-border-subtle, var(--moni-border-default))' }}
              >
                <td
                  className="py-1 pr-1 tabular-nums"
                  style={{ color: row.quantidade > 0 ? 'var(--moni-text-secondary)' : 'var(--moni-text-tertiary)' }}
                >
                  {row.label}
                </td>
                <td
                  className="py-1 text-right tabular-nums font-medium"
                  style={{ color: row.quantidade > 0 ? 'var(--moni-text-primary)' : 'var(--moni-text-tertiary)' }}
                >
                  {row.quantidade}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div className="mt-auto space-y-0.5 pt-1.5">
        {hasMore ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={linkBtnClass}
            style={{ color: 'var(--moni-navy-800)' }}
          >
            {expanded ? 'Ver menos' : `Ver mais (+${restante})`}
          </button>
        ) : null}
        {temZeros ? (
          <button
            type="button"
            onClick={() => {
              setShowZeros((v) => !v);
              setExpanded(false);
            }}
            className={linkBtnClass}
            style={{ color: 'var(--moni-navy-800)' }}
          >
            {showZeros ? 'Ocultar zeradas' : 'Ver todas'}
          </button>
        ) : temZerosGlobal ? (
          <span className="block min-h-[28px]" aria-hidden />
        ) : null}
      </div>
    </div>
  );
}
