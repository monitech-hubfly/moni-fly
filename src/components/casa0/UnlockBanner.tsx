'use client';

import { Lock, Unlock } from 'lucide-react';
import clsx from 'clsx';

export type UnlockBannerProps = {
  desbloqueado: boolean;
  /** Ex.: "Casa 1 — Step One" (usado nas mensagens de bloqueio e desbloqueio). */
  casaProxima: string;
};

export function UnlockBanner({ desbloqueado, casaProxima }: UnlockBannerProps) {
  if (!desbloqueado) {
    return (
      <div
        className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:gap-4"
        role="status"
      >
        <div className="flex shrink-0 items-center justify-center rounded-lg bg-amber-100 p-2 text-amber-800">
          <Lock className="h-5 w-5" strokeWidth={2} aria-hidden />
        </div>
        <p className="text-sm font-medium leading-snug text-amber-950">
          Conclua o setup operacional e a missão para desbloquear a {casaProxima}
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      role="status"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
        <div className="flex shrink-0 items-center justify-center rounded-lg bg-emerald-100 p-2 text-emerald-800">
          <Unlock className="h-5 w-5" strokeWidth={2} aria-hidden />
        </div>
        <p className="text-sm font-medium leading-snug text-emerald-950">
          {casaProxima} desbloqueada — você está pronto para o Step One
        </p>
      </div>
      <a
        href="/casa1"
        className={clsx(
          'inline-flex shrink-0 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition-opacity',
          'border border-emerald-300 bg-white text-emerald-900',
          'pointer-events-none cursor-not-allowed opacity-60',
        )}
        aria-disabled="true"
        tabIndex={-1}
        onClick={(e) => e.preventDefault()}
      >
        Ir para a Casa 1 →
      </a>
    </div>
  );
}
