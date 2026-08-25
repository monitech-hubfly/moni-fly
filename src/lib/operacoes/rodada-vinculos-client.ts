import type { RodadaVinculoListItem } from '@/lib/operacoes/rodada-vinculos-service';

export type ListarRodadaVinculosClientResult =
  | { ok: true; items: RodadaVinculoListItem[] }
  | { ok: false; error: string };

export type AbrirRodadaVinculoClientResult =
  | { ok: true; cardId?: string }
  | { ok: false; error: string };

async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function asListResult(data: unknown): ListarRodadaVinculosClientResult {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Resposta inválida ao listar vínculos de rodada.' };
  }
  const obj = data as Record<string, unknown>;
  if (obj.ok === true && Array.isArray(obj.items)) {
    return {
      ok: true,
      items: obj.items as RodadaVinculoListItem[],
    };
  }
  return {
    ok: false,
    error:
      typeof obj.error === 'string' && obj.error.trim()
        ? obj.error
        : 'Não foi possível listar vínculos de rodada.',
  };
}

function asAbrirResult(data: unknown): AbrirRodadaVinculoClientResult {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Resposta inválida ao abrir rodada.' };
  }
  const obj = data as Record<string, unknown>;
  if (obj.ok === true) {
    return {
      ok: true,
      cardId:
        typeof obj.cardId === 'string' && obj.cardId.trim() ? obj.cardId.trim() : undefined,
    };
  }
  return {
    ok: false,
    error:
      typeof obj.error === 'string' && obj.error.trim()
        ? obj.error
        : 'Não foi possível abrir a rodada.',
  };
}

/** Lista vínculos via API JSON (sem flight RSC / digest). */
export async function fetchRodadaVinculos(cardId: string): Promise<ListarRodadaVinculosClientResult> {
  const cid = String(cardId ?? '').trim();
  if (!cid) return { ok: false, error: 'Card inválido.' };

  const res = await fetch(`/api/operacoes/rodada-vinculos?cardId=${encodeURIComponent(cid)}`, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'same-origin',
  });
  const data = await parseJsonSafe(res);
  return asListResult(data);
}

/** Abre rodada via API JSON (sem flight RSC / digest). */
export async function abrirRodadaVinculoClient(
  cardId: string,
  rodadaIndex: number,
): Promise<AbrirRodadaVinculoClientResult> {
  const res = await fetch('/api/operacoes/rodada-vinculos', {
    method: 'POST',
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cardId,
      rodadaIndex,
    }),
  });
  const data = await parseJsonSafe(res);
  return asAbrirResult(data);
}
