export type ProximaAtividadeItemResult = {
  id: string;
  descricao: string;
  prazo: string | null;
};

export type ProximaAtividadeApiResult =
  | {
      ok: true;
      item?: ProximaAtividadeItemResult;
      items?: ProximaAtividadeItemResult[];
      proxima_atividade?: string | null;
      prazo_atividade?: string | null;
    }
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

function asResult(data: unknown): ProximaAtividadeApiResult {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Resposta inválida ao salvar próxima atividade.' };
  }
  const obj = data as Record<string, unknown>;
  if (obj.ok === true) {
    return data as ProximaAtividadeApiResult;
  }
  return {
    ok: false,
    error:
      typeof obj.error === 'string' && obj.error.trim()
        ? obj.error
        : 'Não foi possível salvar a próxima atividade.',
  };
}

/** Persistência via API JSON — evita refresh RSC automático das server actions. */
export async function listarProximaAtividadeAbertasClient(
  cardId: string,
): Promise<ProximaAtividadeItemResult[]> {
  const res = await fetch('/api/kanban/proxima-atividade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ action: 'listar', cardId }),
  });
  const data = asResult(await parseJsonSafe(res));
  if (!data.ok || !Array.isArray(data.items)) return [];
  return data.items;
}

export async function adicionarProximaAtividadeClient(input: {
  cardId: string;
  descricao: string;
  prazo: string | null;
  basePath: string;
}): Promise<ProximaAtividadeApiResult> {
  const res = await fetch('/api/kanban/proxima-atividade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ action: 'adicionar', ...input }),
  });
  return asResult(await parseJsonSafe(res));
}

export async function concluirProximaAtividadeClient(input: {
  itemId: string;
  cardId: string;
  basePath: string;
}): Promise<ProximaAtividadeApiResult> {
  const res = await fetch('/api/kanban/proxima-atividade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ action: 'concluir', ...input }),
  });
  return asResult(await parseJsonSafe(res));
}

export async function limparProximaAtividadeLegadoClient(input: {
  cardId: string;
  basePath: string;
}): Promise<ProximaAtividadeApiResult> {
  const res = await fetch('/api/kanban/proxima-atividade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ action: 'limpar', ...input }),
  });
  return asResult(await parseJsonSafe(res));
}
