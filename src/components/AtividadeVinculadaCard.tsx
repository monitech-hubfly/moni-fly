'use client';

import type { ReactNode } from 'react';
import type { AtividadeVinculadaKind } from '@/lib/atividade-vinculada-visual';
import { atividadeVinculadaRaisedSurface } from '@/lib/atividade-vinculada-visual';

type Props = {
  kind: AtividadeVinculadaKind;
  as?: 'div' | 'li';
  className?: string;
  children: ReactNode;
};

/**
 * Cartão de linha de atividade: mesma base visual dos exemplos do Funil
 * (fundo por status, borda, relevo 3d leve).
 */
export function AtividadeVinculadaCard({ kind, as = 'div', className, children }: Props) {
  const Tag = as;
  const surface = atividadeVinculadaRaisedSurface(kind);
  return (
    <Tag className={`p-3 text-sm ${className ?? ''}`} style={surface}>
      {children}
    </Tag>
  );
}
