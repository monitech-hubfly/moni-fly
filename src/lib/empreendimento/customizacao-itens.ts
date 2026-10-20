import type {
  ItemCustomizacaoCasa,
  ItemCustomizacaoEscolhido,
} from '@/app/empreendimento/[slug]/types';

export const LOG_JORNADA_CUSTOMIZACAO = '[JORNADA-CUSTOMIZACAO]';

export const ERRO_CUSTOMIZACAO_INDISPONIVEL =
  'Não foi possível carregar os itens de customização agora. Você pode seguir a simulação e incluir os itens depois com o seu consultor.';

function normalizarModelo(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[™®]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

function numeroOuNull(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function parseItemCustomizacaoCasa(raw: unknown): ItemCustomizacaoCasa | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = String(r.id ?? '').trim();
  const item = String(r.item ?? '').trim();
  if (!id || !item) return null;

  const valores: Record<string, number> = {};
  const brutos = r.valores_por_modelo;
  if (brutos && typeof brutos === 'object' && !Array.isArray(brutos)) {
    for (const [modelo, v] of Object.entries(brutos as Record<string, unknown>)) {
      const n = numeroOuNull(v);
      if (n != null) valores[modelo] = n;
    }
  }

  return {
    id,
    item,
    descricao: r.descricao != null && String(r.descricao).trim() ? String(r.descricao) : null,
    valor_padrao: numeroOuNull(r.valor_padrao),
    valores_por_modelo: valores,
    ordem: Number(r.ordem ?? 0) || 0,
  };
}

/**
 * Preço do item para o modelo da oferta: valor do modelo, senão valor_padrao.
 * null = item não disponível para esse modelo.
 */
export function precoItemCustomizacao(
  item: ItemCustomizacaoCasa,
  modelo: string | null | undefined,
): number | null {
  const m = String(modelo ?? '').trim();
  if (m) {
    if (item.valores_por_modelo[m] != null) return item.valores_por_modelo[m];
    const alvo = normalizarModelo(m);
    for (const [chave, v] of Object.entries(item.valores_por_modelo)) {
      if (normalizarModelo(chave) === alvo) return v;
    }
  }
  return item.valor_padrao;
}

/** Itens com preço para o modelo, na ordem da planilha. */
export function itensCustomizacaoDoModelo(
  itens: ItemCustomizacaoCasa[],
  modelo: string | null | undefined,
): Array<ItemCustomizacaoCasa & { preco: number }> {
  return itens
    .map((i) => ({ ...i, preco: precoItemCustomizacao(i, modelo) }))
    .filter((i): i is ItemCustomizacaoCasa & { preco: number } => i.preco != null);
}

export function itensCustomizacaoEscolhidos(
  itens: ItemCustomizacaoCasa[],
  modelo: string | null | undefined,
  selecionados: Set<string>,
): ItemCustomizacaoEscolhido[] {
  return itensCustomizacaoDoModelo(itens, modelo)
    .filter((i) => selecionados.has(i.id))
    .map((i) => ({ id: i.id, item: i.item, valor: i.preco }));
}

export function parseItensCustomizacaoEscolhidos(raw: unknown): ItemCustomizacaoEscolhido[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      if (!r || typeof r !== 'object') return null;
      const o = r as Record<string, unknown>;
      const id = String(o.id ?? '').trim();
      const valor = numeroOuNull(o.valor);
      if (!id || valor == null) return null;
      return { id, item: String(o.item ?? ''), valor };
    })
    .filter((i): i is ItemCustomizacaoEscolhido => i != null);
}
