import { Suspense } from 'react';
import { HubFunisPageStyles } from '@/components/hub-funis/HubFunisPageStyles';
import { HubFunisPrefetch } from '@/components/hub-funis/HubFunisPrefetch';
import { HubFunisPlaceholder, HubFunisSlaContent } from '@/components/hub-funis/HubFunisSlaContent';

export default function HubFunisPage() {
  return (
    <>
      <HubFunisPageStyles />
      <HubFunisPrefetch />
      <div className="hub-funis-page">
        <Suspense fallback={<HubFunisPlaceholder />}>
          <HubFunisSlaContent />
        </Suspense>
      </div>
    </>
  );
}
