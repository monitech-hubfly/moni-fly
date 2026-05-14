import type { ReactNode } from 'react';

/** Área cheia sob o AppStickyHeader (h-14): o iframe controla o scroll interno. */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-stone-50">{children}</div>;
}
