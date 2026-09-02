'use client';

import { Check, Lock } from 'lucide-react';

export function CertificadoBadge({
  nivel,
  titulo,
  emitido = false,
}: {
  nivel: number;
  titulo: string;
  emitido?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div
        className="relative flex h-12 w-12 items-center justify-center rounded-full text-base font-bold"
        style={{
          background: emitido ? 'var(--moni-status-done-bg)' : 'var(--moni-surface-200)',
          color: emitido ? 'var(--moni-status-done-text)' : 'var(--moni-text-tertiary)',
          border: emitido ? '1px solid var(--moni-status-done-border)' : '1px solid var(--moni-border-default)',
        }}
        title={titulo}
      >
        {nivel}
        {emitido ? (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--moni-green-600)] text-white shadow-sm">
            <Check className="h-2.5 w-2.5" aria-hidden />
          </span>
        ) : (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-[var(--moni-surface-200)]/90">
            <Lock className="h-4 w-4 opacity-80" aria-hidden />
          </span>
        )}
        <span className="sr-only">
          {titulo} — nível {nivel}
        </span>
      </div>
      <span className="text-[10px] font-semibold" style={{ color: 'var(--moni-text-tertiary)' }}>
        Nv. {nivel}
      </span>
    </div>
  );
}
