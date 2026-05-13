/**
 * BCA (Business Case Analysis) - Cálculos espelhando planilha BCA v0.2
 * Regras críticas: obra_mes8 e vgv_planta nunca salvos; recompra comissão=0 e ITBI embutido.
 */

const TOTAL_MESES = 84;
const MES_VENDA: Record<'planta' | 'target' | 'liquidacao' | 'recompra', number> = {
  planta: 3,
  target: 7,
  liquidacao: 10,
  recompra: 16,
};
const MULT_CUSTO_CAPITAL_INVESTIDOR = 2.0;
const MULT_CUSTO_CAPITAL_TERRENISTA = 1.5;

export type BcaInputs = {
  nome_condominio?: string;
  nome_casa?: string;
  area_vendas_m2?: number;
  custo_terreno?: number;
  itbi_percentual?: number;
  custo_casa?: number;
  mes_inicio_obra?: number;
  obra_mes1?: number;
  obra_mes2?: number;
  obra_mes3?: number;
  obra_mes4?: number;
  obra_mes5?: number;
  obra_mes6?: number;
  obra_mes7?: number;
  obra_mes9?: number;
  obra_mes10?: number;
  comissao_vendas?: number;
  impostos?: number;
  taxa_plataforma?: number;
  taxa_gestao_frank?: number;
  projetos_taxa_obra?: number;
  capital_giro_inicial?: number;
  vgv_target?: number;
  vgv_liquidacao?: number;
  vgv_recompra?: number;
  permuta_planta?: number;
  permuta_target?: number;
  permuta_liquidacao?: number;
  permuta_recompra?: number;
  percentual_funding?: number;
  cdi_an?: number;
};

/** obra_mes8 calculado no cliente: 1 - SUM(mes1..mes7). Não enviar para o banco. */
export function calcObraMes8(inputs: BcaInputs): number {
  const s =
    (inputs.obra_mes1 ?? 0) +
    (inputs.obra_mes2 ?? 0) +
    (inputs.obra_mes3 ?? 0) +
    (inputs.obra_mes4 ?? 0) +
    (inputs.obra_mes5 ?? 0) +
    (inputs.obra_mes6 ?? 0) +
    (inputs.obra_mes7 ?? 0);
  return Math.max(0, 1 - s);
}

/** vgv_planta calculado: (vgv_target + vgv_liquidacao) / 2. Não salvar no banco. */
export function calcVgvPlanta(inputs: BcaInputs): number {
  const t = inputs.vgv_target ?? 0;
  const l = inputs.vgv_liquidacao ?? 0;
  return (t + l) / 2;
}

export type CenarioNome = 'planta' | 'target' | 'liquidacao' | 'recompra';

export type CenarioResult = {
  nome: CenarioNome;
  vgv: number;
  vgv_por_m2: number;
  mes_venda: number;
  comissao: number;
  impostos_valor: number;
  venda_liquida: number;
  terreno_base: number;
  terreno_variavel: number;
  casa: number;
  taxa_plataforma_valor: number;
  taxa_gestao_valor: number;
  itbi_valor: number;
  projetos: number;
  capital_giro: number;
  resultado_nao_alavancado: number;
  pct_vgv_nao_alavancado: number;
  juros_custo_financeiro: number;
  resultado_alavancado: number;
  pct_vgv_alavancado: number;
  resultado_total_frank: number;
  tir_consolidada_aa: number;
  tir_investidor_nao_alav_aa: number;
  tir_terrenista_aa: number;
  tir_terrenista_pct_cdi: number;
  vpl_investidor_nao_alav: number;
  vpl_investidor_alav: number;
  vpl_terrenista: number;
  ltv: number;
  cet_aa: number;
  saldo_acumulado_moni: number[];
};

export type BcaResults = {
  planta: CenarioResult;
  target: CenarioResult;
  liquidacao: CenarioResult;
  recompra: CenarioResult;
  margem_target_liquidacao: number;
  taxa_juros_an: number;
  tac: number;
  iof: number;
};

