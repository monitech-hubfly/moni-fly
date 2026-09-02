/** Cálculos do Step 5 — BcaCondominioChecklist (sem API). */

export type BcaCondominioCalcInput = {
  vgv_target: number;
  vgv_liquidacao: number;
  custo_casa: number | null;
  custo_terreno: number | null;
  custo_projetos: number | null;
  mes_inicio_obra: number | null;
  mes_venda_target: number | null;
  cet_am: number | null;
  casa_nome: string;
};

export type BcaCondominioResultado = {
  comissao: number;
  impostos: number;
  vgv_liquido: number;
  custo_casa_abs: number;
  custo_terreno_abs: number;
  taxa_plataforma: number;
  taxa_gestao: number;
  projetos: number;
  total_custos: number;
  result_bruto: number;
  margem_bruta: number;
  rent_terrenista: number;
  juros: number;
  result_alav: number;
  margem_alav: number;
  delta: number;
  margem_liquidacao: number;
  elegivel: boolean;
  estado: 'viavel' | 'limite' | 'nao_elegivel';
};

export function calcularBcaCondominioResultado(
  input: BcaCondominioCalcInput,
): BcaCondominioResultado | null {
  const vgvTarget = Number(input.vgv_target ?? 0);
  const vgvLiq = Number(input.vgv_liquidacao ?? 0);
  if (!vgvTarget || vgvTarget <= 0) return null;

  const custoCasaAbs = Math.abs(Number(input.custo_casa ?? 0));
  const custoTerrenoAbs = Math.abs(Number(input.custo_terreno ?? 0));
  const mesInicio = Number(input.mes_inicio_obra ?? 7);
  const mesVendaTarget = Number(input.mes_venda_target ?? 8);
  const cet = Number(input.cet_am ?? 0.021);

  const comissao = vgvTarget * 0.06;
  const impostos = vgvTarget * 0.06;
  const vgv_liquido = vgvTarget - comissao - impostos;
  const taxaPlat = custoCasaAbs * 0.07;
  const taxaGestao = custoCasaAbs * 0.08;
  const projetos = Math.abs(Number(input.custo_projetos ?? 76607));
  const total_custos =
    custoCasaAbs + custoTerrenoAbs + taxaPlat + taxaGestao + projetos + comissao + impostos;
  const result_bruto = vgvTarget - total_custos;
  const margem_bruta = result_bruto / vgvTarget;

  const mesesTotais = mesInicio + mesVendaTarget;
  const rent_terrenista = custoTerrenoAbs * (Math.pow(1.15, mesesTotais / 12) - 1);
  const juros = (custoCasaAbs + custoTerrenoAbs) * (Math.pow(1 + cet, 15) - 1);
  const result_alav = result_bruto - rent_terrenista - juros;
  const margem_alav = result_alav / vgvTarget;

  const delta = vgvLiq > 0 ? vgvLiq / vgvTarget - 1 : 0;
  const result_bruto_liq = vgvLiq - total_custos;
  const margem_liquidacao = vgvLiq > 0 ? result_bruto_liq / vgvLiq : 0;
  const elegivel = margem_bruta >= 0.1 && delta >= -0.1;

  let estado: BcaCondominioResultado['estado'] = 'nao_elegivel';
  if (elegivel && margem_alav >= 0.15) estado = 'viavel';
  else if (elegivel && margem_alav < 0.15) estado = 'limite';

  return {
    comissao,
    impostos,
    vgv_liquido,
    custo_casa_abs: custoCasaAbs,
    custo_terreno_abs: custoTerrenoAbs,
    taxa_plataforma: taxaPlat,
    taxa_gestao: taxaGestao,
    projetos,
    total_custos,
    result_bruto,
    margem_bruta,
    rent_terrenista,
    juros,
    result_alav,
    margem_alav,
    delta,
    margem_liquidacao,
    elegivel,
    estado,
  };
}

export function fmtMoedaBca(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export function fmtPctBca(v: number): string {
  return `${(v * 100).toFixed(1).replace('.', ',')}%`;
}
