'use client';

export type KanbanFaseSecaoTab = {
  id: string;
  label: string;
};

type Props = {
  tabs: KanbanFaseSecaoTab[];
  abaAtiva: string;
  onAbaChange: (id: string) => void;
  /** Rótulo acessível da lista de abas. */
  ariaLabel: string;
  children: React.ReactNode;
};

/** Abas de seção no checklist de fase (cidades, condomínios, etc.). */
export function KanbanFaseSecaoTabs({ tabs, abaAtiva, onAbaChange, ariaLabel, children }: Props) {
  if (tabs.length <= 1) {
    return <div className="kanban-fase-checklist-list">{children}</div>;
  }

  return (
    <div className="kanban-fase-checklist-list">
      <div
        className="flex flex-wrap gap-1 border-b pb-0.5"
        style={{ borderColor: 'var(--moni-border-default)' }}
        role="tablist"
        aria-label={ariaLabel}
      >
        {tabs.map((tab) => {
          const ativa = abaAtiva === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={ativa}
              onClick={() => onAbaChange(tab.id)}
              className="rounded-t-md px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                color: ativa ? 'var(--moni-primary-700)' : 'var(--moni-text-secondary)',
                background: ativa ? 'var(--moni-surface-100)' : 'transparent',
                borderBottom: ativa ? '2px solid var(--moni-primary-500)' : '2px solid transparent',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="kanban-fase-checklist-list">
        {children}
      </div>
    </div>
  );
}