// --- Fórmulas fixas (regras de negócio) ---
/** Taxa juros mensal: ((1+14,25%)*(1+6%))^(1/12)-1. Retorna taxa mensal (não anual). */
export function calcTaxaJurosMensal(): number {
  return Math.pow(1.1425 * 1.06, 1 / 12) - 1;
}

/** TAC: 4,5% / (1 - 13,65%) */
export function calcTac(): number {
  return 0.045 / (1 - 0.1365);
}

/** IOF: sempre 0 (1,85% × 0) */
export function calcIof(): number {
  return 0;
}

function calcNPV(fluxo: number[], taxaMensal: number): number {
  return fluxo.reduce((acc, cf, t) => acc + cf / Math.pow(1 + taxaMensal, t), 0);
}

function calcIRR(fluxo: number[], guess = 0.01): number {
  let r = guess;
  for (let i = 0; i < 200; i++) {
    const npv = fluxo.reduce((acc, cf, t) => acc + cf / Math.pow(1 + r, t), 0);
    if (Math.abs(npv) < 1e-12) return r;
    const npvDelta = fluxo.reduce((acc, cf, t) => acc - (cf * t) / Math.pow(1 + r, t + 1), 0);
    r = r - npv / (npvDelta || 1e-10);
    if (r < -0.99 || r > 10) break;
  }
  return r;
}

/** Distribuição uniforme: total em duracao meses a partir de inicio */
function distribuirFluxo(total: number, inicio: number, duracao: number): number[] {
  const fluxo = new Array<number>(TOTAL_MESES).fill(0);
  if (duracao <= 0) return fluxo;
  const parcela = total / duracao;
  for (let i = 0; i < duracao && inicio + i < TOTAL_MESES; i++) {
    fluxo[inicio + i] = parcela;
  }
  return fluxo;
}

/** Distribuição da casa via percentuais obra_mes (mês 8 = 1 - sum(mes1..7)) */
function distribuirCustoCasa(total: number, inputs: BcaInputs): number[] {
  const fluxo = new Array<number>(TOTAL_MESES).fill(0);
  const inicio = (inputs.mes_inicio_obra ?? 3) - 1;
  const obra8 = calcObraMes8(inputs);
  const tabela = [
    inputs.obra_mes1 ?? 0,
    inputs.obra_mes2 ?? 0,
    inputs.obra_mes3 ?? 0,
    inputs.obra_mes4 ?? 0,
    inputs.obra_mes5 ?? 0,
    inputs.obra_mes6 ?? 0,
    inputs.obra_mes7 ?? 0,
    obra8,
    inputs.obra_mes9 ?? 0,
    inputs.obra_mes10 ?? 0,
  ];
  for (let i = 0; i < 10 && inicio + i < TOTAL_MESES; i++) {
    fluxo[inicio + i] = total * tabela[i];
  }
  return fluxo;
}

export type DebtSlice = {
  emissionMonth: number;
  grossAmount: number;
  netFunding: number;
  prazo: number;
  balances: number[];
  amortizations: number[];
  interests: number[];
};

/** Dívida bullet: paga tudo no mês (emissionMonth + prazo). Juros provisionados e pagos no mesmo mês. */
function buildDebtSlice(
  emissionMonth: number,
  funding: number,
  taxaJurosAm: number,
  tac: number,
  iof: number,
  mesVenda: number,
): DebtSlice {
  const prazo = 12; // countdown a partir de mes_venda
  const grossAmount = funding * (1 + tac - iof);
  const netFunding = funding;
  const balances = new Array<number>(TOTAL_MESES).fill(0);
  const amortizations = new Array<number>(TOTAL_MESES).fill(0);
  const interests = new Array<number>(TOTAL_MESES).fill(0);
  let saldo = 0;
  const prazoAmort = emissionMonth + prazo;
  for (let m = 0; m < TOTAL_MESES; m++) {
    const isFirst = m === emissionMonth;
    if (isFirst) saldo = grossAmount;
    const jurosProv = saldo * taxaJurosAm;
    interests[m] = jurosProv;
    const amort = m === prazoAmort ? saldo : 0;
    amortizations[m] = amort;
    saldo = saldo - amort + jurosProv - jurosProv;
    if (m === prazoAmort) saldo = 0;
    balances[m] = saldo;
  }
  return {
    emissionMonth,
    grossAmount,
    netFunding,
    prazo,
    balances,
    amortizations,
    interests,
  };
}

