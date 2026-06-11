'use client';

import { useState } from 'react';
import type { RedeFranqueadoRowDb } from '@/lib/rede-franqueados';
import type { RedeLoteadorRow } from '@/lib/rede-loteadores';
import { RedeDashboard } from './RedeDashboard';
import { RedeFranqueadosTabelaComBusca } from './RedeFranqueadosTabelaComBusca';
import { RedeLoteadoresTabelaComBusca } from './RedeLoteadoresTabelaComBusca';
import { CadastrosEmpresasTabelaComBusca } from './CadastrosEmpresasTabelaComBusca';
import { CondominiosTabelaComBusca } from './CondominiosTabelaComBusca';
import type { FranqueadoEmpresaRow } from '@/lib/franqueado-empresas';
import type { FranqueadoSpeRow } from '@/lib/franqueado-spe';
import type { CondominioRow } from '@/lib/condominios';
import { CriarCardsDesdeRedeButton } from './CriarCardsDesdeRedeButton';
import { ImportarRedeCSVButton } from './ImportarRedeCSVButton';
import { ExportarRedeCSVButton } from './ExportarRedeCSVButton';
import { NovoFranqueadoModal } from './NovoFranqueadoModal';

type TabId = 'visao' | 'franqueados' | 'loteadores' | 'empresas' | 'condominios';

const TAB_VISAO: { id: TabId; label: string } = { id: 'visao', label: 'Visão geral' };
const TAB_FRANQ: { id: TabId; label: string } = { id: 'franqueados', label: 'Rede de Franqueados' };
const TAB_LOTE: { id: TabId; label: string } = { id: 'loteadores', label: 'Rede de Loteadores' };
const TAB_EMP: { id: TabId; label: string } = { id: 'empresas', label: 'Cadastros de Empresas' };
const TAB_COND: { id: TabId; label: string } = { id: 'condominios', label: 'Condomínios' };

type Props = {
  rows: RedeFranqueadoRowDb[];
  loteadoresRows: RedeLoteadorRow[] | null;
  showStaffTabs: boolean;
  empresasRows: FranqueadoEmpresaRow[] | null;
  spesRows?: FranqueadoSpeRow[];
  empresasLoadError: boolean;
  spesLoadError?: boolean;
  condominiosRows: CondominioRow[] | null;
  showCondominiosTab: boolean;
  canManageCondominios: boolean;
  canManageFranqueados: boolean;
  maskSensitiveColumns: boolean;
  linhasSemCard: number;
  linhasSemFunil: number;
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
  condominiosRows,
  showCondominiosTab,
  canManageCondominios,
  canManageFranqueados,
  maskSensitiveColumns,
  linhasSemCard,
  linhasSemFunil,
  showDashboard,
}: Props) {
  const tabs = [
    ...(showDashboard ? [TAB_VISAO] : []),
    TAB_FRANQ,
    ...(showStaffTabs ? [TAB_LOTE, TAB_EMP] : []),
    ...(showCondominiosTab ? [TAB_COND] : []),
  ];

  const defaultTab: TabId = showDashboard ? 'visao' : 'franqueados';
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);

  const resolvedTab = tabs.some((t) => t.id === activeTab) ? activeTab : defaultTab;

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
                onClick={() => setActiveTab(tab.id)}
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
        {resolvedTab === 'visao' && showDashboard ? (
          <RedeDashboard rows={rows} />
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
                  <CriarCardsDesdeRedeButton linhasSemCard={linhasSemCard} linhasSemFunil={linhasSemFunil} />
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
              <RedeLoteadoresTabelaComBusca rows={loteadoresRows} />
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
            />
          </section>
        ) : null}

        {resolvedTab === 'condominios' && showCondominiosTab ? (
          <section className="space-y-4">
            {condominiosRows === null ? (
              <p className="text-sm text-red-600">
                Erro ao carregar condomínios. Confira se a migration 208 foi aplicada no Supabase.
              </p>
            ) : (
              <CondominiosTabelaComBusca rows={condominiosRows} canEdit={canManageCondominios} />
            )}
          </section>
        ) : null}
      </div>
    </>
  );
}
