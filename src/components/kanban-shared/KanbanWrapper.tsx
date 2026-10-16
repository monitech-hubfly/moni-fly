'use client';

import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, createContext, useCallback, useContext, useEffect, useState } from 'react';
import { NovoCardModal } from '@/app/funil-stepone/NovoCardModal';
import { NovoCardFundingModal } from '@/app/funil-funding/NovoCardFundingModal';
import { NovoCardMarketingModal } from '@/app/marketing/NovoCardMarketingModal';
import { NovoCardMoniCareModal } from '@/app/manutencoes/NovoCardMoniCareModal';
import { NovoCardVCLModal } from '@/components/venda-casas-loteadores/NovoCardVCLModal';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { hrefAbrirCardNaRota } from '@/lib/kanban/kanban-card-href';
import { isMarketingKanbanId } from '@/lib/kanban/funis-marketing';
import { isMoniCareKanbanId } from '@/lib/kanban/funil-moni-care';
import {
  URL_MODAL_FECHADO,
  estadoModalDoWindow,
  lerCardIdDaUrl,
  urlStateIgual,
  type UrlModalState,
} from '@/lib/kanban/kanban-url-modal-state';
import type { CamposPorFaseMap, KanbanFase, KanbanNomeDisplay } from './types';

export type { UrlModalState };

function KanbanCardModalLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="text-white">Carregando…</div>
    </div>
  );
}

/** Modal pesado — code-split. Overlay no `loading` para o drawer aparecer na hora. */
const KanbanCardModal = dynamic(
  () => import('./KanbanCardModal').then((m) => m.KanbanCardModal),
  { ssr: false, loading: KanbanCardModalLoading },
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
  /** `?card=` lido no servidor — SSR e cliente começam iguais, sem esperar hidratação. */
  initialUrlState?: UrlModalState;
};

type KanbanOpenCardFn = (cardId: string, origem?: 'legado' | 'nativo') => void;

const KanbanOpenCardContext = createContext<KanbanOpenCardFn | null>(null);

/** Abre card no modal sem esperar o RSC sincronizar `useSearchParams`. */
export function useKanbanOpenCard(): KanbanOpenCardFn | null {
  return useContext(KanbanOpenCardContext);
}

/** Reaplica `?card=` após `router.refresh()` quando o card foi aberto via `history.replaceState`. */
function restaurarCardNaBarraSeModalAberto(
  basePath: string,
  cardQueryParam: string,
  tabBloqueiaCard: string,
  cardId: string,
  cardOrigem: 'legado' | 'nativo',
): void {
  if (typeof window === 'undefined') return;
  const sp = new URLSearchParams(window.location.search);
  if (sp.get('tab') === tabBloqueiaCard) return;
  const atual = lerCardIdDaUrl(sp, cardQueryParam);
  if (atual === cardId) return;
  const href = hrefAbrirCardNaRota(
    basePath,
    cardId,
    cardQueryParam,
    cardOrigem === 'legado' ? 'legado' : undefined,
  );
  window.history.replaceState(window.history.state, '', href);
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
    // `useSearchParams` atrasa após `history.replaceState`; a barra de endereços prevalece.
    onChange(estadoModalDoWindow(cardQueryParam, tabBloqueiaCard));
  }, [searchParams, cardQueryParam, tabBloqueiaCard, onChange]);
  return null;
}

function isVCLKanbanId(id: string): boolean {
  return (
    id === KANBAN_IDS.VCL_NAO_VENDIDOS ||
    id === KANBAN_IDS.VCL_VENDIDOS ||
    id === KANBAN_IDS.VCL_SHOWROOM
  );
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
          key={urlState.cardId}
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
        ) : isMoniCareKanbanId(kanbanId) ? (
          <NovoCardMoniCareModal
            kanbanId={kanbanId}
            kanbanNome={kanbanNome}
            basePath={basePath}
            onClose={onCloseModals}
          />
        ) : isMarketingKanbanId(kanbanId) ? (
          <NovoCardMarketingModal
            kanbanId={kanbanId}
            kanbanNome={kanbanNome}
            basePath={basePath}
            onClose={onCloseModals}
          />
        ) : isVCLKanbanId(kanbanId) ? (
          <NovoCardVCLModal
            kanbanId={kanbanId}
            kanbanNome={kanbanNome}
            basePath={basePath}
            onClose={onCloseModals}
          />
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
  initialUrlState,
}: KanbanWrapperProps) {
  const router = useRouter();
  const [urlState, setUrlState] = useState<UrlModalState>(() => initialUrlState ?? URL_MODAL_FECHADO);

  useEffect(() => {
    void import('./KanbanCardModal');
  }, []);

  const onUrlChange = useCallback(
    (s: UrlModalState) => {
      setUrlState((prev) => {
        if (urlStateIgual(prev, s)) return prev;
        // Modal aberto localmente: `router.refresh()` pode strip ?card= da URL (replaceState
        // não atualiza o router interno do Next). Restaura a barra e mantém o drawer aberto.
        if (prev.cardId && !s.cardId) {
          restaurarCardNaBarraSeModalAberto(
            basePath,
            cardQueryParam,
            tabBloqueiaCard,
            prev.cardId,
            prev.cardOrigem,
          );
          const depois = estadoModalDoWindow(cardQueryParam, tabBloqueiaCard);
          if (depois.cardId === prev.cardId) return prev;
          if (depois.cardId) return depois;
        }
        if (prev.cardId && s.cardId === prev.cardId) return prev;
        return s;
      });
    },
    [basePath, cardQueryParam, tabBloqueiaCard],
  );

  /** Atualiza estado local na hora; URL via history (sem refetch RSC). */
  const openCard = useCallback<KanbanOpenCardFn>(
    (cardId, origem) => {
      const id = String(cardId ?? '').trim();
      if (!id) return;
      const cardOrigem = origem === 'legado' ? 'legado' : 'nativo';
      const href = hrefAbrirCardNaRota(basePath, id, cardQueryParam, origem);
      setUrlState((prev) => ({
        ...prev,
        cardId: id,
        cardOrigem,
        deepLinkInteracaoId: null,
        deepLinkTopicoId: null,
        novoAberto: false,
      }));
      if (typeof window !== 'undefined') {
        window.history.replaceState(window.history.state, '', href);
      }
    },
    [basePath, cardQueryParam],
  );

  useEffect(() => {
    const onPopState = () => {
      setUrlState(estadoModalDoWindow(cardQueryParam, tabBloqueiaCard));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [cardQueryParam, tabBloqueiaCard]);

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
    router.replace(basePath, { scroll: false });
  }, [basePath, router]);

  return (
    <KanbanOpenCardContext.Provider value={openCard}>
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
    </KanbanOpenCardContext.Provider>
  );
}
