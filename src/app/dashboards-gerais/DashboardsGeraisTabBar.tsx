'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export type DashboardsGeraisTabId =
  | 'visao-geral'
  | 'pipeline-franqueados'
  | 'pipeline-loteadores'
  | 'painel-funis'
  | 'kpis'
  | 'painel-sirene';

const TABS: { id: DashboardsGeraisTabId; label: string }[] = [
  { id: 'visao-geral', label: 'Visão Geral' },
  { id: 'pipeline-franqueados', label: 'Pipeline da Rede de Franqueados' },
  { id: 'pipeline-loteadores', label: 'Pipeline da Rede de Loteadores' },
  { id: 'painel-funis', label: 'Painel Geral Funis' },
  { id: 'kpis', label: "KPI's" },
  { id: 'painel-sirene', label: 'Painel Geral Sirene' },
];

const BASE_PATH = '/dashboards-gerais';
const DEFAULT_TAB: DashboardsGeraisTabId = 'visao-geral';

type Props = { activeTab: DashboardsGeraisTabId };

export function DashboardsGeraisTabBar({ activeTab }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleTabClick(tabId: DashboardsGeraisTabId) {
    const params = new URLSearchParams(searchParams.toString());
    if (tabId === DEFAULT_TAB) {
      params.delete('tab');
    } else {
      params.set('tab', tabId);
    }
    const q = params.toString();
    router.replace(q ? `${BASE_PATH}?${q}` : BASE_PATH);
  }

  return (
    <div
      className="mt-6"
      style={{ borderBottom: '0.5px solid var(--moni-border-default, #e8e2da)' }}
    >
      <nav className="-mb-px flex flex-wrap gap-0" role="tablist" aria-label="Dashboards Gerais Moní">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => handleTabClick(tab.id)}
              className="relative px-4 py-3 text-sm font-medium transition-colors hover:bg-stone-50/80"
              style={{
                color: isActive
                  ? 'var(--moni-navy-800, #0c2633)'
                  : 'var(--moni-text-tertiary, #78716c)',
              }}
            >
              {tab.label}
              {isActive && (
                <span
                  className="absolute bottom-0 left-0 right-0 rounded-t-[1px]"
                  style={{ height: '3px', background: 'var(--moni-green-800, #2F4A3A)' }}
                />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
