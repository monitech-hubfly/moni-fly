'use client';

import { useEffect, useState } from 'react';

type Props = {
  /** Hash sem `#` (ex.: `introducao`). */
  anchor: string;
};

export function OnboardingPortalFrame({ anchor }: Props) {
  const [src, setSrc] = useState(`/onboarding/portal.html?embedded=true#${encodeURIComponent(anchor)}`);

  useEffect(() => {
    setSrc(`/onboarding/portal.html?embedded=true#${encodeURIComponent(anchor)}`);
  }, [anchor]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-stone-100">
      <iframe src={src} className="min-h-0 flex-1 w-full border-0" title="Conteúdo do onboarding" />
    </div>
  );
}
