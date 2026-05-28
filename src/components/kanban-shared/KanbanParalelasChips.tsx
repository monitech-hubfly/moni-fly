'use client';

import type { CSSProperties } from 'react';
import type { ParalelaChip } from '@/lib/kanban/kanban-paralelas-chips';

export type KanbanParalelasChipsProps = {
  chips: ParalelaChip[];
  /** Board: texto menor; modal: labels completos (já vêm no `label`). */
  compact?: boolean;
};

/** Indicadores de esteiras paralelas / vínculos (Step One, Portfolio, Operações). */
export function KanbanParalelasChips({ chips, compact = true }: KanbanParalelasChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div
      className={compact ? 'mt-1.5 flex flex-wrap gap-1' : 'mt-3 flex flex-wrap gap-2'}
      aria-label="Status das esteiras paralelas"
    >
      {chips.map((chip, idx) => {
        const vinculo = chip.variant === 'vinculo';
        const ok = Boolean(chip.concluido);
        const texto = chip.label;
        const sizeCls = compact
          ? 'text-[9px] leading-tight px-1 py-px'
          : 'text-xs leading-snug px-2 py-1';

        let style: CSSProperties;
        if (vinculo) {
          style = {
            background: 'var(--moni-navy-50)',
            color: 'var(--moni-navy-800)',
            border: '0.5px solid var(--moni-navy-200)',
          };
        } else if (ok) {
          style = {
            background: 'var(--moni-green-50)',
            color: 'var(--moni-green-800)',
            border: '0.5px solid var(--moni-green-400)',
          };
        } else {
          style = {
            background: '#FAEEDA',
            color: '#92400e',
            border: '0.5px solid #D4AD68',
          };
        }

        return (
          <span
            key={`${chip.label}-${idx}`}
            className={`inline-flex items-center gap-0.5 rounded font-semibold ${sizeCls}`}
            style={style}
            title={vinculo ? texto : ok ? `${texto} concluído` : `${texto} pendente`}
          >
            {chip.icone ? <span aria-hidden>{chip.icone}</span> : <span aria-hidden>{ok ? '✓' : '⏳'}</span>}
            <span>{texto}</span>
          </span>
        );
      })}
    </div>
  );
}
