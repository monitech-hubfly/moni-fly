'use client';

import type { PipelineFunilMesCompact } from '@/lib/kanban/pipeline-cards-types';

type Props = {
  funil: PipelineFunilMesCompact;
};

function valorCor(n: number): string {
  return n > 0 ? 'var(--moni-kanban-portfolio)' : 'var(--moni-text-tertiary)';
}

/** Header colapsado — H:X · O:X · C:X · CT:X */
export function PipelineFunilMesInline({ funil }: Props) {
  const items: { key: string; value: number }[] = [
    { key: 'H', value: funil.hipoteses },
    { key: 'O', value: funil.opcoes },
    { key: 'C', value: funil.comites },
    { key: 'CT', value: funil.contratos },
  ];

  return (
    <span className="text-[10px] tabular-nums" style={{ color: 'var(--moni-text-tertiary)' }}>
      {items.map((item, idx) => (
        <span key={item.key}>
          {idx > 0 ? <span style={{ color: 'var(--moni-text-tertiary)' }}> · </span> : null}
          <span style={{ color: 'var(--moni-text-tertiary)' }}>{item.key}:</span>
          <span style={{ color: valorCor(item.value) }}>{item.value}</span>
        </span>
      ))}
    </span>
  );
}
