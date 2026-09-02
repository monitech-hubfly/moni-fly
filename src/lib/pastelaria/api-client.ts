import type {
  CreatePastelariaCardBody,
  PastelariaCardRow,
  PastelariaColuna,
  PastelariaHorasRow,
  ReclassificarPastelariaCardBody,
  ReclassificarPastelariaCardResponse,
  UpdatePastelariaCardBody,
  UpsertPastelariaHorasBody,
} from '@/lib/pastelaria/types';

export type PastelariaCardView = PastelariaCardRow & {
  area_nome: string | null;
  responsavel_pessoa_nome: string | null;
  responsavel_display_nome: string | null;
};

export type AreaPessoaOption = { id: string; nome: string };

export class PastelariaApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'PastelariaApiError';
    this.status = status;
  }
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new PastelariaApiError(data.error ?? 'Erro na requisição.', res.status);
  }
  return data as T;
}

export function cardsListUrl(areaId: string | null): string {
  if (!areaId) return '/api/pastelaria/cards';
  return `/api/pastelaria/cards?area_id=${encodeURIComponent(areaId)}`;
}

export async function fetchCards(areaId: string | null): Promise<PastelariaCardView[]> {
  const data = await apiJson<{ cards: PastelariaCardView[] }>(cardsListUrl(areaId));
  return data.cards ?? [];
}

export async function createCard(body: CreatePastelariaCardBody): Promise<PastelariaCardView> {
  const data = await apiJson<{ card: PastelariaCardView }>('/api/pastelaria/cards', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data.card;
}

export async function updateCard(
  id: string,
  body: UpdatePastelariaCardBody,
): Promise<PastelariaCardView> {
  const data = await apiJson<{ card: PastelariaCardView }>(`/api/pastelaria/cards/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return data.card;
}

export async function deleteCard(id: string): Promise<void> {
  await apiJson<{ ok: boolean }>(`/api/pastelaria/cards/${id}`, { method: 'DELETE' });
}

export async function aceitarCard(id: string): Promise<PastelariaCardView> {
  const data = await apiJson<{ card: PastelariaCardView }>(`/api/pastelaria/cards/${id}/aceitar`, {
    method: 'POST',
  });
  return data.card;
}

export async function reclassificarCard(
  id: string,
  body: ReclassificarPastelariaCardBody,
): Promise<ReclassificarPastelariaCardResponse> {
  return apiJson<ReclassificarPastelariaCardResponse>(
    `/api/pastelaria/cards/${id}/reclassificar`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
}

export async function fetchCardHoras(cardId: string): Promise<PastelariaHorasRow[]> {
  const data = await apiJson<{ horas: PastelariaHorasRow[] }>(
    `/api/pastelaria/cards/${cardId}/horas`,
  );
  return data.horas ?? [];
}

export async function upsertCardHoras(
  cardId: string,
  body: UpsertPastelariaHorasBody,
): Promise<PastelariaHorasRow> {
  const data = await apiJson<{ horas: PastelariaHorasRow }>(
    `/api/pastelaria/cards/${cardId}/horas`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
  return data.horas;
}

export async function fetchCardDetail(
  id: string,
): Promise<{ card: PastelariaCardView; horas: PastelariaHorasRow[] }> {
  return apiJson<{ card: PastelariaCardView; horas: PastelariaHorasRow[] }>(
    `/api/pastelaria/cards/${id}`,
  );
}

export async function fetchPastelariaAreaPessoas(areaId: string): Promise<AreaPessoaOption[]> {
  const data = await apiJson<{ pessoas: AreaPessoaOption[] }>(
    `/api/pastelaria/area-pessoas?area_id=${encodeURIComponent(areaId)}`,
  );
  return data.pessoas ?? [];
}

export async function createAreaPessoa(
  areaId: string,
  nome: string,
): Promise<AreaPessoaOption & { area_id: string }> {
  const data = await apiJson<{ pessoa: AreaPessoaOption & { area_id: string } }>(
    '/api/area-pessoas',
    {
      method: 'POST',
      body: JSON.stringify({ area_id: areaId, nome }),
    },
  );
  return data.pessoa;
}

export function formatEstimativa(valor: number, unidade: string): string {
  const n = Number(valor);
  if (!Number.isFinite(n)) return '—';
  return unidade === 'min' ? `${n} min` : `${n} h`;
}

export const COLUNA_LABEL: Record<PastelariaColuna, string> = {
  inbox: 'Direcionados p/ Tratativas',
  mapped: 'Mapeados',
  doing: 'Em Andamento',
  done: 'Concluídos',
};
