'use client';

import { Eye, EyeOff } from 'lucide-react';

interface Props {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function VisualizacaoFranqueadoToggle({ value, onChange, disabled, size = 'sm' }: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={`inline-flex items-center gap-1.5 rounded border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'
      }`}
      style={{
        minHeight: size === 'sm' ? 36 : 44,
        borderRadius: 'var(--moni-radius-md)',
        fontFamily: 'var(--moni-font-sans)',
        borderColor: value ? 'var(--moni-green-400)' : 'var(--moni-border-default)',
        background: value ? 'var(--moni-green-50)' : 'var(--moni-surface-100)',
        color: value ? 'var(--moni-green-800)' : 'var(--moni-text-secondary)',
      }}
    >
      {value ? (
        <>
          <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Visível ao Franqueado
        </>
      ) : (
        <>
          <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Oculto ao Franqueado
        </>
      )}
    </button>
  );
}
