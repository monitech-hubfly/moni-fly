import type { TrancheVinculoListItem } from '@/lib/operacoes/tranche-vinculos-service';

export type ListarTrancheVinculosClientResult =
  | { ok: true; items: TrancheVinculoListItem[]; temPrimeiroCardCreditoObra: boolean }
  | { ok: false; error: string };

export type AbrirTrancheVinculoClientResult =
  | { ok: true; creditoObraCardId?: string }
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

function asListResult(data: unknown): ListarTrancheVinculosClientResult {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Resposta inválida ao listar vínculos.' };
  }
  const obj = data as Record<string, unknown>;
  if (obj.ok === true && Array.isArray(obj.items)) {
    return {
      ok: true,
      items: obj.items as TrancheVinculoListItem[],
      temPrimeiroCardCreditoObra: Boolean(obj.temPrimeiroCardCreditoObra),
    };
  }
  return {
    ok: false,
    error: typeof obj.error === 'string' && obj.error.trim() ? obj.error : 'Não foi possível listar vínculos.',
  };
}

function asAbrirResult(data: unknown): AbrirTrancheVinculoClientResult {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Resposta inválida ao abrir tranche.' };
  }
  const obj = data as Record<string, unknown>;
  if (obj.ok === true) {
    return {
      ok: true,
      creditoObraCardId:
        typeof obj.creditoObraCardId === 'string' && obj.creditoObraCardId.trim()
          ? obj.creditoObraCardId.trim()
          : undefined,
    };
  }
  return {
    ok: false,
    error: typeof obj.error === 'string' && obj.error.trim() ? obj.error : 'Não foi possível abrir a tranche.',
  };
}

/** Lista vínculos via API JSON (sem flight RSC / digest). */
export async function listarTrancheVinculosClient(
  operacoesCardId: string,
): Promise<ListarTrancheVinculosClientResult> {
  const cid = String(operacoesCardId ?? '').trim();
  if (!cid) return { ok: false, error: 'Card inválido.' };

  const res = await fetch(
    `/api/operacoes/tranche-vinculos?operacoesCardId=${encodeURIComponent(cid)}`,
    { method: 'GET', cache: 'no-store', credentials: 'same-origin' },
  );
  const data = await parseJsonSafe(res);
  return asListResult(data);
}

/** Abre tranche via API JSON (sem flight RSC / digest). */
export async function abrirTrancheVinculoClient(input: {
  operacoesCardId: string;
  trancheIndex: number;
  basePath?: string;
}): Promise<AbrirTrancheVinculoClientResult> {
  const res = await fetch('/api/operacoes/tranche-vinculos', {
    method: 'POST',
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      operacoesCardId: input.operacoesCardId,
      trancheIndex: input.trancheIndex,
      basePath: input.basePath,
    }),
  });
  const data = await parseJsonSafe(res);
  return asAbrirResult(data);
}
