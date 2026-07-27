'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { PipelineFunilMesColuna } from '@/lib/kanban/pipeline-cards-types';
import { PipelineFunilColunaUnidadeTabela } from '@/components/pipeline/PipelineFunilColunaUnidadeTabela';

type Props = {
  open: boolean;
  coluna: PipelineFunilMesColuna | null;
  temZerosGlobal: boolean;
  onClose: () => void;
};

export function PipelineFunilColunaDetalheModal({ open, coluna, temZerosGlobal, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !coluna) return null;

  const totalLabel = coluna.totalIndisponivel ? '—' : String(coluna.total);

  return (
    <div
      className="fixed inset-0 z-[220] flex items-end justify-center p-0 sm:items-center sm:p-4"
      style={{ background: 'rgba(12, 38, 51, 0.45)' }}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="funil-coluna-modal-titulo"
        className="flex max-h-[92vh] w-full max-w-sm flex-col overflow-hidden sm:max-h-[85vh]"
        style={{
          borderRadius: 'var(--moni-radius-lg)',
          border: 'var(--moni-border-width) solid var(--moni-border-default)',
          background: 'var(--moni-surface-0)',
          boxShadow: 'var(--moni-shadow-card)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex shrink-0 items-start justify-between gap-3 px-4 py-4 sm:px-5"
          style={{ borderBottom: 'var(--moni-border-width) solid var(--moni-border-default)' }}
        >
          <div className="min-w-0">
            <h2
              id="funil-coluna-modal-titulo"
              className="text-base font-semibold sm:text-lg"
              style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-navy-800)' }}
            >
              {coluna.label}
            </h2>
            <p className="mt-1 text-sm tabular-nums" style={{ color: 'var(--moni-text-secondary)' }}>
              {totalLabel} {coluna.total === 1 ? 'card' : 'cards'} na rede
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition hover:bg-[var(--moni-surface-100)]"
            aria-label="Fechar"
            style={{ borderRadius: 'var(--moni-radius-md)' }}
          >
            <X className="h-5 w-5" style={{ color: 'var(--moni-text-tertiary)' }} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          <PipelineFunilColunaUnidadeTabela
            porUnidade={coluna.porUnidade}
            porUnidadeZeradas={coluna.porUnidadeZeradas}
            temZerosGlobal={temZerosGlobal}
          />
        </div>
      </div>
    </div>
  );
}
