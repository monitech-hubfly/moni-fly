'use client';

import clsx from 'clsx';
import type { CasaComProgresso } from '@/lib/universidade/types';
import { ProgressBar } from './ProgressBar';
import { Lock } from 'lucide-react';

export type CasaCardProps = {
  casa: CasaComProgresso;
  onClick?: () => void;
};

export function CasaCard({ casa, onClick }: CasaCardProps) {
  const locked = casa.status === 'bloqueada';
  const done = casa.status === 'concluida';
  const active = casa.status === 'em_progresso';

  const borderLeft =
    done
      ? 'border-l-[3px] border-l-[var(--moni-status-done-border)]'
      : active
        ? 'border-l-[3px] border-l-[var(--moni-status-attention-border)]'
        : 'border-l-[3px] border-l-transparent';

  return (
    <button
      type="button"
      disabled={locked}
      onClick={locked ? undefined : onClick}
      className={clsx(
        'w-full rounded-xl border border-[var(--moni-border-default)] bg-[var(--moni-surface-0)] p-4 text-left shadow-sm transition',
        borderLeft,
        locked ? 'pointer-events-none cursor-not-allowed opacity-45' : 'cursor-pointer hover:shadow-md',
      )}
      style={{ color: 'var(--moni-text-primary)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          {casa.numero}
        </span>
        <StatusBadge casa={casa} />
      </div>
      <h3 className="mt-1 text-sm font-medium" style={{ color: 'var(--moni-text-primary)' }}>
        {casa.titulo}
      </h3>
      {casa.descricao ? (
        <p className="mt-1 line-clamp-2 text-xs" style={{ color: 'var(--moni-text-secondary)' }}>
          {casa.descricao}
        </p>
      ) : null}
      <div className="mt-3">
        <ProgressBar percentual={casa.percentual} height={3} cor={done ? 'green' : active ? 'amber' : 'purple'} />
      </div>
    </button>
  );
}

function StatusBadge({ casa }: { casa: CasaComProgresso }) {
  if (casa.status === 'concluida') {
    return (
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
        style={{
          background: 'var(--moni-status-done-bg)',
          color: 'var(--moni-status-done-text)',
          border: '0.5px solid var(--moni-status-done-border)',
        }}
      >
        Concluída
      </span>
    );
  }
  if (casa.status === 'em_progresso') {
    return (
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
        style={{
          background: 'var(--moni-status-attention-bg)',
          color: 'var(--moni-status-attention-text)',
          border: '0.5px solid var(--moni-status-attention-border)',
        }}
      >
        Em andamento · {casa.percentual}%
      </span>
    );
  }
  if (casa.status === 'bloqueada') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-medium opacity-60" style={{ color: 'var(--moni-text-tertiary)' }}>
        <Lock className="h-3 w-3" aria-hidden />
        Bloqueada
      </span>
    );
  }
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{
        background: 'var(--moni-surface-100)',
        color: 'var(--moni-text-tertiary)',
        border: '0.5px solid var(--moni-border-subtle)',
      }}
    >
      Disponível
    </span>
  );
}
