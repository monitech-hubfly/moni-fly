import { Suspense } from 'react';
import { HubFunisPageStyles } from '@/components/hub-funis/HubFunisPageStyles';
import { HubFunisPlaceholder, HubFunisSlaContent } from '@/components/hub-funis/HubFunisSlaContent';

export default function HubFunisPage() {
  return (
    <>
      <HubFunisPageStyles />
      <div className="hub-funis-page">
        <Suspense fallback={<HubFunisPlaceholder />}>
          <HubFunisSlaContent />
        </Suspense>
      </div>
    </>
  );
}
