'use client';

import type { PipelineCardDisplay } from '@/lib/kanban/pipeline-cards-types';
import { cardVenceEm2DiasUteis } from '@/lib/kanban/pipeline-card-readonly';
import { slaCategoriaPipeline } from '@/lib/kanban/pipeline-cards-utils';
import type { PainelChamadoUnificadoDTO } from '@/lib/kanban/painel-performance-types';

type Props = {
  cards: PipelineCardDisplay[];
  chamados?: PainelChamadoUnificadoDTO[];
  className?: string;
};

export function PipelineUnidadeResumoLinha({ cards, chamados = [], className }: Props) {
  const cardIds = new Set(cards.map((c) => c.id));
  const atrasados = cards.filter((c) => slaCategoriaPipeline(c) === 'atrasado').length;
  const travas = chamados.filter((c) => c.trava && c.aberto && cardIds.has(c.cardId)).length;
  const venceEm2d = cards.filter((c) => cardVenceEm2DiasUteis(c)).length;

  const parts: { text: string; color: string }[] = [
    { text: `${cards.length} card${cards.length === 1 ? '' : 's'}`, color: 'var(--moni-text-secondary)' },
  ];
  if (atrasados > 0) {
    parts.push({ text: `${atrasados} atrasado${atrasados === 1 ? '' : 's'}`, color: 'var(--moni-status-overdue-text)' });
  }
  if (travas > 0) {
    parts.push({ text: `${travas} trava${travas === 1 ? '' : 's'}`, color: 'var(--moni-gold-400)' });
  }
  if (venceEm2d > 0) {
    parts.push({
      text: `${venceEm2d} vence em 2d`,
      color: 'var(--moni-gold-400)',
    });
  }

  return (
    <p className={`text-[11px] ${className ?? ''}`}>
      {parts.map((p, i) => (
        <span key={p.text}>
          {i > 0 ? <span style={{ color: 'var(--moni-text-tertiary)' }}> · </span> : null}
          <span style={{ color: p.color }}>{p.text}</span>
        </span>
      ))}
    </p>
  );
}
