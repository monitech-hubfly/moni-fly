'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { NovoCardModal } from '@/app/funil-stepone/NovoCardModal';
import { KanbanCardModal } from './KanbanCardModal';
import type { CamposPorFaseMap, KanbanFase, KanbanNomeDisplay } from './types';

export type KanbanWrapperProps = {
  children: React.ReactNode;
  basePath: string;
  isAdmin: boolean;
  kanbanId: string;
  kanbanNome: KanbanNomeDisplay;
  fases: KanbanFase[];
  camposPorFase?: CamposPorFaseMap;
  legacyPanelHref?: string;
  cardQueryParam?: string;
  tabBloqueiaCard?: string;
  /** Usa o `NovoCardModal` do Funil quando `?novo=true`. Desligado em outros kanbans. */
  enableNovoCardModal?: boolean;
};

function KanbanWrapperInner({
  children,
  basePath,
  isAdmin,
  kanbanId,
  kanbanNome,
  fases,
  camposPorFase,
  legacyPanelHref,
  cardQueryParam = 'card',
  tabBloqueiaCard = 'painel',
  enableNovoCardModal = false,
}: KanbanWrapperProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab');
  /** Prioriza o param configurado; aceita `card` / `kanbanCard` como fallback (links antigos ou páginas mistas). */
  const cardId =
    searchParams.get(cardQueryParam) ||
    (cardQueryParam !== 'card' ? searchParams.get('card') : null) ||
    (cardQueryParam !== 'kanbanCard' ? searchParams.get('kanbanCard') : null);
  const origemParam = searchParams.get('origem');
  const cardOrigem: 'legado' | 'nativo' = origemParam === 'legado' ? 'legado' : 'nativo';
  const novoAberto = tab === tabBloqueiaCard ? false : searchParams.get('novo') === 'true';

  const fecharParaBase = () => {
    router.push(basePath);
  };

  return (
    <>
      {children}
      {cardId ? (
        <KanbanCardModal
          cardId={cardId}
          kanbanNome={kanbanNome}
          onClose={fecharParaBase}
          fases={fases}
          isAdmin={isAdmin}
          basePath={basePath}
          legacyPanelHref={legacyPanelHref}
          camposPorFase={camposPorFase}
          origem={cardOrigem}
        />
      ) : null}
      {enableNovoCardModal && novoAberto ? (
        <NovoCardModal kanbanId={kanbanId} onClose={fecharParaBase} isAdmin={isAdmin} />
      ) : null}
    </>
  );
}

/** Controle de modal por URL (`?card=` e opcionalmente `?novo=true`). Envolva layout + abas do kanban. */
export function KanbanWrapper(props: KanbanWrapperProps) {
  return (
    <Suspense fallback={props.children}>
      <KanbanWrapperInner {...props} />
    </Suspense>
  );
}
