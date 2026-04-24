'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PainelKanbanTabs } from '@/app/steps-viabilidade/PainelKanbanTabs';
import { NovoCardMonINCModal } from './NovoCardMonINCModal';

const BASE = '/funil-moni-inc';

type KanbanTabsProps = {
  kanbanId: string;
  isAdmin: boolean;
  /** `kanban_fases.id` da fase «Primeiro Contato» (`primeiro_contato_moni_inc`). */
  primeiraFaseContatoId: string | null;
};

/** Abas Kanban / Painel + modal simplificado `?novo=true` (substitui o NovoCardModal do Step One). */
export function KanbanTabs({ kanbanId, isAdmin, primeiraFaseContatoId }: KanbanTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabPainel = searchParams.get('tab') === 'painel';
  const novoAberto = !tabPainel && searchParams.get('novo') === 'true';

  const fecharNovo = useCallback(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete('novo');
    const q = p.toString();
    router.push(q ? `${BASE}?${q}` : BASE);
  }, [router, searchParams]);

  return (
    <>
      <PainelKanbanTabs basePath={BASE} variant="stepone" />
      {novoAberto && primeiraFaseContatoId ? (
        <NovoCardMonINCModal
          faseId={primeiraFaseContatoId}
          kanbanId={kanbanId}
          isAdmin={isAdmin}
          onClose={fecharNovo}
        />
      ) : null}
    </>
  );
}
