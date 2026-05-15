'use client';

import clsx from 'clsx';

const corVar: Record<'green' | 'amber' | 'purple', string> = {
  green: 'var(--moni-status-done-border)',
  amber: 'var(--moni-status-attention-border)',
  purple: 'var(--moni-navy-400)',
};

export function ProgressBar({
  percentual,
  cor = 'green',
  height = 6,
  transitionMs = 400,
}: {
  percentual: number;
  cor?: 'green' | 'amber' | 'purple';
  height?: number;
  /** Para barra geral do tabuleiro use 600. */
  transitionMs?: number;
}) {
  const p = Math.max(0, Math.min(100, Math.round(percentual)));
  return (
    <div
      className="w-full overflow-hidden rounded-full"
      style={{ height, background: 'var(--moni-surface-200)' }}
    >
      <div
        className={clsx('h-full rounded-full')}
        style={{
          width: `${p}%`,
          background: corVar[cor],
          transition: `width ${transitionMs / 1000}s ease`,
        }}
      />
    </div>
  );
}
