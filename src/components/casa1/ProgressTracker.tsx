'use client';

import { CheckCircle } from 'lucide-react';

export type ProgressTrackerProps = {
  progresso: number;
  tudoConcluido: boolean;
  missaoConcluida: boolean;
};

function CompletionBadge() {
  return (
    <div
      className="flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900 shadow-sm"
      role="status"
      aria-live="polite"
    >
      <CheckCircle className="h-6 w-6 shrink-0 text-emerald-600" strokeWidth={2} aria-hidden />
      <span className="text-sm font-semibold tracking-tight">Trilha Casa 1 concluída</span>
    </div>
  );
}

export function ProgressTracker({ progresso, tudoConcluido, missaoConcluida }: ProgressTrackerProps) {
  const pct = Math.max(0, Math.min(100, Math.round(Number.isFinite(progresso) ? progresso : 0)));
  const showBadge = tudoConcluido && missaoConcluida;

  if (showBadge) {
    return <CompletionBadge />;
  }

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-700">
          Trilha Casa 1 — <span className="tabular-nums text-slate-900">{pct}</span>% concluído
        </p>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200/90"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Trilha Casa 1, ${pct} por cento concluído`}
      >
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
