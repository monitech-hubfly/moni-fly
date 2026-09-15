/** Estado local da sessão: o accordion IMOB não espera o refetch do Server Action. */

export const SIMULADOR_CARD_UI_EVENT = 'moni-simulador-card-ui';

type OfertasMap = Record<string, string>;

const templatePorCard = new Set<string>();
const ofertasPorCard = new Map<string, OfertasMap>();

function keyTemplate(cardId: string): string {
  return `moni.simulador.template.${cardId}`;
}

function keyOfertas(cardId: string): string {
  return `moni.simulador.ofertas.${cardId}`;
}

function emit(cardId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SIMULADOR_CARD_UI_EVENT, { detail: { cardId } }));
}

function hidratar(cardId: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (sessionStorage.getItem(keyTemplate(cardId)) === '1') templatePorCard.add(cardId);
    const raw = sessionStorage.getItem(keyOfertas(cardId));
    if (!raw) return;
    const parsed = JSON.parse(raw) as OfertasMap;
    if (!parsed || typeof parsed !== 'object') return;
    ofertasPorCard.set(cardId, { ...(ofertasPorCard.get(cardId) ?? {}), ...parsed });
  } catch {
    /* ignore */
  }
}

export function marcarSimuladorTemplateSalvo(cardId: string): void {
  const id = String(cardId ?? '').trim();
  if (!id) return;
  templatePorCard.add(id);
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(keyTemplate(id), '1');
    } catch {
      /* ignore */
    }
  }
  emit(id);
}

export function marcarSimuladorOfertaVinculada(
  cardId: string,
  empreendimentoId: string,
  ofertaId: string,
): void {
  const cid = String(cardId ?? '').trim();
  const eid = String(empreendimentoId ?? '').trim();
  const oid = String(ofertaId ?? '').trim();
  if (!cid || !eid || !oid) return;
  const atual = { ...(ofertasPorCard.get(cid) ?? {}), [eid]: oid };
  ofertasPorCard.set(cid, atual);
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(keyOfertas(cid), JSON.stringify(atual));
    } catch {
      /* ignore */
    }
  }
  emit(cid);
}

export function simuladorTemplateMarcadoNoCliente(cardId: string): boolean {
  const id = String(cardId ?? '').trim();
  if (!id) return false;
  hidratar(id);
  return templatePorCard.has(id);
}

export function simuladorOfertasMarcadasNoCliente(cardId: string): OfertasMap {
  const id = String(cardId ?? '').trim();
  if (!id) return {};
  hidratar(id);
  return { ...(ofertasPorCard.get(id) ?? {}) };
}

export function aplicarOfertasMarcadasNoCliente<T extends { id: string; simulacao_pagamento_id: string }>(
  cardId: string,
  itens: T[],
): T[] {
  const map = simuladorOfertasMarcadasNoCliente(cardId);
  if (Object.keys(map).length === 0) return itens;
  return itens.map((it) => {
    const local = map[it.id];
    if (!local) return it;
    const atual = String(it.simulacao_pagamento_id ?? '').trim();
    if (atual) return it;
    return { ...it, simulacao_pagamento_id: local };
  });
}

export function subscribeSimuladorCardUi(cardId: string, onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (ev: Event) => {
    const id = String((ev as CustomEvent<{ cardId?: string }>).detail?.cardId ?? '');
    if (id && id !== cardId) return;
    onChange();
  };
  window.addEventListener(SIMULADOR_CARD_UI_EVENT, handler);
  return () => window.removeEventListener(SIMULADOR_CARD_UI_EVENT, handler);
}
