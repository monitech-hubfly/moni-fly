'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CardModal } from './CardModal';
import { NovoCardModal } from './NovoCardModal';

export function KanbanWrapper({
  children,
  isAdmin,
  kanbanId,
}: {
  children: React.ReactNode;
  isAdmin: boolean;
  kanbanId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cardId = searchParams.get('card');
  const novoCard = searchParams.get('novo') === 'true';

  function closeModal() {
    router.push('/funil-stepone');
  }

  return (
    <>
      {children}
      
      {cardId && (
        <CardModal
          cardId={cardId}
          onClose={closeModal}
          isAdmin={isAdmin}
        />
      )}

      {novoCard && (
        <NovoCardModal
          kanbanId={kanbanId}
          onClose={closeModal}
          isAdmin={isAdmin}
        />
      )}
    </>
  );
}
