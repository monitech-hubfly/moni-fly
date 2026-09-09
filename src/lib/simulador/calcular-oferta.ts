/** Motor puro do Simulador de Pagamentos. Sem Supabase, sem servidor. */

export interface TemplateConfig {
  percentual_itbi: number;
  percentual_impostos: number;
  percentual_taxa_plataforma: number;
  percentual_taxa_gestao: number;
  percentual_lucro_loteadora: number;
  percentual_lucro_moni: number;
  percentual_lucro_franqueado: number;
  percentual_comissao_corretor: number;
  prazo_obra_meses: number;
  taxa_juros_credito_ponte: number;
  taxa_juros_parcelado_mes: number;
  taxa_juros_financiamento_anual: number;
  entrada_minima_loteadora: {
    tipo: 'percentual' | 'fixo';
    valor: number;
  } | null;
}

export interface OfertaConfig {
  valor_lote: number;
  valor_casa: number;
  valor_customizacao: number;
  valor_ja_pago: number;
  prazo_meses: number;
  parcela_mensal: number;
  renda_cliente: number;
  prazo_financiamento_anos: number;
  taxa_financiamento_anual?: number;
  /** Substitui o cálculo de entrada_do_lote pela regra de entrada_minima. */
  entrada_do_lote_override?: number;
  /** Substitui a parcela única calculada (min_quitar_lote / 30% VTE). */
  parcela_unica_override?: number;
  /**
   * Substitui entrada_cliente e saidas_total do mês 0 (entrada confirmada total).
   */
  entrada_total_override?: number;
  /** Entrada confirmada do formulário — usada no fluxo, não na precificação (VTE/VTP). */
  entrada_confirmada?: number;
  /** Parcela mensal confirmada — usada no fluxo, não na precificação (VTE/VTP). */
  mensal_confirmada?: number;
  /** Parcela única confirmada — usada no fluxo, não na precificação (VTE/VTP). */
  parcela_unica_confirmada?: number;
}

export interface LinhaFluxo {
  mes: number;
  fase: 'pre_contrato' | 'mes0' | 'fase1' | 'parcela_unica' | 'fase2' | 'entrega';
  etapa_obra?: number;
  descricao: string;
  entrada_cliente: number;
  saidas_obra: number;
  saldo_lote: number;
  juros_lote_mes: number;
  desembolso_obra: number;
  saldo_credito_ponte: number;
  juros_obra_mes: number;
  saidas_total: number;
  pagamento_loteadora: number;
}

export interface AlertaCalculo {
  tipo: 'capacidade_pagamento' | 'parcela_mensal_baixa' | 'parcela_unica_zero';
  mensagem: string;
}

export interface ResultadoCalculo {
  base_calc: number;
  itbi_amount: number;
  taxa_plataforma_amount: number;
  taxa_gestao_amount: number;
  lucro_loteadora_amount: number;
  lucro_moni_amount: number;
  lucro_franqueado_amount: number;
  juros_obra_total: number;
  juros_lote_total: number;
  vtp: number;
  impostos_amount: number;
  comissao_amount: number;
  vte: number;
  vte_avista: number;
  entrada_sugerida: number;
  entrada_do_lote: number;
  comissao_sugerida: number;
  parcela_mensal_usada: number;
  quantidade_parcelas_total: number;
  parcela_unica_sugerida: number;
  /** Piso da parcela única para a hint, com entrada/mensal efetivas. */
  parcela_unica_minima_display: number;
  mes_parcela_unica: number;
  saldo_financiar: number;
  parcela_sac_primeira: number;
  parcela_sac_ultima: number;
  parcela_unica_detalhe: {
    min_quitar_lote: number;
    min_atingir_30pct: number;
    pct_vte_antes_obra: number;
  };
  alertas: AlertaCalculo[];
  fluxo: LinhaFluxo[];
}

const DESEMBOLSO_BASE = [0.0221, 0.113, 0.2233, 0.2734, 0.1424, 0.1818, 0.044];

function r2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function n0(n: number | null | undefined): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

