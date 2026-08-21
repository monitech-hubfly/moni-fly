'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { HUB_FUNIS_TODOS } from './hub-funis-config';

/** Aquece rotas de funil ao montar o hub — clique usa RSC já prefetchado. */
export function HubFunisPrefetch() {
  const router = useRouter();

  useEffect(() => {
    for (const funil of HUB_FUNIS_TODOS) {
      router.prefetch(funil.href);
    }
  }, [router]);

  return null;
}
