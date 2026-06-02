'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { AtividadeVinculadaKind } from '@/lib/atividade-vinculada-visual';
import { atividadeVinculadaRaisedSurface } from '@/lib/atividade-vinculada-visual';

type Props = {
  kind: AtividadeVinculadaKind;
  as?: 'div' | 'li';
  className?: string;
  /** Menos padding vertical — listagens densas (ex.: painel Chamados). */
  compact?: boolean;
  /** Sobrescreve fundo/borda (ex.: SLA do chamado) mantendo relevo do `kind`. */
  style?: CSSProperties;
  children: ReactNode;
};

/**
 * Cartão de linha de atividade: mesma base visual dos exemplos do Funil
 * (fundo por status, borda, relevo 3d leve).
 */
export function AtividadeVinculadaCard({
  kind,
  as = 'div',
  className,
  compact = false,
  style: styleProp,
  children,
}: Props) {
  const Tag = as;
  const surface = atividadeVinculadaRaisedSurface(kind);
  return (
    <Tag
      className={`${compact ? 'p-2' : 'p-3'} text-sm ${className ?? ''}`}
      style={{ ...surface, ...styleProp }}
    >
      {children}
    </Tag>
  );
}
