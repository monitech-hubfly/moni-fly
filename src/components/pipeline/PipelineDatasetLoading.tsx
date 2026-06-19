'use client';

import { Loader2 } from 'lucide-react';

export function PipelineDatasetLoading({ label = 'Carregando pipeline…' }: { label?: string }) {
  return (
    <div
      className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl px-6 py-12 text-center"
      style={{
        border: '0.5px dashed var(--moni-border-default)',
        background: 'var(--moni-surface-0)',
      }}
    >
      <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--moni-navy-800)' }} aria-hidden />
      <p className="text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
        {label}
      </p>
    </div>
  );
}
