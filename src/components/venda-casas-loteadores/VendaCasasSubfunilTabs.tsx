'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export type VclSubfunil = 'nao-vendidos' | 'vendidos' | 'showroom';

const TABS: { id: VclSubfunil; label: string }[] = [
  { id: 'nao-vendidos', label: 'Lotes Não Vendidos' },
  { id: 'vendidos',     label: 'Lotes Vendidos' },
  { id: 'showroom',     label: 'Showroom' },
];

export function VendaCasasSubfunilTabs({ subfunil }: { subfunil: VclSubfunil }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navegar(id: VclSubfunil) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('subfunil', id);
    // Mantém ?tab= mas reseta ?card= ao trocar de sub-funil
    params.delete('card');
    params.delete('kanbanCard');
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: '0.5rem',
        padding: '0.75rem 1.25rem 0',
        borderBottom: 'var(--moni-border-width) solid var(--moni-border-default)',
        background: 'var(--moni-surface-0)',
      }}
    >
      {TABS.map((tab) => {
        const ativo = subfunil === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => navegar(tab.id)}
            style={{
              fontFamily: 'var(--moni-font-sans)',
              fontSize: '0.8125rem',
              fontWeight: ativo ? 600 : 400,
              color: ativo ? 'var(--moni-kanban-corretores)' : 'var(--moni-text-secondary)',
              background: 'transparent',
              border: 'none',
              borderBottom: ativo
                ? `2px solid var(--moni-kanban-corretores)`
                : '2px solid transparent',
              padding: '0.5rem 0.75rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'color 0.15s, border-color 0.15s',
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
