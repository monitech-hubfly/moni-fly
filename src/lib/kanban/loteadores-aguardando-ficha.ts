/**
 * Checklist / gate da fase «Aguardando Ficha» — Funil Loteadores.
 */

import { isLoteadoresChecklistCampoVisivel } from '@/lib/kanban/loteadores-checklist-visibilidade';
import type { RedeLoteadorFichaDraft } from '@/lib/rede-loteador-ficha-draft';

export const LOTEADORES_AGUARDANDO_FICHA_FASE_SLUG = 'aguardando_ficha_moni_inc' as const;

/** Campos mínimos para avançar (instrução 4). */
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

export const LOTEADORES_AGUARDANDO_FICHA_CAMPOS = {
  nomeResponsavel: 'ficha_nome_responsavel',
  cargoFuncao: 'ficha_cargo_funcao',
  telefone: 'ficha_telefone',
  email: 'ficha_email',
  nomeCondominio: 'nome_condominio',
  cidade: 'cidade',
  dataLancamentoTvo: 'data_lancamento_tvo',
  qtdLotes: 'qtd_lotes',
  precoLotes: 'preco_lotes',
  metragemLotes: 'metragem_lotes',
  precoCasas: 'preco_casas',
  metragemTipologiaCasas: 'metragem_tipologia_casas',
  plantaCadastral: 'planta_cadastral',
  manualObras: 'manual_obras',
  linksCasasConcorrentes: 'links_casas_concorrentes',
  anexoCasasConcorrentes: 'anexo_casas_concorrentes',
  lotesDisponiveis: 'lotes_disponiveis',
  lotesVendidosQuitados: 'lotes_vendidos_quitados',
  carteiraCurta: 'carteira_curta',
  carteiraLonga: 'carteira_longa',
  tabelaPrecos: 'tabela_precos',
  observacoesLivres: 'observacoes_livres',
  anexoExtra: 'anexo_extra',
} as const;

export const LOTEADORES_AGUARDANDO_FICHA_CAMPOS_VISIVEIS = Object.values(
  LOTEADORES_AGUARDANDO_FICHA_CAMPOS,
);

export function isLoteadoresAguardandoFichaFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_AGUARDANDO_FICHA_FASE_SLUG;
}

export function isLoteadoresAguardandoFichaCampoVisivel(item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  return isLoteadoresChecklistCampoVisivel(item, LOTEADORES_AGUARDANDO_FICHA_CAMPOS_VISIVEIS);
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
