'use client';

import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { NovoCardModal } from '@/app/funil-stepone/NovoCardModal';
import { NovoCardFundingModal } from '@/app/funil-funding/NovoCardFundingModal';
import type { CamposPorFaseMap, KanbanFase, KanbanNomeDisplay } from './types';

/** Modal pesado — carrega só quando há `?card=` (code-split + sem SSR). */
const KanbanCardModal = dynamic(
  () => import('./KanbanCardModal').then((m) => m.KanbanCardModal),
  { ssr: false },
);

export type KanbanWrapperProps = {
  children: React.ReactNode;
  basePath: string;
  isAdmin: boolean;
  kanbanId: string;
  kanbanNome: KanbanNomeDisplay;
  fases: KanbanFase[];
  camposPorFase?: CamposPorFaseMap;
  cardQueryParam?: string;
  tabBloqueiaCard?: string;
  /** Usa o `NovoCardModal` do Funil quando `?novo=true`. Desligado em outros kanbans. */
  enableNovoCardModal?: boolean;
};

type UrlModalState = {
  cardId: string | null;
  deepLinkInteracaoId: string | null;
  deepLinkTopicoId: string | null;
  cardOrigem: 'legado' | 'nativo';
  novoAberto: boolean;
};

type SearchParamsLike = { get: (key: string) => string | null };

function lerCardIdDaUrl(sp: SearchParamsLike, cardQueryParam: string): string | null {
  return (
    sp.get(cardQueryParam) ||
    (cardQueryParam !== 'card' ? sp.get('card') : null) ||
    (cardQueryParam !== 'kanbanCard' ? sp.get('kanbanCard') : null)
  );
}

function estadoModalDaSearchParams(
  searchParams: SearchParamsLike,
  cardQueryParam: string,
  tabBloqueiaCard: string,
): UrlModalState {
  const tab = searchParams.get('tab');
  const origemParam = searchParams.get('origem');
  return {
    cardId: lerCardIdDaUrl(searchParams, cardQueryParam),
    deepLinkInteracaoId: searchParams.get('interacao'),
    deepLinkTopicoId: searchParams.get('topico'),
    cardOrigem: origemParam === 'legado' ? 'legado' : 'nativo',
    novoAberto: tab === tabBloqueiaCard ? false : searchParams.get('novo') === 'true',
  };
}

function estadoModalDoWindow(cardQueryParam: string, tabBloqueiaCard: string): UrlModalState {
  if (typeof window === 'undefined') {
    return {
      cardId: null,
      deepLinkInteracaoId: null,
      deepLinkTopicoId: null,
      cardOrigem: 'nativo',
      novoAberto: false,
    };
  }
  return estadoModalDaSearchParams(
    new URLSearchParams(window.location.search),
    cardQueryParam,
    tabBloqueiaCard,
  );
}

function urlStateIgual(a: UrlModalState, b: UrlModalState): boolean {
  return (
    a.cardId === b.cardId &&
    a.deepLinkInteracaoId === b.deepLinkInteracaoId &&
    a.deepLinkTopicoId === b.deepLinkTopicoId &&
    a.cardOrigem === b.cardOrigem &&
    a.novoAberto === b.novoAberto
  );
}

/** Só sincroniza a URL — vive dentro do Suspense do `useSearchParams`. */
function KanbanUrlSync({
  cardQueryParam,
  tabBloqueiaCard,
  onChange,
}: {
  cardQueryParam: string;
  tabBloqueiaCard: string;
  onChange: (s: UrlModalState) => void;
}) {
  const searchParams = useSearchParams();
  useEffect(() => {
    onChange(estadoModalDaSearchParams(searchParams, cardQueryParam, tabBloqueiaCard));
  }, [searchParams, cardQueryParam, tabBloqueiaCard, onChange]);
  return null;
}

function KanbanModals({
  basePath,
  isAdmin,
  kanbanId,
  kanbanNome,
  fases,
  camposPorFase,
  enableNovoCardModal,
  urlState,
  onCloseModals,
}: {
  basePath: string;
  isAdmin: boolean;
  kanbanId: string;
  kanbanNome: KanbanNomeDisplay;
  fases: KanbanFase[];
  camposPorFase?: CamposPorFaseMap;
  enableNovoCardModal: boolean;
  urlState: UrlModalState;
  onCloseModals: () => void;
}) {
  return (
    <>
      {urlState.cardId ? (
        <KanbanCardModal
          cardId={urlState.cardId}
          kanbanNome={kanbanNome}
          onClose={onCloseModals}
          fases={fases}
          isAdmin={isAdmin}
          basePath={basePath}
          camposPorFase={camposPorFase}
          origem={urlState.cardOrigem}
          deepLinkInteracaoId={urlState.deepLinkInteracaoId}
          deepLinkTopicoId={urlState.deepLinkTopicoId}
        />
      ) : null}
      {enableNovoCardModal && urlState.novoAberto ? (
        kanbanNome === 'Funding' ? (
          <NovoCardFundingModal kanbanId={kanbanId} basePath={basePath} onClose={onCloseModals} />
        ) : (
          <NovoCardModal
            kanbanId={kanbanId}
            kanbanNome={kanbanNome}
            basePath={basePath}
            onClose={onCloseModals}
            isAdmin={isAdmin}
            showTipoOrigem={kanbanNome === 'Funil Portfólio'}
          />
        )
      ) : null}
    </>
  );
}

/**
 * Controle de modal por URL (`?card=` e opcionalmente `?novo=true`).
 * O estado do modal fica FORA do Suspense de `useSearchParams`: o fallback antigo
 * (`props.children` sem modal) desmontava o drawer a cada remount/refresh e
 * parecia “fechar → carregar → voltar”.
 */
export function KanbanWrapper({
  children,
  basePath,
  isAdmin,
  kanbanId,
  kanbanNome,
  fases,
  camposPorFase,
  cardQueryParam = 'card',
  tabBloqueiaCard = 'painel',
  enableNovoCardModal = false,
}: KanbanWrapperProps) {
  const router = useRouter();
  const [urlState, setUrlState] = useState<UrlModalState>(() =>
    estadoModalDoWindow(cardQueryParam, tabBloqueiaCard),
  );

  const onUrlChange = useCallback((s: UrlModalState) => {
    setUrlState((prev) => (urlStateIgual(prev, s) ? prev : s));
  }, []);

  /** Fecha na hora (estado local) e só depois sincroniza a URL — evita flicker se o Suspense atrasar. */
  const onCloseModals = useCallback(() => {
    setUrlState((prev) =>
      prev.cardId || prev.novoAberto
        ? {
            ...prev,
            cardId: null,
            deepLinkInteracaoId: null,
            deepLinkTopicoId: null,
            novoAberto: false,
          }
        : prev,
    );
    router.push(basePath);
  }, [basePath, router]);

  return (
    <>
      {children}
      <Suspense fallback={null}>
        <KanbanUrlSync
          cardQueryParam={cardQueryParam}
          tabBloqueiaCard={tabBloqueiaCard}
          onChange={onUrlChange}
        />
      </Suspense>
      <KanbanModals
        basePath={basePath}
        isAdmin={isAdmin}
        kanbanId={kanbanId}
        kanbanNome={kanbanNome}
        fases={fases}
        camposPorFase={camposPorFase}
        enableNovoCardModal={enableNovoCardModal}
        urlState={urlState}
        onCloseModals={onCloseModals}
      />
    </>
  );
}
