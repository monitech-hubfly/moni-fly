'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { PainelProcessoCardModal } from './PainelProcessoCardModal';
import type { PainelCardModalBoard } from './painelColumns';

/**
 * Modal estilo Funil Step One quando a URL contém `?card=UUID`.
 * Fechar remove o query param e mantém `basePath`.
 */
export function PainelCardQueryModalWrapper({
  children,
  basePath,
  board,
}: {
  children: React.ReactNode;
  basePath: string;
  board: PainelCardModalBoard;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab');
  const cardId = tab === 'painel' ? null : searchParams.get('card');

  function closeModal() {
    router.push(basePath);
  }

  return (
    <>
      {children}
      {cardId ? <PainelProcessoCardModal processoId={cardId} onClose={closeModal} board={board} /> : null}
    </>
  );
}
