'use client';

import { PipelineCardsView } from '@/components/pipeline/PipelineCardsView';
import { PipelineDatasetLoading } from '@/components/pipeline/PipelineDatasetLoading';
import { usePipelineDatasetLazy } from '@/components/pipeline/usePipelineDatasetLazy';

export function DashboardsGeraisPipelineTab() {
  const { dataset, loading, error } = usePipelineDatasetLazy({
    mode: 'franqueadora',
    enabled: true,
  });

  if (loading) return <PipelineDatasetLoading />;

  if (error) {
    return (
      <p className="text-sm" style={{ color: 'var(--moni-status-overdue-text)' }}>
        {error}
      </p>
    );
  }

  if (!dataset) return null;

  return (
    <section className="space-y-4">
      <div>
        <h2
          className="text-xl font-semibold tracking-tight"
          style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-display)' }}
        >
          Pipeline da Rede de Franqueados
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
          Cards ativos em todos os funis, consolidados por unidade de franquia.
        </p>
      </div>
      <PipelineCardsView mode="rede" dataset={dataset} defaultGroupBy="franquia" />
    </section>
  );
}
