'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { KanbanCardModal } from '@/components/kanban-shared/KanbanCardModal';

function ModalInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const cardId = sp.get('card')?.trim() || '';
  const origem = sp.get('origem') === 'legado' ? 'legado' : 'nativo';
  const kanbanNome = sp.get('kb')?.trim() || 'Cards';

  if (!cardId) return null;

  return (
    <KanbanCardModal
      cardId={cardId}
      kanbanNome={kanbanNome}
      onClose={() => {
        router.push('/portal-frank');
        router.refresh();
      }}
      isAdmin={false}
      portalFrank
      basePath="/portal-frank"
      origem={origem}
    />
  );
}

export function PortalFrankModalHost() {
  return (
    <Suspense fallback={null}>
      <ModalInner />
    </Suspense>
  );
}
