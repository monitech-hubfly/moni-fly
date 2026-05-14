'use client';

import { useEffect, useState } from 'react';

export default function OnboardingPage() {
  const [iframeSrc, setIframeSrc] = useState('/onboarding/portal.html?embedded=true');

  useEffect(() => {
    const sync = () => {
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      setIframeSrc(`/onboarding/portal.html?embedded=true${hash}`);
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  return (
    <div className="h-[calc(100dvh-3.5rem)] min-h-0 w-full overflow-hidden md:h-[calc(100dvh-3.5rem)]">
      <iframe
        src={iframeSrc}
        className="h-full w-full border-0"
        title="Portal de Onboarding Moní"
      />
    </div>
  );
}
