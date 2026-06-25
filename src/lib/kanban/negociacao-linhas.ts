/** Linha de negociação em Dados do Negócio (condição · valor · data de pagamento). */
export type NegociacaoLinha = {
  condicao: string;
  valor: string;
  dataPagamento: string;
  /** fase:<slug> ou marco:<id> — data derivada da calculadora quando preenchido. */
  vinculoCalculadora?: string | null;
};

export type NegociacaoLinhaDb = {
  condicao: string;
  valor: string;
  data_pagamento: string;
  vinculo_calculadora?: string | null;
};

export type NegociacaoLinhaDraft = NegociacaoLinha & { id: string };

export type VinculoCalculadoraNegociacao =
  | { tipo: 'fase'; slug: string }
  | { tipo: 'marco'; marcoId: string };

function newRowId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `neg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function criarNegociacaoLinhaDraftVazia(): NegociacaoLinhaDraft {
  return { id: newRowId(), condicao: '', valor: '', dataPagamento: '', vinculoCalculadora: '' };
}

export function negociacaoLinhasDraftPadrao(): NegociacaoLinhaDraft[] {
  return [criarNegociacaoLinhaDraftVazia()];
}

export function parseVinculoCalculadoraNegociacao(
  raw: string | null | undefined,
): VinculoCalculadoraNegociacao | null {
  const v = String(raw ?? '').trim();
  if (!v) return null;
  if (v.startsWith('fase:')) {
    const slug = v.slice(5).trim();
    return slug ? { tipo: 'fase', slug } : null;
  }
  if (v.startsWith('marco:')) {
    const marcoId = v.slice(6).trim();
    return marcoId ? { tipo: 'marco', marcoId } : null;
  }
  return null;
}

export function parseNegociacaoLinhasFromDb(raw: unknown): NegociacaoLinha[] {
  if (!Array.isArray(raw)) return [];
  const out: NegociacaoLinha[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const condicao = String(o.condicao ?? '').trim();
    const valor = String(o.valor ?? '').trim();
    const dataRaw = String(o.data_pagamento ?? o.dataPagamento ?? '').trim();
    const dataPagamento = /^\d{4}-\d{2}-\d{2}/.test(dataRaw) ? dataRaw.slice(0, 10) : dataRaw;
    const vinculoCalculadora = String(o.vinculo_calculadora ?? o.vinculoCalculadora ?? '').trim();
    if (!condicao && !valor && !dataPagamento && !vinculoCalculadora) continue;
    out.push({
      condicao,
      valor,
      dataPagamento,
      vinculoCalculadora: vinculoCalculadora || null,
    });
  }
  return out;
}

export function negociacaoLinhasDraftFromLinhas(linhas: NegociacaoLinha[]): NegociacaoLinhaDraft[] {
  if (linhas.length === 0) return negociacaoLinhasDraftPadrao();
  return linhas.map((l) => ({
    ...l,
    id: newRowId(),
    vinculoCalculadora: l.vinculoCalculadora ?? '',
  }));
}

export function negociacaoLinhasToDb(linhas: NegociacaoLinhaDraft[]): NegociacaoLinhaDb[] | null {
  const out: NegociacaoLinhaDb[] = [];
  for (const l of linhas) {
    const condicao = l.condicao.trim();
    const valor = l.valor.trim();
    const vinculo = String(l.vinculoCalculadora ?? '').trim();
    const data_pagamento = vinculo ? '' : l.dataPagamento.trim().slice(0, 10);
    if (!condicao && !valor && !data_pagamento && !vinculo) continue;
    out.push({
      condicao,
      valor,
      data_pagamento,
      vinculo_calculadora: vinculo || null,
    });
  }
  return out.length > 0 ? out : null;
}

export function negociacaoLinhaTemConteudo(
  l: Pick<NegociacaoLinha, 'condicao' | 'valor' | 'dataPagamento' | 'vinculoCalculadora'>,
): boolean {
  return Boolean(
    l.condicao.trim() ||
      l.valor.trim() ||
      l.dataPagamento.trim() ||
      String(l.vinculoCalculadora ?? '').trim(),
  );
}
