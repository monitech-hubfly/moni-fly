/** Linha de negociação em Dados do Negócio (condição · valor · data de pagamento). */
export type NegociacaoLinha = {
  condicao: string;
  valor: string;
  dataPagamento: string;
};

export type NegociacaoLinhaDb = {
  condicao: string;
  valor: string;
  data_pagamento: string;
};

export type NegociacaoLinhaDraft = NegociacaoLinha & { id: string };

function newRowId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `neg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function criarNegociacaoLinhaDraftVazia(): NegociacaoLinhaDraft {
  return { id: newRowId(), condicao: '', valor: '', dataPagamento: '' };
}

export function negociacaoLinhasDraftPadrao(): NegociacaoLinhaDraft[] {
  return [criarNegociacaoLinhaDraftVazia()];
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
    if (!condicao && !valor && !dataPagamento) continue;
    out.push({ condicao, valor, dataPagamento });
  }
  return out;
}

export function negociacaoLinhasDraftFromLinhas(linhas: NegociacaoLinha[]): NegociacaoLinhaDraft[] {
  if (linhas.length === 0) return negociacaoLinhasDraftPadrao();
  return linhas.map((l) => ({ ...l, id: newRowId() }));
}

export function negociacaoLinhasToDb(linhas: NegociacaoLinhaDraft[]): NegociacaoLinhaDb[] | null {
  const out: NegociacaoLinhaDb[] = [];
  for (const l of linhas) {
    const condicao = l.condicao.trim();
    const valor = l.valor.trim();
    const data_pagamento = l.dataPagamento.trim().slice(0, 10);
    if (!condicao && !valor && !data_pagamento) continue;
    out.push({ condicao, valor, data_pagamento });
  }
  return out.length > 0 ? out : null;
}

export function negociacaoLinhaTemConteudo(l: Pick<NegociacaoLinha, 'condicao' | 'valor' | 'dataPagamento'>): boolean {
  return Boolean(l.condicao.trim() || l.valor.trim() || l.dataPagamento.trim());
}
