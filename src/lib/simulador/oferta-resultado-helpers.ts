import { formatarMoeda, type ResultadoCalculo } from '@/lib/simulador/calcular-oferta';

export type CardResultadoItem = {
  label: string;
  valor: string;
  sublabel?: string;
  destaque?: boolean;
};

export function linhasComposicaoPreco(
  resultado: ResultadoCalculo,
  valores: { valor_lote: number; valor_casa: number; valor_customizacao: number },
): Array<{ label: string; valor: number; destaque?: boolean }> {
  return [
    {
      label: 'Custo da casa + customização',
      valor: valores.valor_casa + valores.valor_customizacao,
    },
    { label: 'Custo do lote', valor: valores.valor_lote },
    { label: 'ITBI', valor: resultado.itbi_amount },
    { label: 'Taxa plataforma', valor: resultado.taxa_plataforma_amount },
    { label: 'Taxa gestão', valor: resultado.taxa_gestao_amount },
    { label: 'Lucro loteadora', valor: resultado.lucro_loteadora_amount },
    { label: 'Lucro Moní', valor: resultado.lucro_moni_amount },
    { label: 'Lucro franqueado', valor: resultado.lucro_franqueado_amount },
    { label: 'Juros parcelado (lote)', valor: resultado.juros_lote_total },
    { label: 'Juros da obra (crédito-ponte)', valor: resultado.juros_obra_total },
    { label: 'Impostos', valor: resultado.impostos_amount },
    { label: 'Comissão corretor', valor: resultado.comissao_amount },
    { label: '= VALOR TOTAL À VISTA', valor: resultado.vte_avista, destaque: true },
    { label: '= VALOR TOTAL À PRAZO', valor: resultado.vte, destaque: true },
  ];
}

export function cardsTotaisResumo(resultado: ResultadoCalculo): CardResultadoItem[] {
  return [
    {
      label: 'Valor total à vista',
      valor: formatarMoeda(resultado.vte_avista),
      sublabel: 'sem juros do lote e da obra',
      destaque: true,
    },
    {
      label: 'Valor total à prazo',
      valor: formatarMoeda(resultado.vte),
      sublabel: 'com juros do lote e da obra',
      destaque: true,
    },
  ];
}
