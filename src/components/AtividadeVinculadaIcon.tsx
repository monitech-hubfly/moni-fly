'use client';

import { AlertCircle, AlertTriangle, Ban, CheckCircle2, Circle, RefreshCw } from 'lucide-react';
import type { AtividadeVinculadaKind } from '@/lib/atividade-vinculada-visual';
import { atividadeVinculadaRowStyles } from '@/lib/atividade-vinculada-visual';

type Props = {
  kind: AtividadeVinculadaKind;
  className?: string;
  /** `md` — realce nos cartões de atividade (modais / kanbans). */
  size?: 'sm' | 'md';
};

export function AtividadeVinculadaIcon({ kind, className, size = 'sm' }: Props) {
  const { iconColor } = atividadeVinculadaRowStyles(kind);
  const sz = size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
  const cn = `${sz} shrink-0 ${className ?? ''}`;

  switch (kind) {
    case 'concluido':
      return <CheckCircle2 className={cn} style={{ color: iconColor }} aria-hidden />;
    case 'atrasado':
      return <AlertCircle className={cn} style={{ color: iconColor }} aria-hidden />;
    case 'atencao':
    case 'prazo_proximo':
      return <AlertTriangle className={cn} style={{ color: iconColor }} aria-hidden />;
    case 'prazo_calm':
      return <Circle className={cn} style={{ color: iconColor }} aria-hidden />;
    case 'em_andamento':
      return <RefreshCw className={cn} style={{ color: iconColor }} aria-hidden />;
    case 'cancelada':
      return <Ban className={cn} style={{ color: iconColor }} aria-hidden />;
    default:
      return <Circle className={cn} style={{ color: iconColor }} aria-hidden />;
  }
}
