'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export type PainelKanbanTabsVariant =
  | 'portfolio'
  | 'acoplamento'
  | 'operacoes'
  | 'credito'
  | 'contabilidade'
  | 'stepone';

/** Mesma cor de destaque do Funil Step One em todos os painéis. */
const KANBAN_TAB_ACCENT = 'var(--moni-kanban-stepone)';

const ACCENT: Record<PainelKanbanTabsVariant, string> = {
  portfolio: KANBAN_TAB_ACCENT,
  acoplamento: KANBAN_TAB_ACCENT,
  operacoes: KANBAN_TAB_ACCENT,
  credito: KANBAN_TAB_ACCENT,
  contabilidade: KANBAN_TAB_ACCENT,
  stepone: KANBAN_TAB_ACCENT,
};

const TABS = [
  { id: 'kanban', label: 'Kanban' },
  { id: 'painel', label: 'Painel' },
] as const;

/**
 * Linha de abas Kanban | Painel.
 * `?tab=painel` ativa o painel de performance; sem `tab` ou outro valor → Kanban.
 */
export function PainelKanbanTabs({
  basePath,
  variant,
}: {
  basePath: string;
  variant: PainelKanbanTabsVariant;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') === 'painel' ? 'painel' : 'kanban';
  const accent = ACCENT[variant];

  function handleTabClick(tabId: (typeof TABS)[number]['id']) {
    const params = new URLSearchParams(searchParams.toString());
    if (tabId === 'kanban') {
      params.delete('tab');
    } else {
      params.set('tab', 'painel');
      params.delete('card');
      params.delete('abrir');
      params.delete('kanbanCard');
      params.delete('origem');
    }
    const q = params.toString();
    router.push(q ? `${basePath}?${q}` : basePath);
  }

  return (
    <div
      className="bg-white"
      style={{
        borderBottom: '0.5px solid var(--moni-border-default)',
      }}
    >
      <div className="mx-auto max-w-[1600px] px-6">
        <nav className="flex gap-2" role="tablist">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleTabClick(tab.id)}
                className="relative px-4 py-3 text-sm font-medium transition-colors hover:bg-stone-50"
                style={{
                  color: isActive ? 'var(--moni-navy-800)' : 'var(--moni-text-tertiary)',
                }}
              >
                {tab.label}
                {isActive ? (
                  <span
                    className="absolute bottom-0 left-0 right-0 rounded-t-[1px]"
                    style={{
                      height: '3px',
                      background: accent,
                    }}
                  />
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
