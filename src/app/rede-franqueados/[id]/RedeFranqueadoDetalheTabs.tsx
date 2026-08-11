'use client';

import { useState } from 'react';
import { PipelineCardsView } from '@/components/pipeline/PipelineCardsView';
import { PipelineDatasetLoading } from '@/components/pipeline/PipelineDatasetLoading';
import { usePipelineDatasetLazy } from '@/components/pipeline/usePipelineDatasetLazy';
import { DiagnosticoRedePainelEdit } from '@/components/diagnostico-rede/DiagnosticoRedePainelEdit';
import type { RedeDiagnosticoSource } from '@/lib/rede-diagnostico-form';
import type { RedeFranqueadoDetalheRow } from '@/lib/rede-franqueados';

type TabId = 'cadastro' | 'diagnostico' | 'painel';

const TAB_CADASTRO = { id: 'cadastro' as const, label: 'Cadastro' };
const TAB_DIAGNOSTICO = { id: 'diagnostico' as const, label: 'Diagnóstico' };
const TAB_PAINEL = { id: 'painel' as const, label: 'Painel da Unidade' };

type Props = {
  redeId: string;
  cadastro: React.ReactNode;
  /** Linha completa do franqueado — necessária para a aba Diagnóstico (staff). */
  row?: RedeFranqueadoDetalheRow | null;
  showDiagnostico?: boolean;
  internalView?: boolean;
};

export function RedeFranqueadoDetalheTabs({
  redeId,
  cadastro,
  row,
  showDiagnostico = false,
  internalView = true,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('cadastro');
  const tabs = [
    TAB_CADASTRO,
    ...(showDiagnostico && row ? [TAB_DIAGNOSTICO] : []),
    TAB_PAINEL,
  ];

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
        {activeTab === 'diagnostico' && row ? (
          <DiagnosticoRedePainelEdit
            row={{
              id: row.id,
              ordem: row.ordem ?? 0,
              status_franquia: row.status_franquia ?? null,
              diag_d: row.diag_d ?? null,
              diag_c: row.diag_c ?? null,
              diag_k: row.diag_k ?? null,
              diag_d_desc: row.diag_d_desc ?? null,
              diag_c_desc: row.diag_c_desc ?? null,
              diag_k_desc: row.diag_k_desc ?? null,
              diag_nps: row.diag_nps ?? null,
              diag_csat: row.diag_csat ?? null,
              diag_contratos_12m: row.diag_contratos_12m ?? null,
              diag_ano_meta: row.diag_ano_meta ?? null,
              diag_tend_eng: row.diag_tend_eng ?? null,
              diag_tend_rel: row.diag_tend_rel ?? null,
              diag_tend_ind: row.diag_tend_ind ?? null,
              diag_proxima_acao: row.diag_proxima_acao ?? null,
              diag_adormecido: row.diag_adormecido === true,
              diag_ultimo_contato: row.diag_ultimo_contato ?? null,
              diag_ultima_aval: row.diag_ultima_aval ?? null,
              diag_avaliado_por: row.diag_avaliado_por ?? null,
              diag_grupo_sec: row.diag_grupo_sec ?? null,
            }}
            internalView={internalView}
          />
        ) : null}
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
