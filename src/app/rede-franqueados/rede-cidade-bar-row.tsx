'use client';

function barWidth(n: number, max: number): string {
  if (!max) return '0%';
  return `${Math.round((n / max) * 100)}%`;
}

type Props = {
  label: string;
  count: number;
  maxCount: number;
  onClick?: () => void;
};

export function RedeCidadeBarRow({ label, count, maxCount, onClick }: Props) {
  const row = (
    <div className="flex w-full items-center gap-2 py-1">
      <div
        className="w-28 shrink-0 truncate text-[11.5px]"
        title={label}
        style={{ color: 'var(--moni-text-tertiary)' }}
      >
        {label}
      </div>
      <div className="min-w-0 flex-1">
        <div className="h-1.5 rounded-sm" style={{ backgroundColor: 'var(--moni-rede-city-track)' }}>
          <div
            className="h-1.5 rounded-sm"
            style={{
              width: barWidth(count, maxCount),
              backgroundColor: 'var(--moni-rede-city-fill)',
            }}
          />
        </div>
      </div>
      <span className="w-6 shrink-0 text-right text-xs font-medium tabular-nums" style={{ color: 'var(--moni-text-primary)' }}>
        {count}
      </span>
    </div>
  );

  if (!onClick) return row;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full rounded text-left hover:bg-[var(--moni-surface-100)]"
    >
      {row}
    </button>
  );
}
