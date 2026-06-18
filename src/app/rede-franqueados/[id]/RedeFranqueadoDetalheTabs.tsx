'use client';

import { useState } from 'react';
import type { PipelineCardsDataset } from '@/lib/kanban/pipeline-cards-types';
import { PipelineCardsView } from '@/components/pipeline/PipelineCardsView';

type TabId = 'cadastro' | 'painel';

const TAB_CADASTRO = { id: 'cadastro' as const, label: 'Cadastro' };
const TAB_PAINEL = { id: 'painel' as const, label: 'Painel da Unidade' };

type Props = {
  redeId: string;
  pipelineDataset: PipelineCardsDataset;
  cadastro: React.ReactNode;
};

export function RedeFranqueadoDetalheTabs({ redeId, pipelineDataset, cadastro }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('cadastro');
  const tabs = [TAB_CADASTRO, TAB_PAINEL];

  return (
    <>
      <div style={{ borderBottom: '0.5px solid var(--moni-border-default, #e8e2da)' }}>
        <nav className="-mb-px flex flex-wrap gap-2" role="tablist" aria-label="Seções do franqueado">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className="relative min-h-[44px] px-4 py-3 text-sm font-medium transition-colors hover:bg-stone-50/80"
                style={{
                  color: isActive ? 'var(--moni-navy-800, #0c2633)' : 'var(--moni-text-tertiary, #78716c)',
                }}
              >
                {tab.label}
                {isActive ? (
                  <span
                    className="absolute bottom-0 left-0 right-0 rounded-t-[1px]"
                    style={{ height: '3px', background: 'var(--moni-green-800, #2F4A3A)' }}
                  />
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mt-8" role="tabpanel">
        {activeTab === 'cadastro' ? cadastro : null}
        {activeTab === 'painel' ? (
          <PipelineCardsView
            mode="unidade"
            franqueadoId={redeId}
            dataset={pipelineDataset}
            defaultGroupBy="funil"
            showFranchiseGroups={false}
            showKpis
          />
        ) : null}
      </div>
    </>
  );
}
