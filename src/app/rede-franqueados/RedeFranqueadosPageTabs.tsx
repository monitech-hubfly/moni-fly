'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { RedeFranqueadoRowDb } from '@/lib/rede-franqueados';
import type { RedeLoteadorRow } from '@/lib/rede-loteadores';
import { RedeDashboard } from './RedeDashboard';
import { RedeFranqueadosTabelaComBusca } from './RedeFranqueadosTabelaComBusca';
import { RedeLoteadoresTabelaComBusca } from './RedeLoteadoresTabelaComBusca';
import { CadastrosEmpresasTabelaComBusca } from './CadastrosEmpresasTabelaComBusca';
import { CadastrosMoniCapitalTabelaComBusca } from './CadastrosMoniCapitalTabelaComBusca';
import { CondominiosTabelaComBusca } from './CondominiosTabelaComBusca';
import { buildCadastrosEmpresasLinhas, type FranqueadoEmpresaRow } from '@/lib/franqueado-empresas';
import { buildCadastrosEmpresasLinhasComSpe, type FranqueadoSpeRow } from '@/lib/franqueado-spe';
import type { CondominioRow } from '@/lib/condominios';
import type { MoniCapitalCadastroRow } from '@/lib/moni-capital-cadastros';
import { PipelineCardsView } from '@/components/pipeline/PipelineCardsView';
import { PipelineAnalisesView } from '@/components/pipeline/PipelineAnalisesView';
import { PipelineDatasetLoading } from '@/components/pipeline/PipelineDatasetLoading';
import { usePipelineDatasetLazy } from '@/components/pipeline/usePipelineDatasetLazy';
import { ImportarRedeCSVButton } from './ImportarRedeCSVButton';
import { ImportarEntidadeCSVButton } from './ImportarEntidadeCSVButton';
import { ExportarRedeCSVButton } from './ExportarRedeCSVButton';
import { ExportarEntidadeCSVButton } from './ExportarEntidadeCSVButton';
import { NovoFranqueadoModal } from './NovoFranqueadoModal';
import { NovoRegistroToolbarButton } from './NovoRegistroToolbarButton';
import {
  importarRedeLoteadoresCSV,
  atualizarRedeLoteadoresCSV,
  importarCondominiosCSV,
  atualizarCondominiosCSV,
  importarCadastrosEmpresasCSV,
  atualizarCadastrosEmpresasCSV,
  importarMoniCapitalCadastrosCSV,
  atualizarMoniCapitalCadastrosCSV,
} from './rede-tabelas-csv-actions';
import {
  csvCadastrosEmpresas,
  csvCondominios,
  csvMoniCapitalCadastros,
  csvRedeLoteadores,
} from '@/lib/rede-tabelas-csv-export';
import { NovoCadastroMoniCapitalModal } from './NovoCadastroMoniCapitalModal';

type TabId = 'visao' | 'pipeline' | 'analises' | 'franqueados' | 'loteadores' | 'empresas' | 'moni-capital' | 'condominios';

const BASE_PATH = '/rede-franqueados';

/** Alias legado → id real da aba. */
const TAB_ALIASES: Record<string, TabId> = {
  cadastro: 'empresas',
};

const TAB_VISAO: { id: TabId; label: string } = { id: 'visao', label: 'Visão geral' };
const TAB_PIPELINE: { id: TabId; label: string } = { id: 'pipeline', label: 'Pipeline da rede' };
const TAB_ANALISES: { id: TabId; label: string } = { id: 'analises', label: 'Análises' };
const TAB_FRANQ: { id: TabId; label: string } = { id: 'franqueados', label: 'Rede de Franqueados' };
const TAB_LOTE: { id: TabId; label: string } = { id: 'loteadores', label: 'Rede de Loteadores' };
const TAB_EMP: { id: TabId; label: string } = { id: 'empresas', label: 'Cadastros de Empresas' };
const TAB_MC: { id: TabId; label: string } = { id: 'moni-capital', label: 'Cadastros Moní Capital' };
const TAB_COND: { id: TabId; label: string } = { id: 'condominios', label: 'Condomínios' };

type Props = {
  rows: RedeFranqueadoRowDb[];
  loteadoresRows: RedeLoteadorRow[] | null;
  showStaffTabs: boolean;
  empresasRows: FranqueadoEmpresaRow[] | null;
  spesRows?: FranqueadoSpeRow[];
  empresasLoadError: boolean;
  spesLoadError?: boolean;
  moniCapitalRows: MoniCapitalCadastroRow[] | null;
  moniCapitalLoadError: boolean;
  condominiosRows: CondominioRow[] | null;
  showCondominiosTab: boolean;
  canManageCondominios: boolean;
  canManageFranqueados: boolean;
  maskSensitiveColumns: boolean;
  showDashboard: boolean;
};

