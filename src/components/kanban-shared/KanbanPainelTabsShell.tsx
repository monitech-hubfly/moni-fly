'use client';

import { PainelKanbanTabs, type PainelKanbanTabsVariant } from '@/app/steps-viabilidade/PainelKanbanTabs';

export function KanbanPainelTabsShell({
  basePath,
  variant,
}: {
  basePath: string;
  variant: PainelKanbanTabsVariant;
}) {
  return <PainelKanbanTabs basePath={basePath} variant={variant} />;
}