export function getDesembolso(N: number): number[] {
  const n = Math.min(7, Math.max(3, Math.round(n0(N))));
  if (n === 7) return [...DESEMBOLSO_BASE];
  const numSomar = 8 - n;
  const primeiro = DESEMBOLSO_BASE.slice(0, numSomar).reduce((a, b) => a + b, 0);
  return [primeiro, ...DESEMBOLSO_BASE.slice(numSomar)];
}

type DadosFase2 = { desembolso: number; saidas: number; juros: number; saldo: number };

function simularFase2(params: {
  N_obra: number;
  custo_obra: number;
  desembolhos: number[];
  taxa_gestao_mes: number;
  taxa_plataforma_mes: number;
  parcela_mensal: number;
  taxa_cp: number;
  excessoInicial: number;
}): { dados: DadosFase2[]; juros_obra_total: number } {
  const dados: DadosFase2[] = [];
  let saldo_cp = 0;
  let juros_obra_total = 0;
  let excesso_restante = Math.max(0, params.excessoInicial);

  for (let E = 1; E <= params.N_obra; E += 1) {
    const desembolso_mes = params.custo_obra * params.desembolhos[E - 1];
    const saidas_mes = desembolso_mes + params.taxa_gestao_mes + params.taxa_plataforma_mes;
    const raw_delta = saidas_mes - params.parcela_mensal;
    const excesso_aplicado_mes = Math.min(excesso_restante, Math.max(0, raw_delta));
    excesso_restante -= excesso_aplicado_mes;
    const delta_cp = raw_delta - excesso_aplicado_mes;
    const juros_mes = saldo_cp * params.taxa_cp;
    saldo_cp = saldo_cp + delta_cp + juros_mes;
    juros_obra_total += juros_mes;
    dados.push({
      desembolso: desembolso_mes,
      saidas: saidas_mes,
      juros: juros_mes,
      saldo: Math.max(0, saldo_cp),
    });
  }

  return { dados, juros_obra_total };
}

type DadosFase1 = {
  lot_balance_inicio: number;
  juros_lote_total: number;
  min_quitar_lote: number;
  juros_last: number;
  fluxo: LinhaFluxo[];
};

function simularFase1Lote(params: {
  lot_balance_inicio: number;
  prazo_meses: number;
  parcela_mensal: number;
  taxa_parcelado: number;
}): DadosFase1 {
  let lot_balance = Math.max(0, params.lot_balance_inicio);
  const fluxo: LinhaFluxo[] = [];
  let juros_lote_total = 0;

  for (let M = 1; M <= params.prazo_meses - 1; M += 1) {
    const juros_mes = lot_balance * params.taxa_parcelado;
    juros_lote_total += juros_mes;
    lot_balance = lot_balance * (1 + params.taxa_parcelado) - params.parcela_mensal;
    if (lot_balance < 0) lot_balance = 0;
    fluxo.push({
      mes: M,
      fase: 'fase1',
      descricao: 'Parcela mensal — fase 1',
      entrada_cliente: r2(params.parcela_mensal),
      saidas_obra: 0,
      saldo_lote: r2(lot_balance),
      juros_lote_mes: r2(juros_mes),
      desembolso_obra: 0,
      saldo_credito_ponte: 0,
      juros_obra_mes: 0,
      saidas_total: r2(params.parcela_mensal),
      pagamento_loteadora: r2(params.parcela_mensal),
    });
  }

  const juros_last = lot_balance * params.taxa_parcelado;
  juros_lote_total += juros_last;
  const min_quitar_lote = Math.max(
    0,
    lot_balance * (1 + params.taxa_parcelado) - params.parcela_mensal,
  );

  return {
    lot_balance_inicio: Math.max(0, params.lot_balance_inicio),
    juros_lote_total,
    min_quitar_lote,
    juros_last,
    fluxo,
  };
}

