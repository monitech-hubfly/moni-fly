import { moedaCampoValorInicial } from '@/lib/kanban/moeda-campo';

/** Linha de negociação em Dados do Negócio (condição · valor · data de pagamento). */
export type NegociacaoLinha = {
  condicao: string;
  valor: string;
  dataPagamento: string;
  /** Fase da calculadora — quando preenchido, a data vem da timeline (ignora dataPagamento). */
  faseId?: string;
};

export type NegociacaoLinhaDb = {
  condicao: string;
  valor: string;
  data_pagamento: string;
  fase_id?: string;
};

export type NegociacaoLinhaDraft = NegociacaoLinha & { id: string };

function newRowId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `neg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function criarNegociacaoLinhaDraftVazia(): NegociacaoLinhaDraft {
  return { id: newRowId(), condicao: '', valor: '', dataPagamento: '', faseId: '' };
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
    const faseId = String(o.fase_id ?? o.faseId ?? '').trim();
    if (!condicao && !valor && !dataPagamento && !faseId) continue;
    out.push({ condicao, valor, dataPagamento, ...(faseId ? { faseId } : {}) });
  }
  return out;
}

export function negociacaoLinhasDraftFromLinhas(linhas: NegociacaoLinha[]): NegociacaoLinhaDraft[] {
  if (linhas.length === 0) return negociacaoLinhasDraftPadrao();
  return linhas.map((l) => ({
    ...l,
    id: newRowId(),
    faseId: l.faseId ?? '',
    valor: moedaCampoValorInicial(l.valor),
  }));
}

export function negociacaoLinhasToDb(linhas: NegociacaoLinhaDraft[]): NegociacaoLinhaDb[] | null {
  const out: NegociacaoLinhaDb[] = [];
  for (const l of linhas) {
    const condicao = l.condicao.trim();
    const valor = l.valor.trim();
    const data_pagamento = l.dataPagamento.trim().slice(0, 10);
    const fase_id = String(l.faseId ?? '').trim();
    if (!condicao && !valor && !data_pagamento && !fase_id) continue;
    out.push({
      condicao,
      valor,
      data_pagamento,
      ...(fase_id ? { fase_id } : {}),
    });
  }
  return out.length > 0 ? out : null;
}

export function negociacaoLinhaTemConteudo(
  l: Pick<NegociacaoLinha, 'condicao' | 'valor' | 'dataPagamento' | 'faseId'>,
): boolean {
  return Boolean(l.condicao.trim() || l.valor.trim() || l.dataPagamento.trim() || String(l.faseId ?? '').trim());
}
