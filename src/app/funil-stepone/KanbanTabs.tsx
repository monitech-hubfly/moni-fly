'use client';

import { PainelKanbanTabs } from '@/app/steps-viabilidade/PainelKanbanTabs';

/** Abas Kanban / Painel — mesmo componente dos painéis Portfolio, Crédito e Contabilidade. */
export function KanbanTabs() {
  return <PainelKanbanTabs basePath="/funil-stepone" variant="stepone" />;
}
