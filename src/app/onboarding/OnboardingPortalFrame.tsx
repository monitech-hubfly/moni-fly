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
    <div className="h-full min-h-0 w-full bg-stone-100">
      <iframe src={src} className="h-full min-h-[70vh] w-full border-0" title="Conteúdo do onboarding" />
    </div>
  );
}
