'use client';

import type { CSSProperties } from 'react';
import type { ParalelaChip } from '@/lib/kanban/kanban-paralelas-chips';
import { corParalelaKanban } from '@/lib/kanban/kanban-paralelas-cores';

export type KanbanParalelasChipsProps = {
  chips: ParalelaChip[];
  /** Board: bolinhas laterais; modal: chips de texto legados. */
  mode?: 'chips' | 'board';
  /** @deprecated Usar `mode`. Mantido para compatibilidade. */
  compact?: boolean;
};

function tooltipParalela(chip: ParalelaChip): string {
  const funil = String(chip.funilNome ?? chip.label ?? '').trim();
  const fase = String(chip.faseNome ?? '').trim();
  if (funil && fase) return `${funil} · ${fase}`;
  return funil || fase || chip.label;
}

function ariaParalela(chip: ParalelaChip): string {
  const base = tooltipParalela(chip);
  const status = chip.concluido ? 'concluído' : 'em andamento';
  return `${base} · ${status}`;
}

function ParalelaBolinha({ chip }: { chip: ParalelaChip }) {
  const cor = corParalelaKanban(chip.kanbanId);
  const concluido = Boolean(chip.concluido);
  const tooltip = tooltipParalela(chip);

  const style: CSSProperties = concluido
    ? {
        background: cor,
        borderColor: cor,
      }
    : {
        background: 'transparent',
        borderColor: cor,
      };

  return (
    <span className="group/par relative inline-flex shrink-0 items-center justify-center">
      <span
        role="img"
        aria-label={ariaParalela(chip)}
        title={tooltip}
        className="moni-kanban-paralela-bolinha"
        style={style}
      />
      <span role="tooltip" className="moni-kanban-paralela-tooltip">
        {tooltip}
      </span>
    </span>
  );
}

/** Indicadores de esteiras paralelas / vínculos (Step One, Portfolio, Operações). */
export function KanbanParalelasChips({ chips, mode = 'chips', compact = true }: KanbanParalelasChipsProps) {
  if (chips.length === 0) return null;

  if (mode === 'board') {
    return (
      <div className="moni-kanban-paralelas-bolinhas" aria-label="Vínculos com funis paralelos">
        {chips.map((chip, idx) => (
          <ParalelaBolinha key={`${chip.kanbanId ?? chip.label}-${idx}`} chip={chip} />
        ))}
      </div>
    );
  }

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
            border: 'var(--moni-border-width) solid var(--moni-navy-200)',
          };
        } else if (ok) {
          style = {
            background: 'var(--moni-green-50)',
            color: 'var(--moni-green-800)',
            border: 'var(--moni-border-width) solid var(--moni-green-400)',
          };
        } else {
          style = {
            background: 'var(--moni-gold-50)',
            color: 'var(--moni-gold-800)',
            border: 'var(--moni-border-width) solid var(--moni-gold-400)',
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
