'use client';

import type { ReactNode } from 'react';

type Props = {
  aberto: boolean;
  onAbrir: () => void;
  onFechar: () => void;
  children: ReactNode;
  /** Rótulo do botão quando fechado. */
  label?: string;
  obrigatorio?: boolean;
  className?: string;
};

export function ChamadoAtividadeCollapsibleSection({
  aberto,
  onAbrir,
  onFechar,
  children,
  label = '+ Atividade',
  obrigatorio = false,
  className = '',
}: Props) {
  if (!aberto) {
    return (
      <button
        type="button"
        onClick={onAbrir}
        className={`text-left text-xs font-medium text-stone-700 underline-offset-2 hover:underline ${className}`}
      >
        {label}
        {obrigatorio ? <span className="text-red-600"> *</span> : null}
      </button>
    );
  }

  return (
    <div
      className={`rounded-md border border-stone-200 bg-white/80 p-2 ${className}`}
      style={{ borderColor: 'var(--moni-border-default)' }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
          Atividade{obrigatorio ? ' *' : ''}
        </p>
        <button
          type="button"
          onClick={onFechar}
          className="text-[10px] font-medium text-stone-500 hover:text-stone-800"
        >
          Fechar
        </button>
      </div>
      {children}
    </div>
  );
}