export function RedeFranqueadosPageTabs({
  rows,
  loteadoresRows,
  showStaffTabs,
  empresasRows,
  spesRows = [],
  empresasLoadError,
  spesLoadError = false,
  moniCapitalRows,
  moniCapitalLoadError,
  condominiosRows,
  showCondominiosTab,
  canManageCondominios,
  canManageFranqueados,
  maskSensitiveColumns,
  showDashboard,
}: Props) {
  const showPipelineTab = showStaffTabs;
  const showAnalisesTab = showStaffTabs;

  const tabs = [
    ...(showDashboard ? [TAB_VISAO] : []),
    ...(showPipelineTab ? [TAB_PIPELINE] : []),
    ...(showAnalisesTab ? [TAB_ANALISES] : []),
    TAB_FRANQ,
    ...(showStaffTabs ? [TAB_LOTE, TAB_EMP, TAB_MC] : []),
    ...(showCondominiosTab ? [TAB_COND] : []),
  ];

  const defaultTab: TabId = showDashboard ? 'visao' : 'franqueados';
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loteadorCreateTick, setLoteadorCreateTick] = useState(0);
  const [condominioCreateTick, setCondominioCreateTick] = useState(0);

  const linhasEmpresasExport = useMemo(() => {
    const base = buildCadastrosEmpresasLinhas(rows, empresasRows ?? []);
    return buildCadastrosEmpresasLinhasComSpe(rows, base, spesRows);
  }, [rows, empresasRows, spesRows]);

  const tabFromUrl = searchParams.get('tab');
  const tabCandidate = tabFromUrl ? (TAB_ALIASES[tabFromUrl] ?? tabFromUrl) : null;
  const resolvedTab: TabId =
    tabCandidate && tabs.some((t) => t.id === tabCandidate)
      ? (tabCandidate as TabId)
      : defaultTab;

  const pipelineTabAtivo = resolvedTab === 'pipeline' || resolvedTab === 'analises';
  const { dataset: pipelineDataset, loading: pipelineLoading, error: pipelineError } = usePipelineDatasetLazy({
    mode: 'franqueadora',
    enabled: showStaffTabs && pipelineTabAtivo,
  });

  function handleTabClick(tabId: TabId) {
    const params = new URLSearchParams(searchParams.toString());
    if (tabId === defaultTab) {
      params.delete('tab');
    } else {
      params.set('tab', tabId);
    }
    const q = params.toString();
    router.replace(q ? `${BASE_PATH}?${q}` : BASE_PATH);
  }

  return (
    <>
      <div
        className="mt-6"
        style={{ borderBottom: '0.5px solid var(--moni-border-default, #e8e2da)' }}
      >
        <nav className="-mb-px flex flex-wrap gap-2" role="tablist" aria-label="Seções da rede">
          {tabs.map((tab) => {
            const isActive = resolvedTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleTabClick(tab.id)}
                className="relative px-4 py-3 text-sm font-medium transition-colors hover:bg-stone-50/80"
                style={{
                  color: isActive ? 'var(--moni-navy-800, #0c2633)' : 'var(--moni-text-tertiary, #78716c)',
                }}
              >
                {tab.label}
                {isActive ? (
                  <span
                    className="absolute bottom-0 left-0 right-0 rounded-t-[1px]"
                    style={{ height: '3px', background: 'var(--moni-green-800, #0c2633)' }}
                  />
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mt-8" role="tabpanel">
        {resolvedTab === 'visao' && showDashboard ? <RedeDashboard rows={rows} /> : null}

        {resolvedTab === 'pipeline' && showPipelineTab ? (
          <section className="space-y-4">
            <div>
              <h2
                className="text-xl font-semibold tracking-tight"
                style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-display)' }}
              >
                Pipeline da rede
              </h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
                Cards ativos em todos os funis, consolidados por unidade de franquia.
              </p>
            </div>
            {pipelineLoading ? (
              <PipelineDatasetLoading />
            ) : pipelineError ? (
              <p className="text-sm" style={{ color: 'var(--moni-status-overdue-text)' }}>
                {pipelineError}
              </p>
            ) : pipelineDataset ? (
              <PipelineCardsView mode="rede" dataset={pipelineDataset} defaultGroupBy="franquia" />
            ) : null}
          </section>
        ) : null}

        {resolvedTab === 'analises' && showAnalisesTab ? (
          <section className="space-y-4">
            <div>
              <h2
                className="text-xl font-semibold tracking-tight"
                style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-display)' }}
              >
                Análises
              </h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
                Travamentos, gargalos de fase, benchmark por unidade, conversão e Sirene.
              </p>
            </div>
            {pipelineLoading ? (
              <PipelineDatasetLoading label="Carregando análises…" />
            ) : pipelineError ? (
              <p className="text-sm" style={{ color: 'var(--moni-status-overdue-text)' }}>
                {pipelineError}
              </p>
            ) : pipelineDataset ? (
              <PipelineAnalisesView dataset={pipelineDataset} />
            ) : null}
          </section>
        ) : null}

        {resolvedTab === 'franqueados' ? (
          <section className="space-y-4">
            <RedeFranqueadosTabelaComBusca
              rows={rows}
              canEditRows={canManageFranqueados}
              maskSensitiveColumns={maskSensitiveColumns}
            >
              {canManageFranqueados ? (
                <>
                  <ImportarRedeCSVButton />
                  <NovoFranqueadoModal />
                </>
              ) : null}
              <ExportarRedeCSVButton rows={rows} maskSensitiveColumns={maskSensitiveColumns} />
            </RedeFranqueadosTabelaComBusca>
          </section>
        ) : null}

        {resolvedTab === 'loteadores' && showStaffTabs ? (
          <section className="space-y-4">
            {loteadoresRows === null ? (
              <p className="text-sm text-red-600">
                Erro ao carregar loteadores. Confira se a migration 207 foi aplicada no Supabase.
              </p>
            ) : (
              <RedeLoteadoresTabelaComBusca
                rows={loteadoresRows}
                solicitarCriacao={loteadorCreateTick}
              >
                <ImportarEntidadeCSVButton
                  templateHref="/templates/rede-loteadores-template.csv"
                  importar={importarRedeLoteadoresCSV}
                  atualizar={atualizarRedeLoteadoresCSV}
                  tituloImportar="Adiciona loteadores novos"
                  tituloAtualizar="Atualiza pelo id, CNPJ ou nome; células vazias não apagam dados"
                />
                <NovoRegistroToolbarButton
                  label="Novo Loteador"
                  onClick={() => setLoteadorCreateTick((n) => n + 1)}
                />
                <ExportarEntidadeCSVButton
                  filenamePrefix="rede-loteadores"
                  disabled={loteadoresRows.length === 0}
                  gerarCsv={() => csvRedeLoteadores(loteadoresRows)}
                />
              </RedeLoteadoresTabelaComBusca>
            )}
          </section>
        ) : null}

        {resolvedTab === 'empresas' && showStaffTabs ? (
          <section className="space-y-4">
            <CadastrosEmpresasTabelaComBusca
              redeRows={rows}
              empresasRows={empresasRows ?? []}
              spesRows={spesRows}
              empresasLoadError={empresasLoadError}
              spesLoadError={spesLoadError}
            >
              <ImportarEntidadeCSVButton
                templateHref="/templates/cadastros-empresas-template.csv"
                importar={importarCadastrosEmpresasCSV}
                atualizar={atualizarCadastrosEmpresasCSV}
                tituloImportar="Importa/atualiza incorporadora e gestora pelo Nº de Franquia"
                tituloAtualizar="Atualiza pelo Nº de Franquia; células vazias não apagam dados"
              />
              <NovoFranqueadoModal />
              <ExportarEntidadeCSVButton
                filenamePrefix="cadastros-empresas"
                disabled={linhasEmpresasExport.length === 0}
                gerarCsv={() => csvCadastrosEmpresas(linhasEmpresasExport)}
              />
            </CadastrosEmpresasTabelaComBusca>
          </section>
        ) : null}

        {resolvedTab === 'moni-capital' && showStaffTabs ? (
          <section className="space-y-4">
            <CadastrosMoniCapitalTabelaComBusca
              rows={moniCapitalRows ?? []}
              loadError={moniCapitalLoadError}
            >
              <ImportarEntidadeCSVButton
                templateHref="/templates/moni-capital-cadastros-template.csv"
                importar={importarMoniCapitalCadastrosCSV}
                atualizar={atualizarMoniCapitalCadastrosCSV}
                tituloImportar="Importa cadastros novos (cria card Funding por linha)"
                tituloAtualizar="Atualiza pelo Nº Cadastro; células vazias não apagam dados"
              />
              <NovoCadastroMoniCapitalModal />
              <ExportarEntidadeCSVButton
                filenamePrefix="moni-capital-cadastros"
                disabled={(moniCapitalRows ?? []).length === 0}
                gerarCsv={() => csvMoniCapitalCadastros(moniCapitalRows ?? [])}
              />
            </CadastrosMoniCapitalTabelaComBusca>
          </section>
        ) : null}

        {resolvedTab === 'condominios' && showCondominiosTab ? (
          <section className="space-y-4">
            {condominiosRows === null ? (
              <p className="text-sm text-red-600">
                Erro ao carregar condomínios. Confira se a migration 208 foi aplicada no Supabase.
              </p>
            ) : (
              <CondominiosTabelaComBusca
                rows={condominiosRows}
                canEdit={canManageCondominios}
                solicitarCriacao={condominioCreateTick}
              >
                {canManageCondominios ? (
                  <>
                    <ImportarEntidadeCSVButton
                      templateHref="/templates/condominios-template.csv"
                      importar={importarCondominiosCSV}
                      atualizar={atualizarCondominiosCSV}
                      tituloImportar="Adiciona condomínios novos"
                      tituloAtualizar="Atualiza pelo id ou nome; células vazias não apagam dados"
                    />
                    <NovoRegistroToolbarButton
                      label="Novo Condomínio"
                      onClick={() => setCondominioCreateTick((n) => n + 1)}
                    />
                  </>
                ) : null}
                <ExportarEntidadeCSVButton
                  filenamePrefix="condominios"
                  disabled={condominiosRows.length === 0}
                  gerarCsv={() => csvCondominios(condominiosRows)}
                />
              </CondominiosTabelaComBusca>
            )}
          </section>
        ) : null}
      </div>
    </>
  );
}