function calcCET(slices: DebtSlice[], taxaJurosAnual: number): number {
  if (slices.length === 0) return 0;
  const cashFlow = new Array<number>(TOTAL_MESES).fill(0);
  const s0 = slices[0];
  if (s0.netFunding === 0) return 0;
  cashFlow[s0.emissionMonth] = -s0.netFunding;
  for (const slice of slices) {
    for (let m = 0; m < TOTAL_MESES; m++) {
      cashFlow[m] += slice.amortizations[m] + slice.interests[m];
    }
  }
  const cetM = calcIRR(cashFlow);
  return Math.pow(1 + cetM, 12) - 1;
}

function calcCenario(
  nome: CenarioNome,
  inputs: BcaInputs,
  vgvVal: number,
  permutaVal: number,
  taxaJurosAm: number,
  tac: number,
  iof: number,
): CenarioResult {
  const mesVenda = MES_VENDA[nome];
  const area = inputs.area_vendas_m2 ?? 627;
  const custoTerreno = inputs.custo_terreno ?? -1000000;
  const itbiPct = inputs.itbi_percentual ?? 0.04;
  const custoCasa = inputs.custo_casa ?? -2510000;
  const taxaPlat = inputs.taxa_plataforma ?? -0.07;
  const taxaGestao = inputs.taxa_gestao_frank ?? -0.08;
  const projetos = inputs.projetos_taxa_obra ?? -50000;
  const capitalGiro = inputs.capital_giro_inicial ?? -25000;
  const comissaoPct = inputs.comissao_vendas ?? -0.08;
  const impostosPct = inputs.impostos ?? 0.06;

  const comissao = nome === 'recompra' ? 0 : comissaoPct * vgvVal;
  const impostosValor = impostosPct * vgvVal;
  const vendaLiquida = vgvVal + comissao + -impostosValor;

  const terrenoBase = nome === 'recompra' ? custoTerreno * (1 + itbiPct) : custoTerreno;
  const terrenoVar = Math.max(0, vendaLiquida * permutaVal - Math.abs(terrenoBase));
  const casa = custoCasa;

  const taxaPlataformaValor = taxaPlat * vgvVal;
  const taxaGestaoValor = nome === 'recompra' ? 0 : taxaGestao * vgvVal;
  const itbiValor = nome === 'recompra' ? 0 : itbiPct * Math.abs(custoTerreno);

  const resultadoNaoAlav =
    vendaLiquida +
    terrenoBase +
    terrenoVar +
    casa +
    taxaPlataformaValor +
    taxaGestaoValor +
    itbiValor +
    projetos +
    capitalGiro;
  const pctVgvNaoAlav = vgvVal !== 0 ? (resultadoNaoAlav / vgvVal) * 100 : 0;

  const percentualFunding = inputs.percentual_funding ?? 1;
  const funding = Math.abs(resultadoNaoAlav) * percentualFunding;
  const slice = buildDebtSlice(0, funding, taxaJurosAm, tac, iof, mesVenda);
  const jurosCusto = slice.interests.reduce((a, b) => a + b, 0);
  const resultadoAlav = resultadoNaoAlav + jurosCusto;
  const pctVgvAlav = vgvVal !== 0 ? (resultadoAlav / vgvVal) * 100 : 0;
  const resultadoTotalFrank = resultadoAlav - Math.abs(taxaGestaoValor);

  const cdiAn = inputs.cdi_an ?? 0.15;
  const cdiAm = Math.pow(1 + cdiAn, 1 / 12) - 1;
  const custoCapInvAm = (MULT_CUSTO_CAPITAL_INVESTIDOR * cdiAn) / 12;
  const custoCapTerAm = (MULT_CUSTO_CAPITAL_TERRENISTA * cdiAn) / 12;

  const fluxoInvestidorNaoAlav = new Array<number>(TOTAL_MESES).fill(0);
  const fVenda = distribuirFluxo(vgvVal, mesVenda, 1);
  const fComissao = distribuirFluxo(comissao, mesVenda, 1);
  const fImpostos = distribuirFluxo(-impostosValor, mesVenda, 1);
  const fTerrenoBase = distribuirFluxo(terrenoBase, mesVenda, 1);
  const fTerrenoVar = distribuirFluxo(terrenoVar, mesVenda, 1);
  const fCasa = distribuirCustoCasa(casa, inputs);
  const fTaxaPlat = distribuirFluxo(taxaPlataformaValor, 3, 1);
  const fTaxaGestao = distribuirFluxo(taxaGestaoValor, 1, 1);
  const fItbi = distribuirFluxo(itbiValor, 0, 1);
  const fProjetos = distribuirFluxo(projetos, 0, 1);
  const fCapitalGiro = distribuirFluxo(capitalGiro, 0, 1);
  for (let m = 0; m < TOTAL_MESES; m++) {
    fluxoInvestidorNaoAlav[m] =
      fVenda[m] +
      fComissao[m] +
      fImpostos[m] +
      fTerrenoBase[m] +
      fTerrenoVar[m] +
      fCasa[m] +
      fTaxaPlat[m] +
      fTaxaGestao[m] +
      fItbi[m] +
      fProjetos[m] +
      fCapitalGiro[m];
  }

  const vplInvNaoAlav = calcNPV(fluxoInvestidorNaoAlav, custoCapInvAm);
  const fluxoPermutante = fluxoInvestidorNaoAlav.slice();
  const vplTerrenista = calcNPV(fluxoPermutante, custoCapTerAm);

  const fluxoInvestidorAlav = fluxoInvestidorNaoAlav.map(
    (v, m) => v - slice.amortizations[m] - slice.interests[m],
  );
  const vplInvAlav = calcNPV(fluxoInvestidorAlav, custoCapInvAm);

  const saldoAcumulado = new Array<number>(TOTAL_MESES).fill(0);
  let saldo = 0;
  for (let m = 0; m < TOTAL_MESES; m++) {
    saldo += fluxoInvestidorAlav[m];
    saldoAcumulado[m] = saldo;
  }

  const tirInvNaoAlav = (Math.pow(1 + calcIRR(fluxoInvestidorNaoAlav), 12) - 1) * 100;
  const tirInvAlav = (Math.pow(1 + calcIRR(fluxoInvestidorAlav), 12) - 1) * 100;
  const tirTerrenista = (Math.pow(1 + calcIRR(fluxoPermutante), 12) - 1) * 100;
  const tirConsolidada = (Math.pow(1 + calcIRR(fluxoInvestidorAlav), 12) - 1) * 100;
  const cetAa = calcCET([slice], 0) * 100;

  const totalInvestimento =
    Math.abs(terrenoBase) +
    Math.abs(terrenoVar) +
    Math.abs(casa) +
    Math.abs(taxaPlataformaValor) +
    Math.abs(taxaGestaoValor) +
    Math.abs(itbiValor) +
    Math.abs(projetos) +
    Math.abs(capitalGiro);
  const ltv = vgvVal !== 0 ? totalInvestimento / vgvVal : 0;

  return {
    nome,
    vgv: vgvVal,
    vgv_por_m2: area > 0 ? vgvVal / area : 0,
    mes_venda: mesVenda,
    comissao,
    impostos_valor: impostosValor,
    venda_liquida: vendaLiquida,
    terreno_base: terrenoBase,
    terreno_variavel: terrenoVar,
    casa,
    taxa_plataforma_valor: taxaPlataformaValor,
    taxa_gestao_valor: taxaGestaoValor,
    itbi_valor: itbiValor,
    projetos,
    capital_giro: capitalGiro,
    resultado_nao_alavancado: resultadoNaoAlav,
    pct_vgv_nao_alavancado: pctVgvNaoAlav,
    juros_custo_financeiro: jurosCusto,
    resultado_alavancado: resultadoAlav,
    pct_vgv_alavancado: pctVgvAlav,
    resultado_total_frank: resultadoTotalFrank,
    tir_consolidada_aa: tirConsolidada,
    tir_investidor_nao_alav_aa: tirInvNaoAlav,
    tir_terrenista_aa: tirTerrenista,
    tir_terrenista_pct_cdi: cdiAn !== 0 ? tirTerrenista / (cdiAn * 100) : 0,
    vpl_investidor_nao_alav: vplInvNaoAlav,
    vpl_investidor_alav: vplInvAlav,
    vpl_terrenista: vplTerrenista,
    ltv,
    cet_aa: cetAa,
    saldo_acumulado_moni: saldoAcumulado,
  };
}

