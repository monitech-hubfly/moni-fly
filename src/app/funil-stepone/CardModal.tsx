'use client';

/**
 * Compatibilidade: o modal do card do Funil vive em `@/components/kanban-shared/KanbanCardModal`.
 */
import { KanbanCardModal } from '@/components/kanban-shared/KanbanCardModal';

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
      legacyPanelHref="/painel-novos-negocios"
    />
  );
}
