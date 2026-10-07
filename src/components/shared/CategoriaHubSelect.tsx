'use client';

import { CATEGORIAS_HUB } from '@/lib/constants/categorias-hub';

interface Props {
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
  className?: string;
  name?: string;
}

export function CategoriaHubSelect({ value, onChange, disabled, className, name }: Props) {
  return (
    <select
      name={name}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled}
      className={`rounded border px-2 py-1 text-sm disabled:opacity-50 ${className ?? ''}`}
      style={{
        minHeight: 44,
        borderRadius: 'var(--moni-radius-md)',
        border: 'var(--moni-border-width) solid var(--moni-border-default)',
        background: 'var(--moni-surface-0)',
        color: 'var(--moni-text-primary)',
        fontFamily: 'var(--moni-font-sans)',
      }}
    >
      <option value="">Categoria</option>
      {CATEGORIAS_HUB.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}
