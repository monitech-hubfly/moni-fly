'use client';

import { useMemo, useState } from 'react';
import type { PipelineCardRow } from '@/lib/kanban/pipeline-cards-types';
import { fkFranqueadoPipeline } from '@/lib/kanban/pipeline-cards-utils';

const FUNIL_CARDS_MAX_LINHAS = 8;

type Props = {
  cards: PipelineCardRow[];
};

function celula(val: string | null | undefined): string {
  const s = String(val ?? '').trim();
  return s || '—';
}

function labelCondominio(card: PipelineCardRow): string {
  return celula(card.nome_condominio ?? card.projeto_titulo);
}

function ordenarCards(a: PipelineCardRow, b: PipelineCardRow): number {
  const fkA = String(a.n_franquia ?? '').trim();
  const fkB = String(b.n_franquia ?? '').trim();
  if (fkA !== fkB) return fkA.localeCompare(fkB, 'pt-BR', { numeric: true });
  const condoA = labelCondominio(a);
  const condoB = labelCondominio(b);
  if (condoA !== condoB) return condoA.localeCompare(condoB, 'pt-BR');
  const qA = String(a.quadra ?? '').trim();
  const qB = String(b.quadra ?? '').trim();
  if (qA !== qB) return qA.localeCompare(qB, 'pt-BR', { numeric: true });
  return String(a.lote ?? '').trim().localeCompare(String(b.lote ?? '').trim(), 'pt-BR', {
    numeric: true,
  });
}

export function PipelineFunilColunaCardsTabela({ cards }: Props) {
  const [expanded, setExpanded] = useState(false);

  const rows = useMemo(() => [...cards].sort(ordenarCards), [cards]);
  const hasMore = rows.length > FUNIL_CARDS_MAX_LINHAS;
  const visibleRows = expanded || !hasMore ? rows : rows.slice(0, FUNIL_CARDS_MAX_LINHAS);
  const restante = rows.length - FUNIL_CARDS_MAX_LINHAS;

  const linkBtnClass =
    'min-h-[28px] w-full text-left text-[10px] font-medium underline-offset-2 hover:underline';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-[10px]">
          <thead>
            <tr style={{ borderBottom: '0.5px solid var(--moni-border-subtle, var(--moni-border-default))' }}>
              <th className="pb-1.5 pr-2 font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--moni-text-tertiary)' }}>
                Franquia
              </th>
              <th className="pb-1.5 pr-2 font-semibold uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
                Franqueado
              </th>
              <th className="pb-1.5 pr-2 font-semibold uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
                Condomínio
              </th>
              <th className="pb-1.5 pr-2 font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--moni-text-tertiary)' }}>
                Quadra
              </th>
              <th className="pb-1.5 font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--moni-text-tertiary)' }}>
                Lote
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-2" style={{ color: 'var(--moni-text-tertiary)' }}>
                  —
                </td>
              </tr>
            ) : (
              visibleRows.map((card) => (
                <tr
                  key={card.id}
                  style={{ borderBottom: '0.5px solid var(--moni-border-subtle, var(--moni-border-default))' }}
                >
                  <td className="py-1.5 pr-2 tabular-nums whitespace-nowrap" style={{ color: 'var(--moni-text-primary)' }}>
                    {celula(
                      card.n_franquia ??
                        fkFranqueadoPipeline({
                          n_franquia: card.n_franquia,
                          rede_franqueado_id: card.rede_franqueado_id ?? '',
                        }),
                    )}
                  </td>
                  <td className="py-1.5 pr-2" style={{ color: 'var(--moni-text-secondary)' }}>
                    {celula(card.franqueado_nome)}
                  </td>
                  <td className="py-1.5 pr-2" style={{ color: 'var(--moni-text-secondary)' }}>
                    {labelCondominio(card)}
                  </td>
                  <td className="py-1.5 pr-2 tabular-nums whitespace-nowrap" style={{ color: 'var(--moni-text-secondary)' }}>
                    {celula(card.quadra)}
                  </td>
                  <td className="py-1.5 tabular-nums whitespace-nowrap" style={{ color: 'var(--moni-text-secondary)' }}>
                    {celula(card.lote)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
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
      </div>
    </div>
  );
}
