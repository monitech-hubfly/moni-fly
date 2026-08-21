'use client';

import type { ReactNode } from 'react';
import type { AtividadeVinculadaKind } from '@/lib/atividade-vinculada-visual';
import { atividadeVinculadaRowStyles } from '@/lib/atividade-vinculada-visual';

type Props = {
  kind: AtividadeVinculadaKind;
  children: ReactNode;
  className?: string;
};

/** Pill de status com cor do token do kind (igual ao Funil / exemplos). */
export function AtividadeVinculadaStatusPill({ kind, children, className }: Props) {
  const rowVis = atividadeVinculadaRowStyles(kind);
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${className ?? ''}`}
      style={{
        background: rowVis.iconColor,
        color: 'var(--moni-surface-0)',
      }}
    >
      {children}
    </span>
  );
}
