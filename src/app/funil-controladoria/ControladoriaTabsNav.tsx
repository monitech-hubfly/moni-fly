'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export type ControladoriaAba = 'contabil' | 'fiscal' | 'config';

const TABS: { id: ControladoriaAba; label: string; icon: string }[] = [
  { id: 'contabil', label: 'Rotina Contábil', icon: '🏦' },
  { id: 'fiscal',   label: 'Rotina Fiscal',   icon: '🧾' },
  { id: 'config',   label: 'Configuração',    icon: '⚙️' },
];

export function ControladoriaTabsNav({ aba }: { aba: ControladoriaAba }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleTab(id: ControladoriaAba) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('card');
    params.delete('kanbanCard');
    params.delete('novo');
    params.delete('tab');
    if (id === 'contabil') {
      params.delete('aba');
    } else {
      params.set('aba', id);
    }
    const q = params.toString();
    router.push(q ? `/funil-controladoria?${q}` : '/funil-controladoria');
  }

  return (
    <div
      className="bg-white"
      style={{ borderBottom: '0.5px solid var(--moni-border-default)' }}
    >
      <div className="mx-auto max-w-[1600px] px-6">
        <nav className="flex gap-1" role="tablist">
          {TABS.map((tab) => {
            const isActive = aba === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => handleTab(tab.id)}
                className="flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors"
                style={{
                  borderBottomColor: isActive ? '#2d3d4a' : 'transparent',
                  color: isActive ? '#2d3d4a' : 'var(--moni-text-tertiary)',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 14 }}>{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
