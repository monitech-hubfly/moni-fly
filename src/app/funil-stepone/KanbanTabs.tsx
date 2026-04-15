'use client';

import { useSearchParams, useRouter } from 'next/navigation';

type Tab = {
  id: string;
  label: string;
  disabled?: boolean;
};

const TABS: Tab[] = [
  { id: 'kanban', label: 'Kanban' },
  { id: 'painel', label: 'Painel' }, // Em desenvolvimento
];

export function KanbanTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'kanban';

  function handleTabClick(tabId: string, disabled?: boolean) {
    if (disabled) return;
    
    const params = new URLSearchParams(searchParams.toString());
    if (tabId === 'kanban') {
      params.delete('tab');
    } else {
      params.set('tab', tabId);
    }
    
    const query = params.toString();
    router.push(`/funil-stepone${query ? `?${query}` : ''}`);
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
                role="tab"
                aria-selected={isActive}
                aria-disabled={tab.disabled}
                onClick={() => handleTabClick(tab.id, tab.disabled)}
                disabled={tab.disabled}
                className="relative px-4 py-3 text-sm font-medium transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  color: isActive 
                    ? 'var(--moni-navy-800)' 
                    : 'var(--moni-text-tertiary)',
                  background: isActive ? 'transparent' : 'transparent',
                }}
              >
                {tab.label}
                
                {/* Linha indicadora da aba ativa - mais sutil */}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-0 right-0"
                    style={{
                      height: '2px',
                      background: 'var(--moni-kanban-stepone)',
                    }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
