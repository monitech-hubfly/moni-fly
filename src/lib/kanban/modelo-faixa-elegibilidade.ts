/**
 * Elegibilidade de modelos Moní por faixa do mapa de competidores.
 * Usado na Pré Batalha e na Batalha de Casas (Etapa 5).
 */

import {
  LABEL_FAIXA_MERCADO,
  type FaixaMercado,
} from '@/lib/kanban/mapa-competidores-condominio';

export type ModeloMoniSlug =
  | 'lu'
  | 'isa'
  | 'val'
  | 'liz'
  | 'ivy'
  | 'mia'
  | 'cissa'
  | 'sol'
  | 'eva'
  | 'gal'
  | 'lena';

/** Faixas em que cada modelo pode ser ranqueado / batalhar. */
export const FAIXAS_ELEGIVEIS_POR_MODELO: Record<ModeloMoniSlug, readonly FaixaMercado[]> = {
  /** Somente faixa Entrada (segmento econômico). */
  lu: ['entrada'],
  isa: ['entrada'],
  val: ['entrada'],
  liz: ['entrada', 'intermediaria'],
  ivy: ['entrada', 'intermediaria'],
  mia: ['entrada', 'intermediaria'],
  cissa: ['entrada', 'intermediaria'],
  sol: ['entrada', 'intermediaria'],
  eva: ['premium', 'premium_plus'],
  gal: ['premium', 'premium_plus'],
  lena: ['premium_plus', 'premium_plus2', 'premium_plus3'],
};

const SLUGS_ORDENADOS = Object.keys(FAIXAS_ELEGIVEIS_POR_MODELO) as ModeloMoniSlug[];

function normNomeModelo(nome: string): string {
  return nome
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Extrai slug do catálogo (ex.: "Val/plano", "Casa Lu" → val, lu). */
export function extrairSlugModeloMoni(nome: string | null | undefined): ModeloMoniSlug | null {
  const raw = normNomeModelo(nome ?? '');
  if (!raw) return null;
  const token = raw.split(/[\s/._-]+/).find(Boolean) ?? raw;
  if (SLUGS_ORDENADOS.includes(token as ModeloMoniSlug)) {
    return token as ModeloMoniSlug;
  }
  for (const slug of SLUGS_ORDENADOS) {
    if (token.startsWith(slug) || raw.startsWith(slug)) return slug;
  }
  return null;
}

/** Modelos sem regra explícita permanecem elegíveis em todas as faixas. */
export function modeloElegivelParaFaixa(
  nomeModelo: string | null | undefined,
  faixa: FaixaMercado,
): boolean {
  const slug = extrairSlugModeloMoni(nomeModelo);
  if (!slug) return true;
  return FAIXAS_ELEGIVEIS_POR_MODELO[slug].includes(faixa);
}

export function filtrarCatalogoPorFaixaModelo<T extends { nome: string | null }>(
  catalogo: T[],
  faixa: FaixaMercado,
): T[] {
  return catalogo.filter((c) => modeloElegivelParaFaixa(c.nome, faixa));
}

export function labelFaixasElegiveisModelo(nome: string | null | undefined): string | null {
  const slug = extrairSlugModeloMoni(nome);
  if (!slug) return null;
  return FAIXAS_ELEGIVEIS_POR_MODELO[slug].map((f) => LABEL_FAIXA_MERCADO[f]).join(', ');
}
