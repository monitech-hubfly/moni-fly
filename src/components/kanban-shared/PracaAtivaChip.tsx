'use client';

type Props = {
  label: string;
};

/** Indica a praça/cidade ativa no checklist Dados da Cidade. */
export function PracaAtivaChip({ label }: Props) {
  return (
    <div
      className="mb-3 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium"
      style={{
        background: 'var(--moni-kanban-stepone-light)',
        color: 'var(--moni-text-primary)',
        border: '0.5px solid var(--moni-border-default)',
      }}
      role="status"
      aria-label={`Praça ativa: ${label}`}
    >
      <span style={{ color: 'var(--moni-text-tertiary)' }}>Praça:</span>
      <span>{label}</span>
    </div>
  );
}