/** Residual para completar 30% do VTE na Fase 1, sem recálculo de VTE/CP. */
export function calcularParcelaUnicaMinimaDisplay(params: {
  vte: number;
  min_quitar_lote: number;
  entrada_efetiva: number;
  mensal_efetiva: number;
  n_meses_fase1: number;
}): number {
  const vte_30_pct = 0.3 * n0(params.vte);
  const soma_mensais_fase1 = n0(params.mensal_efetiva) * n0(params.n_meses_fase1);
  return r2(
    Math.max(
      n0(params.min_quitar_lote),
      vte_30_pct - n0(params.entrada_efetiva) - soma_mensais_fase1,
    ),
  );
}

export function sugerirParcelaMensal(valor_lote: number): number {
  if (valor_lote < 300_000) return 7_000;
  if (valor_lote < 800_000) return 10_000;
  return 15_000;
}

export function formatarMoeda(v: number): string {
  return n0(v).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

export function calcularOferta(template: TemplateConfig, oferta: OfertaConfig): ResultadoCalculo {
  const valor_lote = Math.max(0, n0(oferta.valor_lote));
  const valor_casa = Math.max(0, n0(oferta.valor_casa));
  const valor_customizacao = Math.max(0, n0(oferta.valor_customizacao));
  const valor_ja_pago = Math.max(0, n0(oferta.valor_ja_pago));
  const prazo_meses = Math.max(1, Math.round(n0(oferta.prazo_meses)));
  const parcela_mensal = Math.max(0, n0(oferta.parcela_mensal));
  const renda_cliente = Math.max(0, n0(oferta.renda_cliente));
  const prazo_financiamento_anos = Math.max(0, Math.round(n0(oferta.prazo_financiamento_anos)));

  const N_obra = Math.min(7, Math.max(3, Math.round(n0(template.prazo_obra_meses) || 7)));
  const taxa_fin_anual = n0(
    oferta.taxa_financiamento_anual ?? template.taxa_juros_financiamento_anual,
  );
  const taxa_parcelado = Math.max(0, n0(template.taxa_juros_parcelado_mes));
  const taxa_cp = Math.max(0, n0(template.taxa_juros_credito_ponte));

  const base_calc = valor_lote + valor_casa + valor_customizacao;
  const custo_obra = valor_casa + valor_customizacao;

  const itbi_amount = n0(template.percentual_itbi) * valor_lote;
  const taxa_plataforma_amount = n0(template.percentual_taxa_plataforma) * base_calc;
  const taxa_gestao_amount = n0(template.percentual_taxa_gestao) * base_calc;
  const lucro_loteadora_amount = n0(template.percentual_lucro_loteadora) * base_calc;
  const lucro_moni_amount = n0(template.percentual_lucro_moni) * base_calc;
  const lucro_franqueado_amount = n0(template.percentual_lucro_franqueado) * base_calc;

  const VTP_base =
    base_calc +
    itbi_amount +
    taxa_plataforma_amount +
    taxa_gestao_amount +
    lucro_loteadora_amount +
    lucro_moni_amount +
    lucro_franqueado_amount;
  /** Comissão sobre o valor à vista — sem juros de lote nem de crédito-ponte. Fixa entre fluxos. */
  const comissao_amount = n0(template.percentual_comissao_corretor) * VTP_base;

  // Entrada do contrato: percentual/fixo sobre o preço do lote.
  let entrada_do_lote = 0;
  if (!template.entrada_minima_loteadora) {
    entrada_do_lote = 0;
  } else if (template.entrada_minima_loteadora.tipo === 'percentual') {
    entrada_do_lote = Math.max(0, template.entrada_minima_loteadora.valor * valor_lote);
  } else {
    entrada_do_lote = Math.max(0, template.entrada_minima_loteadora.valor);
  }

  const entrada_do_lote_definida = oferta.entrada_do_lote_override ?? entrada_do_lote;
  const ja_pago_loteadora = Math.min(valor_ja_pago, valor_lote);
  entrada_do_lote = Math.max(0, entrada_do_lote_definida - ja_pago_loteadora);
  /** Precificação: entrada definida, como se ja_pago = 0. */
  const lot_balance_preco = Math.max(0, valor_lote - entrada_do_lote_definida);
  const entrada_mes0_fluxo = entrada_do_lote + comissao_amount;
  /** 30% do VTE usa a entrada cheia (sem ja_pago), para a parcela única não mudar. */
  const entrada_total = comissao_amount + entrada_do_lote_definida;

  const paramsFase1 = {
    prazo_meses,
    parcela_mensal,
    taxa_parcelado,
  };
  const fase1Preco = simularFase1Lote({
    ...paramsFase1,
    lot_balance_inicio: lot_balance_preco,
  });
  const juros_lote_total = fase1Preco.juros_lote_total;
  const min_quitar_lote = fase1Preco.min_quitar_lote;
  const parcela_unica_necessaria = min_quitar_lote;

  const desembolhos = getDesembolso(N_obra);
  const taxa_gestao_mes = taxa_gestao_amount / N_obra;
  const taxa_plataforma_mes = taxa_plataforma_amount / N_obra;

  const paramsFase2 = {
    N_obra,
    custo_obra,
    desembolhos,
    taxa_gestao_mes,
    taxa_plataforma_mes,
    parcela_mensal,
    taxa_cp,
  };

  /**
   * Fase 2 e VTE são circulares: o excesso da parcela única sugerida (piso 30% do VTE)
   * reduz o CP e os juros da obra, que entram no VTP/VTE e portanto no próprio excesso.
   * Itera até o excesso usado na simulação coincidir com o excesso implícito no VTE (tol. R$1).
   * Valores confirmados não entram nesta iteração — o resumo (VTE/VTP) permanece o sugerido.
   */
  let excessoAtual = 0;
  let juros_obra_total = 0;
  let VTP = VTP_base;
  let impostos_amount = 0;
  let VTE = VTP_base + comissao_amount;
  let total_pago_ate_aqui = 0;
  let min_atingir_30pct = 0;
  let parcela_unica = parcela_unica_necessaria;

  const MAX_ITERS_F2 = 8;
  const TOL_EXCESSO = 1;

  for (let i = 0; i < MAX_ITERS_F2; i += 1) {
    const sim = simularFase2({
      ...paramsFase2,
      excessoInicial: excessoAtual,
    });
    juros_obra_total = sim.juros_obra_total;

    VTP = VTP_base + juros_obra_total + juros_lote_total;
    impostos_amount = n0(template.percentual_impostos) * VTP;
    VTE = VTP + impostos_amount + comissao_amount;

    total_pago_ate_aqui = entrada_total + prazo_meses * parcela_mensal;
    min_atingir_30pct = Math.max(0, 0.3 * VTE - total_pago_ate_aqui);
    parcela_unica = Math.max(min_quitar_lote, min_atingir_30pct);
    const novoExcesso = Math.max(0, parcela_unica - parcela_unica_necessaria);

    if (Math.abs(novoExcesso - excessoAtual) < TOL_EXCESSO) {
      break;
    }
    excessoAtual = novoExcesso;
  }

  const vte_avista =
    VTP_base *
    (1 + n0(template.percentual_impostos) + n0(template.percentual_comissao_corretor));
  const pct_vte_antes_obra = VTE > 0 ? (total_pago_ate_aqui + parcela_unica) / VTE : 0;

  const entrada_fluxo = oferta.entrada_confirmada ?? oferta.entrada_total_override ?? entrada_mes0_fluxo;
  const mensal_fluxo = oferta.mensal_confirmada ?? parcela_mensal;
  const parcela_unica_fluxo =
    oferta.parcela_unica_confirmada ?? oferta.parcela_unica_override ?? parcela_unica;

  const temConfirmacaoUnica =
    oferta.entrada_confirmada != null || oferta.mensal_confirmada != null;
  const parcela_unica_minima_display = temConfirmacaoUnica
    ? calcularParcelaUnicaMinimaDisplay({
        vte: VTE,
        min_quitar_lote,
        entrada_efetiva: ja_pago_loteadora + n0(entrada_fluxo),
        mensal_efetiva: mensal_fluxo,
        n_meses_fase1: prazo_meses,
      })
    : r2(parcela_unica);

  const entrada_do_lote_fluxo = Math.max(0, n0(entrada_fluxo) - comissao_amount);
  const lot_balance_fluxo_conf = Math.max(0, valor_lote - ja_pago_loteadora - entrada_do_lote_fluxo);
  const fase1Fluxo = simularFase1Lote({
    prazo_meses,
    parcela_mensal: mensal_fluxo,
    taxa_parcelado,
    lot_balance_inicio: lot_balance_fluxo_conf,
  });
  const quitacao_real_fluxo = fase1Fluxo.min_quitar_lote;

  const pag_loteadora_unica = mensal_fluxo + quitacao_real_fluxo;
  /**
   * Caixa do mês da parcela única = quitação real do lote (fluxo) + mensal + ITBI.
   * min_quitar_lote da precificação continua na parcela única sugerida / excesso do VTE.
   */
  const saidas_unica = mensal_fluxo + quitacao_real_fluxo + itbi_amount;

  const lucros_ultimo = lucro_loteadora_amount + lucro_moni_amount + lucro_franqueado_amount;
  /** Lucros + impostos do último mês de obra — entram em saidas_total, não no crédito-ponte. */
  const liquidacao_entrega = lucros_ultimo + impostos_amount;
  const excesso_fluxo = Math.max(0, parcela_unica_fluxo - quitacao_real_fluxo);
  const fase2Fluxo = simularFase2({
    N_obra,
    custo_obra,
    desembolhos,
    taxa_gestao_mes,
    taxa_plataforma_mes,
    parcela_mensal: mensal_fluxo,
    taxa_cp,
    excessoInicial: excesso_fluxo,
  });
  const saldo_cp_final = fase2Fluxo.dados.length > 0 ? fase2Fluxo.dados[fase2Fluxo.dados.length - 1].saldo : 0;
  const saldo_financiar = Math.max(0, saldo_cp_final + liquidacao_entrega);

  const n_parcelas = prazo_financiamento_anos * 12;
  const taxa_mensal = taxa_fin_anual > -1 ? (1 + taxa_fin_anual) ** (1 / 12) - 1 : 0;
  const amortizacao = n_parcelas > 0 ? saldo_financiar / n_parcelas : 0;
  const parcela_sac_primeira = n_parcelas > 0 ? amortizacao + saldo_financiar * taxa_mensal : 0;
  const parcela_sac_ultima = n_parcelas > 0 ? amortizacao * (1 + taxa_mensal) : 0;

  const caixa_mes0 = entrada_fluxo;
  const linhaPreContrato: LinhaFluxo | null =
    ja_pago_loteadora > 0
      ? {
          mes: 0,
          fase: 'pre_contrato',
          descricao: 'Pré-contrato (já pago à loteadora)',
          entrada_cliente: r2(ja_pago_loteadora),
          saidas_obra: 0,
          saldo_lote: r2(valor_lote - ja_pago_loteadora),
          juros_lote_mes: 0,
          desembolso_obra: 0,
          saldo_credito_ponte: 0,
          juros_obra_mes: 0,
          saidas_total: r2(ja_pago_loteadora),
          pagamento_loteadora: r2(ja_pago_loteadora),
        }
      : null;
  const fluxo: LinhaFluxo[] = [
    ...(linhaPreContrato ? [linhaPreContrato] : []),
    {
      mes: 0,
      fase: 'mes0',
      descricao: 'Entrada (comissão + entrada do lote)',
      entrada_cliente: r2(caixa_mes0),
      saidas_obra: 0,
      saldo_lote: r2(fase1Fluxo.lot_balance_inicio),
      juros_lote_mes: 0,
      desembolso_obra: 0,
      saldo_credito_ponte: 0,
      juros_obra_mes: 0,
      saidas_total: r2(caixa_mes0),
      pagamento_loteadora: r2(entrada_do_lote_fluxo),
    },
    ...fase1Fluxo.fluxo,
    {
      mes: prazo_meses,
      fase: 'parcela_unica',
      descricao: 'Parcela mensal + parcela única',
      entrada_cliente: r2(mensal_fluxo + parcela_unica_fluxo + itbi_amount),
      saidas_obra: 0,
      saldo_lote: 0,
      juros_lote_mes: r2(fase1Fluxo.juros_last),
      desembolso_obra: 0,
      saldo_credito_ponte: 0,
      juros_obra_mes: 0,
      saidas_total: r2(saidas_unica),
      pagamento_loteadora: r2(pag_loteadora_unica),
    },
  ];

  fase2Fluxo.dados.forEach((et, idx) => {
    const E = idx + 1;
    const ultimo = E === N_obra;
    const saidas_obra = et.saidas;
    const saidas_total = ultimo ? saidas_obra + liquidacao_entrega : saidas_obra;
    fluxo.push({
      mes: prazo_meses + E,
      fase: 'fase2',
      etapa_obra: E,
      descricao: ultimo ? `Obra — etapa ${E}/${N_obra} (entrega)` : `Obra — etapa ${E}/${N_obra}`,
      entrada_cliente: r2(mensal_fluxo),
      saidas_obra: r2(saidas_obra),
      saldo_lote: 0,
      juros_lote_mes: 0,
      desembolso_obra: r2(et.desembolso),
      saldo_credito_ponte: r2(et.saldo),
      juros_obra_mes: r2(et.juros),
      saidas_total: r2(saidas_total),
      pagamento_loteadora: 0,
    });
  });

  const alertas: AlertaCalculo[] = [];
  if (parcela_sac_primeira > renda_cliente / 3) {
    alertas.push({
      tipo: 'capacidade_pagamento',
      mensagem: `Estimativa da 1ª parcela SAC (${formatarMoeda(parcela_sac_primeira)}) supera 1/3 da renda informada (${formatarMoeda(renda_cliente)}). Considere aumentar a parcela mensal ou o prazo de financiamento.`,
    });
  }

  if (mensal_fluxo < fase1Fluxo.lot_balance_inicio * taxa_parcelado && taxa_parcelado > 0) {
    alertas.push({
      tipo: 'parcela_mensal_baixa',
      mensagem:
        'Parcela mensal abaixo dos juros mensais do saldo do lote — o saldo devedor vai crescer em vez de diminuir.',
    });
  }

  if (r2(parcela_unica_fluxo) === 0) {
    alertas.push({
      tipo: 'parcela_unica_zero',
      mensagem:
        'Nenhuma parcela única necessária — o lote já estará quitado pelas parcelas mensais e o critério de 30% já estará cumprido.',
    });
  }

  return {
    base_calc: r2(base_calc),
    itbi_amount: r2(itbi_amount),
    taxa_plataforma_amount: r2(taxa_plataforma_amount),
    taxa_gestao_amount: r2(taxa_gestao_amount),
    lucro_loteadora_amount: r2(lucro_loteadora_amount),
    lucro_moni_amount: r2(lucro_moni_amount),
    lucro_franqueado_amount: r2(lucro_franqueado_amount),
    juros_obra_total: r2(juros_obra_total),
    juros_lote_total: r2(juros_lote_total),
    vtp: r2(VTP),
    impostos_amount: r2(impostos_amount),
    comissao_amount: r2(comissao_amount),
    vte: r2(VTE),
    vte_avista: r2(vte_avista),
    entrada_sugerida: r2(entrada_mes0_fluxo),
    entrada_do_lote: r2(entrada_do_lote),
    comissao_sugerida: r2(comissao_amount),
    parcela_mensal_usada: r2(parcela_mensal),
    quantidade_parcelas_total: prazo_meses + N_obra,
    parcela_unica_sugerida: r2(parcela_unica),
    parcela_unica_minima_display,
    mes_parcela_unica: prazo_meses,
    saldo_financiar: r2(saldo_financiar),
    parcela_sac_primeira: r2(parcela_sac_primeira),
    parcela_sac_ultima: r2(parcela_sac_ultima),
    parcela_unica_detalhe: {
      min_quitar_lote: r2(min_quitar_lote),
      min_atingir_30pct: r2(min_atingir_30pct),
      pct_vte_antes_obra: r2(pct_vte_antes_obra * 100),
    },
    alertas,
    fluxo,
  };
}

