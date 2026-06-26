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

function nomeFunilChip(chip: ParalelaChip): string {
  return String(chip.funilNome ?? chip.label ?? '').trim() || 'Funil';
}

function faseAtualChip(chip: ParalelaChip): string {
  return String(chip.faseNome ?? '').trim() || 'Em andamento';
}

function ariaParalela(chip: ParalelaChip): string {
  const funil = nomeFunilChip(chip);
  const fase = faseAtualChip(chip);
  const sufixo = chip.concluido ? ' · Concluído' : '';
  return `${funil} · ${fase}${sufixo}`;
}

function ParalelaBolinha({ chip }: { chip: ParalelaChip }) {
  const cor = corParalelaKanban(chip.kanbanId);
  const concluido = Boolean(chip.concluido);
  const nomeFunil = nomeFunilChip(chip);
  const faseAtual = faseAtualChip(chip);

  const style: CSSProperties = concluido
    ? { background: cor, borderColor: cor }
    : { background: 'transparent', borderColor: cor };

  return (
    <div className="moni-kanban-paralela-bolinha-wrap">
      <span
        role="img"
        aria-label={ariaParalela(chip)}
        className="moni-kanban-paralela-bolinha"
        style={style}
      />
      <span role="tooltip" className="moni-kanban-paralela-tooltip">
        {nomeFunil}
        <br />
        <span className="moni-kanban-paralela-tooltip-fase">{faseAtual}</span>
      </span>
    </div>
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
