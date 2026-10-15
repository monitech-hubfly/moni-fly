import type { SearchableSelectOption } from '@/components/SearchableSelect';
import { IMOB_PRODUTOS_MODELO } from '@/lib/kanban/imob-simulacoes-card';

/** Opções de tipo de negociação do terreno em Dados do Negócio (cards kanban). */
export const OPCOES_TIPO_NEGOCIACAO_TERRENO_KANBAN: SearchableSelectOption[] = [
  { value: 'Permuta Parcial', label: 'Permuta Parcial' },
  { value: '100% Permuta', label: '100% Permuta' },
  { value: '100% Permuta + % do VGV', label: '100% Permuta + % do VGV' },
  { value: '100% Compra e Venda Moní', label: '100% Compra e Venda Moní' },
  { value: '100% Compra e Venda', label: '100% Compra e Venda' },
  { value: 'Prestação de Serviços de Arquitetura e Construção', label: 'Prestação de Serviços de Arquitetura e Construção' },
];

/** Tipos em que Prazo Opção e Prazo Instrumento Garantidor devem ficar em branco. */
export const TIPOS_NEGOCIACAO_100_COMPRA_VENDA = [
  '100% Compra e Venda Moní',
  '100% Compra e Venda',
] as const;

export function isTipoNegociacao100CompraVenda(tipo: string | null | undefined): boolean {
  const v = String(tipo ?? '').trim();
  return (TIPOS_NEGOCIACAO_100_COMPRA_VENDA as readonly string[]).includes(v);
}

/** Retorna true se o tipo for "Permuta Parcial" — exibe pct_compra_parcial_terreno. */
export function isTipoPermutaParcial(tipo: string | null | undefined): boolean {
  return String(tipo ?? '').trim() === 'Permuta Parcial';
}

/** Retorna true se o tipo for "100% Permuta + % do VGV" — exibe pct_vgv_terrenista. */
export function isTipoPermutaVGV(tipo: string | null | undefined): boolean {
  return String(tipo ?? '').trim() === '100% Permuta + % do VGV';
}

/** 100% Permuta e 100% Permuta + % do VGV: valor do terreno em aberto fica zerado. */
export function isTipoTerrenoEmAbertoZero(tipo: string | null | undefined): boolean {
  const v = String(tipo ?? '').trim();
  return v === '100% Permuta' || v === '100% Permuta + % do VGV';
}

/** Retorna true se divida_terreno deve ser exibida (Permuta Parcial, 100% C&V Moní ou 100% C&V). */
export function isTipoDividaTerreno(tipo: string | null | undefined): boolean {
  const v = String(tipo ?? '').trim();
  return v === 'Permuta Parcial' || v === '100% Compra e Venda Moní' || v === '100% Compra e Venda';
}

/** Inclui valor salvo no banco que ainda não está na lista fixa (legado / migração). */
export function opcoesTipoNegociacaoComValorAtual(valor: string | null | undefined): SearchableSelectOption[] {
  const v = String(valor ?? '').trim();
  if (!v) return OPCOES_TIPO_NEGOCIACAO_TERRENO_KANBAN;
  if (OPCOES_TIPO_NEGOCIACAO_TERRENO_KANBAN.some((o) => o.value === v)) {
    return OPCOES_TIPO_NEGOCIACAO_TERRENO_KANBAN;
  }
  return [{ value: v, label: v }, ...OPCOES_TIPO_NEGOCIACAO_TERRENO_KANBAN];
}

/** Produto / Modelo da casa (mesma lista do IMOB). */
export const OPCOES_PRODUTO_MODELO_CASA: SearchableSelectOption[] = IMOB_PRODUTOS_MODELO.map((nome) => ({
  value: nome,
  label: nome,
}));

export function opcoesProdutoModeloCasaComValorAtual(
  valor: string | null | undefined,
): SearchableSelectOption[] {
  const v = String(valor ?? '').trim();
  if (!v || OPCOES_PRODUTO_MODELO_CASA.some((o) => o.value === v)) return OPCOES_PRODUTO_MODELO_CASA;
  return [{ value: v, label: v }, ...OPCOES_PRODUTO_MODELO_CASA];
}
