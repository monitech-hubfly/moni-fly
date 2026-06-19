'use client';

import { useState } from 'react';
import { PipelineCardsView } from '@/components/pipeline/PipelineCardsView';
import { PipelineDatasetLoading } from '@/components/pipeline/PipelineDatasetLoading';
import { usePipelineDatasetLazy } from '@/components/pipeline/usePipelineDatasetLazy';

type TabId = 'cadastro' | 'painel';

const TAB_CADASTRO = { id: 'cadastro' as const, label: 'Cadastro' };
const TAB_PAINEL = { id: 'painel' as const, label: 'Painel da Unidade' };

type Props = {
  redeId: string;
  cadastro: React.ReactNode;
};

export function RedeFranqueadoDetalheTabs({ redeId, cadastro }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('cadastro');
  const tabs = [TAB_CADASTRO, TAB_PAINEL];

  const { dataset: pipelineDataset, loading: pipelineLoading, error: pipelineError } = usePipelineDatasetLazy({
    mode: 'unidade',
    franqueadoId: redeId,
    enabled: activeTab === 'painel',
  });

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
          <div>
            <p className="mb-6 text-sm leading-relaxed" style={{ color: 'var(--moni-text-secondary)' }}>
              Visão operacional da unidade: KPIs, saúde do pipeline, prioridades do dia e cards por funil com esteira
              Step One → Portfólio → Pré Obra e Obra.
            </p>
            {pipelineLoading ? (
              <PipelineDatasetLoading />
            ) : pipelineError ? (
              <p className="text-sm" style={{ color: 'var(--moni-status-overdue-text)' }}>
                {pipelineError}
              </p>
            ) : pipelineDataset ? (
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
        ) : null}
      </div>
    </>
  );
}
