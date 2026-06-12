'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  PainelKanbanTabs,
  type PainelKanbanTabsVariant,
} from '@/app/steps-viabilidade/PainelKanbanTabs';
import { NovoCardMonINCModal } from './NovoCardMonINCModal';

type KanbanTabsProps = {
  basePath?: string;
  tabsVariant?: PainelKanbanTabsVariant;
  kanbanId: string;
  isAdmin: boolean;
  /** `kanban_fases.id` da fase «Primeiro Contato» (`primeiro_contato_moni_inc`). */
  primeiraFaseContatoId: string | null;
};

/** Abas Kanban / Painel + modal simplificado `?novo=true` (substitui o NovoCardModal do Step One). */
export function KanbanTabs({
  basePath = '/funil-moni-inc',
  tabsVariant = 'stepone',
  kanbanId,
  isAdmin,
  primeiraFaseContatoId,
}: KanbanTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabPainel = searchParams.get('tab') === 'painel';
  const novoAberto = !tabPainel && searchParams.get('novo') === 'true';

  const fecharNovo = useCallback(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete('novo');
    const q = p.toString();
    router.push(q ? `${basePath}?${q}` : basePath);
  }, [router, searchParams, basePath]);

  return (
    <>
      <PainelKanbanTabs basePath={basePath} variant={tabsVariant} />
      {novoAberto && primeiraFaseContatoId ? (
        <NovoCardMonINCModal
          faseId={primeiraFaseContatoId}
          kanbanId={kanbanId}
          isAdmin={isAdmin}
          basePath={basePath}
          onClose={fecharNovo}
        />
      ) : null}
    </>
  );
}
