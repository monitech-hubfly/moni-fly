export type UrlModalState = {
  cardId: string | null;
  deepLinkInteracaoId: string | null;
  deepLinkTopicoId: string | null;
  cardOrigem: 'legado' | 'nativo';
  novoAberto: boolean;
};

export const URL_MODAL_FECHADO: UrlModalState = {
  cardId: null,
  deepLinkInteracaoId: null,
  deepLinkTopicoId: null,
  cardOrigem: 'nativo',
  novoAberto: false,
};

type SearchParamsLike = { get: (key: string) => string | null };

export function lerCardIdDaUrl(sp: SearchParamsLike, cardQueryParam: string): string | null {
  return (
    sp.get(cardQueryParam) ||
    (cardQueryParam !== 'card' ? sp.get('card') : null) ||
    (cardQueryParam !== 'kanbanCard' ? sp.get('kanbanCard') : null)
  );
}

export function estadoModalDaSearchParams(
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

function primeiroQuery(v: string | string[] | undefined): string | null {
  if (v === undefined) return null;
  const s = Array.isArray(v) ? v[0] : v;
  const t = String(s ?? '').trim();
  return t || null;
}

/** Lê `?card=` / `?novo=` dos `searchParams` de uma page RSC — SSR e client batem. */
export function estadoModalDePageSearchParams(
  searchParams: { [key: string]: string | string[] | undefined } | undefined,
  cardQueryParam = 'card',
  tabBloqueiaCard = 'painel',
): UrlModalState {
  if (!searchParams) return URL_MODAL_FECHADO;
  return estadoModalDaSearchParams(
    { get: (key) => primeiroQuery(searchParams[key]) },
    cardQueryParam,
    tabBloqueiaCard,
  );
}

export function estadoModalDoWindow(cardQueryParam: string, tabBloqueiaCard: string): UrlModalState {
  if (typeof window === 'undefined') return URL_MODAL_FECHADO;
  return estadoModalDaSearchParams(
    new URLSearchParams(window.location.search),
    cardQueryParam,
    tabBloqueiaCard,
  );
}

export function urlStateIgual(a: UrlModalState, b: UrlModalState): boolean {
  return (
    a.cardId === b.cardId &&
    a.deepLinkInteracaoId === b.deepLinkInteracaoId &&
    a.deepLinkTopicoId === b.deepLinkTopicoId &&
    a.cardOrigem === b.cardOrigem &&
    a.novoAberto === b.novoAberto
  );
}
