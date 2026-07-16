import type { SearchableSelectOption } from '@/components/SearchableSelect';

/** Opções de tipo de negociação do terreno em Dados do Negócio (cards kanban). */
export const OPCOES_TIPO_NEGOCIACAO_TERRENO_KANBAN: SearchableSelectOption[] = [
  { value: 'Permuta parcial', label: 'Permuta parcial' },
  { value: '100% Permuta', label: '100% Permuta' },
  { value: '100% Permuta + %VGV', label: '100% Permuta + %VGV' },
  { value: '100% Compra e Venda Moní', label: '100% Compra e Venda Moní' },
  { value: '100% Compra e Venda Frank', label: '100% Compra e Venda Frank' },
];

/** Tipos em que Prazo Opção e Prazo Instrumento Garantidor devem ficar em branco. */
export const TIPOS_NEGOCIACAO_100_COMPRA_VENDA = [
  '100% Compra e Venda Moní',
  '100% Compra e Venda Frank',
] as const;

export function isTipoNegociacao100CompraVenda(tipo: string | null | undefined): boolean {
  const v = String(tipo ?? '').trim();
  return (TIPOS_NEGOCIACAO_100_COMPRA_VENDA as readonly string[]).includes(v);
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