/** Função principal: calcula os 4 cenários e margem target vs liquidação */
export function calcBca(inputs: BcaInputs): BcaResults {
  const vgvPlanta = calcVgvPlanta(inputs);
  const vgvTarget = inputs.vgv_target ?? 6000000;
  const vgvLiquidacao = inputs.vgv_liquidacao ?? 5400000;
  const vgvRecompra = inputs.vgv_recompra ?? 5300000;

  const taxaJurosAm = calcTaxaJurosMensal();
  const taxaJurosAn = (Math.pow(1 + taxaJurosAm, 12) - 1) * 100;
  const tac = calcTac();
  const iof = calcIof();

  const planta = calcCenario(
    'planta',
    inputs,
    vgvPlanta,
    inputs.permuta_planta ?? 0.25,
    taxaJurosAm,
    tac,
    iof,
  );
  const target = calcCenario(
    'target',
    inputs,
    vgvTarget,
    inputs.permuta_target ?? 0.25,
    taxaJurosAm,
    tac,
    iof,
  );
  const liquidacao = calcCenario(
    'liquidacao',
    inputs,
    vgvLiquidacao,
    inputs.permuta_liquidacao ?? 0.25,
    taxaJurosAm,
    tac,
    iof,
  );
  const recompra = calcCenario(
    'recompra',
    inputs,
    vgvRecompra,
    inputs.permuta_recompra ?? 0.36,
    taxaJurosAm,
    tac,
    iof,
  );

  const margem = liquidacao.vgv !== 0 ? (target.vgv / liquidacao.vgv - 1) * 100 : 0;

  return {
    planta,
    target,
    liquidacao,
    recompra,
    margem_target_liquidacao: margem,
    taxa_juros_an: taxaJurosAn,
    tac: tac * 100,
    iof: iof * 100,
  };
}

export const BCA_DEFAULTS: BcaInputs = {
  nome_condominio: '',
  nome_casa: '',
  area_vendas_m2: 627,
  custo_terreno: -1000000,
  itbi_percentual: 0.04,
  custo_casa: -2510000,
  mes_inicio_obra: 3,
  obra_mes1: 0.15,
  obra_mes2: 0.25,
  obra_mes3: 0.18,
  obra_mes4: 0.1,
  obra_mes5: 0.1,
  obra_mes6: 0.01,
  obra_mes7: 0.01,
  obra_mes9: 0.08,
  obra_mes10: 0.08,
  comissao_vendas: -0.08,
  impostos: 0.06,
  taxa_plataforma: -0.07,
  taxa_gestao_frank: -0.08,
  projetos_taxa_obra: -50000,
  capital_giro_inicial: -25000,
  vgv_target: 6000000,
  vgv_liquidacao: 5400000,
  vgv_recompra: 5300000,
  permuta_planta: 0.25,
  permuta_target: 0.25,
  permuta_liquidacao: 0.25,
  permuta_recompra: 0.36,
  percentual_funding: 1.0,
  cdi_an: 0.15,
};
