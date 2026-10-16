'use client';

/**
 * Compatibilidade: o modal do card do Funil vive em `@/components/kanban-shared/KanbanCardModal`.
 */
import dynamic from 'next/dynamic';

const KanbanCardModal = dynamic(
  () => import('@/components/kanban-shared/KanbanCardModal').then((m) => m.KanbanCardModal),
  { ssr: false },
);

export function CardModal({
  cardId,
  onClose,
  isAdmin,
}: {
  cardId: string;
  onClose: () => void;
  isAdmin: boolean;
}) {
  return (
    <KanbanCardModal
      cardId={cardId}
      kanbanNome="Funil Step One"
      onClose={onClose}
      isAdmin={isAdmin}
      basePath="/funil-stepone"
    />
  );
}
