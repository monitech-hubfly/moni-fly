/**
 * Checklist / gate da fase «Aguardando Ficha» — Funil Loteadores.
 * Reusa a ficha do form externo `/loteador/[token]` (`rede_loteadores` + painel persistente).
 */

import type { RedeLoteadorFichaDraft } from '@/lib/rede-loteador-ficha-draft';

export const LOTEADORES_AGUARDANDO_FICHA_FASE_SLUG = 'aguardando_ficha_moni_inc' as const;

/**
 * Spec → chave do draft da ficha (mesmo mapeamento de `REDE_LOTEADOR_CAMPO_COMPAT`).
 * Obrigatórios mínimos para avançar de fase.
 */
export const LOTEADORES_AGUARDANDO_FICHA_CAMPOS_MINIMOS = {
  nome_condominio: 'condominio_nome',
  cidade: 'condominio_cidade',
  qtd_lotes: 'condominio_qtd_lotes',
  preco_lotes: 'condominio_preco_lotes',
  metragem_lotes: 'condominio_metragem_lotes',
  planta_cadastral: 'anexo_planta_cadastral',
} as const;

export type LoteadoresAguardandoFichaCampoMinimo =
  keyof typeof LOTEADORES_AGUARDANDO_FICHA_CAMPOS_MINIMOS;

/** Labels para UI / checklist espelhado (opcional no banco). */
export const LOTEADORES_AGUARDANDO_FICHA_CAMPOS = {
  nomeCondominio: 'nome_condominio',
  cidade: 'cidade',
  qtdLotes: 'qtd_lotes',
  precoLotes: 'preco_lotes',
  metragemLotes: 'metragem_lotes',
  plantaCadastral: 'planta_cadastral',
} as const;

export const LOTEADORES_AGUARDANDO_FICHA_CAMPOS_VISIVEIS = Object.values(
  LOTEADORES_AGUARDANDO_FICHA_CAMPOS,
);

export const LOTEADORES_AGUARDANDO_FICHA_CAMPOS_LEGADOS = [
  'ficha_recebida',
  'ficha_pendencias',
  'rede_loteador',
] as const;

export function isLoteadoresAguardandoFichaFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_AGUARDANDO_FICHA_FASE_SLUG;
}

export function isLoteadoresAguardandoFichaCampoVisivel(item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  const slug = String(item.campo_slug ?? '').trim();
  if (slug) {
    return (
      (LOTEADORES_AGUARDANDO_FICHA_CAMPOS_VISIVEIS as readonly string[]).includes(slug) ||
      (LOTEADORES_AGUARDANDO_FICHA_CAMPOS_LEGADOS as readonly string[]).includes(slug)
    );
  }
  return false;
}

export function listarPendenciasFichaMinimaLoteador(
  draft: RedeLoteadorFichaDraft | null | undefined,
): LoteadoresAguardandoFichaCampoMinimo[] {
  if (!draft) return Object.keys(LOTEADORES_AGUARDANDO_FICHA_CAMPOS_MINIMOS) as LoteadoresAguardandoFichaCampoMinimo[];
  const pendentes: LoteadoresAguardandoFichaCampoMinimo[] = [];
  for (const [spec, draftKey] of Object.entries(LOTEADORES_AGUARDANDO_FICHA_CAMPOS_MINIMOS) as [
    LoteadoresAguardandoFichaCampoMinimo,
    keyof RedeLoteadorFichaDraft,
  ][]) {
    if (!String(draft[draftKey] ?? '').trim()) pendentes.push(spec);
  }
  return pendentes;
}

export function fichaLoteadorMinimaCompleta(draft: RedeLoteadorFichaDraft | null | undefined): boolean {
  return listarPendenciasFichaMinimaLoteador(draft).length === 0;
}
