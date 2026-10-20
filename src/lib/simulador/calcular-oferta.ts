/** Motor puro do Simulador de Pagamentos. Sem Supabase, sem servidor. */

export interface TemplateConfig {
  percentual_itbi: number;
  percentual_impostos: number;
  percentual_taxa_plataforma: number;
  percentual_taxa_gestao: number;
  /** `fixo`: percentual_taxa_gestao é R$. Default percentual. */
  tipo_taxa_gestao?: 'percentual' | 'fixo';
  /** Fração da taxa de plataforma cobrada na entrada (0.10 = 10%). 0 = diluir na obra. */
  percentual_plataforma_entrada?: number;
  percentual_lucro_loteadora: number;
  percentual_lucro_moni: number;
  percentual_lucro_franqueado: number;
  percentual_comissao_corretor: number;
  prazo_obra_meses: number;
  taxa_juros_credito_ponte: number;
  /** `total`: juros simples sobre a base líquida × (obra + buffer). Default mês a mês. */
  tipo_juros_cp?: 'mes_a_mes' | 'total';
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
  /** Acoplamento separado da customização. Default 0. Entra no custo da obra. */
  valor_acoplamento?: number;
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
  valor_casa: number;
  valor_customizacao: number;
  valor_acoplamento: number;
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

/** Meses extras de juros do crédito-ponte (não viram linhas no fluxo). */
export const BUFFER_MESES_CP = 3;

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

function montarTaxasPlataformaPorMes(restante: number, N_obra: number): number[] {
  const n = Math.max(1, N_obra);
  const out = Array.from({ length: n }, () => 0);
  const restanteAbs = Math.max(0, restante);
  if (restanteAbs === 0) return out;
  const k = Math.min(3, n);
  const parcela = r2(restanteAbs / k);
  let acc = 0;
  for (let i = 0; i < k - 1; i += 1) {
    out[i] = parcela;
    acc += parcela;
  }
  out[k - 1] = r2(restanteAbs - acc);
  return out;
}

/**
 * Caixa da parcela única que não quita o lote — financia a obra antes do CP.
 * `valor_pago_ao_lote` é a quitação (saldo do lote na única), não o preço cheio do lote.
 */
function excedenteParcelaUnica(parcela_unica: number, valor_pago_ao_lote: number): number {
  return Math.max(0, (parcela_unica ?? 0) - (valor_pago_ao_lote ?? 0));
}

function simularFase2(params: {
  N_obra: number;
  custo_obra: number;
  desembolhos: number[];
  taxa_gestao_mes: number;
  taxas_plataforma_mes: number[];
  parcela_mensal: number;
  taxa_cp: number;
  excedente_parcela_unica: number;
  tipo_juros_cp: 'mes_a_mes' | 'total';
}): { dados: DadosFase2[]; juros_obra_total: number } {
  const n = Math.max(1, params.N_obra);
  const taxa = Math.max(0, params.taxa_cp ?? 0);
  const parcela = Math.max(0, params.parcela_mensal ?? 0);
  const tipo = params.tipo_juros_cp === 'total' ? 'total' : 'mes_a_mes';

  const desembolsoObra: number[] = [];
  const saidasMes: number[] = [];
  const desembolsoTotalMes: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const peso = params.desembolhos[i] ?? 0;
    const obra = Math.max(0, params.custo_obra ?? 0) * peso;
    const plat = params.taxas_plataforma_mes[i] ?? 0;
    const saidas = obra + (params.taxa_gestao_mes ?? 0) + plat;
    desembolsoObra.push(obra);
    saidasMes.push(saidas);
    desembolsoTotalMes.push(saidas);
  }

  const cpSacado: number[] = [];
  let excedente_restante = Math.max(0, params.excedente_parcela_unica ?? 0);
  for (let i = 0; i < n; i += 1) {
    const desembolso_total_mes = desembolsoTotalMes[i] ?? 0;
    const entradas_cliente_mes = tipo === 'mes_a_mes' ? parcela : 0;
    const cp_necessario_mes = Math.max(0, desembolso_total_mes - entradas_cliente_mes);
    let cp_sacado_mes = 0;
    if (excedente_restante >= cp_necessario_mes) {
      excedente_restante -= cp_necessario_mes;
      cp_sacado_mes = 0;
    } else {
      cp_sacado_mes = cp_necessario_mes - excedente_restante;
      excedente_restante = 0;
    }
    cpSacado.push(cp_sacado_mes);
  }

  const dados: DadosFase2[] = [];

  if (tipo === 'total') {
    const total_cp_sacado = cpSacado.reduce((acc, v) => acc + v, 0);
    const base_juros = total_cp_sacado;
    const meses_juros = n + BUFFER_MESES_CP;
    const juros_total = base_juros * ((1 + taxa) ** meses_juros - 1);
    const parcela_juros_por_mes = n > 1 ? r2(juros_total / n) : juros_total;
    let saldo_cp = 0;
    let juros_acc = 0;
    for (let E = 1; E <= n; E += 1) {
      const i = E - 1;
      const juros_mes = E === n ? r2(juros_total - juros_acc) : parcela_juros_por_mes;
      juros_acc += juros_mes;
      const cp_sacado_mes = cpSacado[i] ?? 0;
      saldo_cp += cp_sacado_mes;
      if (E === n) saldo_cp += juros_total;
      dados.push({
        desembolso: desembolsoObra[i] ?? 0,
        saidas: saidasMes[i] ?? 0,
        juros: juros_mes,
        saldo: Math.max(0, saldo_cp),
      });
    }
    return { dados, juros_obra_total: juros_total };
  }

  let saldo_cp = 0;
  let juros_obra_total = 0;
  for (let E = 1; E <= n; E += 1) {
    const i = E - 1;
    const cp_sacado_mes = cpSacado[i] ?? 0;
    let juros_mes = saldo_cp * taxa;
    saldo_cp = saldo_cp + cp_sacado_mes + juros_mes;
    if (E === n) {
      const juros_buffer = Math.max(0, saldo_cp) * ((1 + taxa) ** BUFFER_MESES_CP - 1);
      juros_mes += juros_buffer;
      saldo_cp += juros_buffer;
    }
    juros_obra_total += juros_mes;
    dados.push({
      desembolso: desembolsoObra[i] ?? 0,
      saidas: saidasMes[i] ?? 0,
      juros: juros_mes,
      saldo: Math.max(0, saldo_cp),
    });
  }

  return { dados, juros_obra_total };
}

type DadosFase1 = {
  lot_balance_inicio: number;
  lot_balance_fim: number;
  juros_lote_total: number;
  min_quitar_lote: number;
  juros_last: number;
  reserva_caixa: number;
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
  let reserva_caixa = 0;

  for (let M = 1; M <= params.prazo_meses - 1; M += 1) {
    const juros_mes = lot_balance * params.taxa_parcelado;
    juros_lote_total += juros_mes;
    lot_balance = lot_balance * (1 + params.taxa_parcelado);
    const loteQuitado = lot_balance <= 0;
    if (loteQuitado) {
      reserva_caixa += params.parcela_mensal;
    } else {
      lot_balance -= params.parcela_mensal;
      if (lot_balance < 0) lot_balance = 0;
    }
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
      saidas_total: r2(loteQuitado ? 0 : params.parcela_mensal),
      pagamento_loteadora: r2(loteQuitado ? 0 : params.parcela_mensal),
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
    lot_balance_fim: Math.max(0, lot_balance),
    juros_lote_total,
    min_quitar_lote,
    juros_last,
    reserva_caixa,
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

export function calcularOferta(
  template: TemplateConfig,
  oferta: OfertaConfig,
  valorAcoplamento = 0,
): ResultadoCalculo {
  const valor_lote = Math.max(0, n0(oferta.valor_lote));
  const valor_casa = Math.max(0, n0(oferta.valor_casa));
  const valor_customizacao = Math.max(0, n0(oferta.valor_customizacao));
  const valor_acoplamento = Math.max(0, n0(oferta.valor_acoplamento ?? valorAcoplamento));
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

  /**
   * Acoplamento é custo de obra. Toda base percentual da construção parte de
   * valor_casa + valorAcoplamento. Lote (ITBI, juros parcelado) fica só em valor_lote.
   */
  const valor_casa_obra = valor_casa + valor_acoplamento;
  const custo_obra = valor_casa_obra + valor_customizacao;
  const base_calc = valor_lote + custo_obra;

  const itbi_amount = n0(template.percentual_itbi) * valor_lote;
  const taxa_plataforma_amount = n0(template.percentual_taxa_plataforma) * custo_obra;
  const taxa_gestao_amount =
    template.tipo_taxa_gestao === 'fixo'
      ? Math.max(0, n0(template.percentual_taxa_gestao))
      : n0(template.percentual_taxa_gestao) * custo_obra;
  const fracPlatEntrada = Math.min(1, Math.max(0, n0(template.percentual_plataforma_entrada)));
  const usaPlatEntrada = fracPlatEntrada > 0;
  const taxa_plataforma_entrada = usaPlatEntrada ? r2(taxa_plataforma_amount * fracPlatEntrada) : 0;
  const taxa_plataforma_restante = r2(taxa_plataforma_amount - taxa_plataforma_entrada);
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
  /**
   * O já pago à loteadora amortiza o lote. Se for só adiantamento da entrada mínima,
   * o saldo (e a parcela única) não muda; se passar da entrada, o extra reduz a quitação
   * e conta nos 30% do VTE.
   */
  const amortizado_lote = Math.max(entrada_do_lote_definida, ja_pago_loteadora);
  const lot_balance_preco = Math.max(0, valor_lote - amortizado_lote);
  const entrada_mes0_fluxo = entrada_do_lote + comissao_amount + taxa_plataforma_entrada;
  const entrada_total = comissao_amount + amortizado_lote + taxa_plataforma_entrada;

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
  const taxas_plataforma_mes = montarTaxasPlataformaPorMes(taxa_plataforma_restante, N_obra);
  const lucros_cp = lucro_loteadora_amount + lucro_moni_amount + lucro_franqueado_amount;
  const tipo_juros_cp: 'mes_a_mes' | 'total' =
    template.tipo_juros_cp === 'total' ? 'total' : 'mes_a_mes';

  const paramsFase2 = {
    N_obra,
    custo_obra,
    desembolhos,
    taxa_gestao_mes,
    taxas_plataforma_mes,
    parcela_mensal,
    taxa_cp,
    tipo_juros_cp,
  };

  /**
   * Fase 2 e VTE são circulares: impostos entram na base do CP, juros entram no VTP
   * e o VTP define impostos. Itera até os juros estabilizarem (tol. R$1).
   */
  let juros_obra_total = 0;
  let VTP = VTP_base;
  let impostos_amount = 0;
  let VTE = VTP_base + comissao_amount;
  let total_pago_ate_aqui = 0;
  let min_atingir_30pct = 0;
  let parcela_unica = parcela_unica_necessaria;

  const MAX_ITERS_F2 = 8;
  const TOL_JUROS = 1;

  for (let i = 0; i < MAX_ITERS_F2; i += 1) {
    const jurosAnterior = juros_obra_total;
    const sim = simularFase2({
      ...paramsFase2,
      excedente_parcela_unica: excedenteParcelaUnica(parcela_unica, min_quitar_lote),
      tipo_juros_cp,
    });
    juros_obra_total = sim.juros_obra_total;

    VTP = VTP_base + juros_obra_total + juros_lote_total;
    impostos_amount = n0(template.percentual_impostos) * VTP;
    VTE = VTP + impostos_amount + comissao_amount;

    total_pago_ate_aqui = entrada_total + prazo_meses * parcela_mensal;
    min_atingir_30pct = Math.max(0, 0.3 * VTE - total_pago_ate_aqui);
    parcela_unica = Math.max(min_quitar_lote, min_atingir_30pct);

    if (i > 0 && Math.abs(juros_obra_total - jurosAnterior) < TOL_JUROS) {
      break;
    }
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

  const entrada_do_lote_fluxo = Math.max(
    0,
    n0(entrada_fluxo) - comissao_amount - taxa_plataforma_entrada,
  );
  const saldo_lote_antes_mes0 = Math.max(0, valor_lote - ja_pago_loteadora);
  const loteQuitadoMes0 = saldo_lote_antes_mes0 <= 0;
  /**
   * Mês 0 com lote quitado: pagamento_loteadora = min(saldo, entrada) = 0.
   * O que seria entrada do lote (excedente sobre a sugerida) vai para reserva
   * e reduz o CP, como as mensais da Fase 1. Comissão permanece como saída.
   * Lote com saldo: Mês 0 inalterado.
   */
  const pag_lote_mes0 = loteQuitadoMes0
    ? Math.min(saldo_lote_antes_mes0, n0(entrada_fluxo))
    : entrada_do_lote_fluxo;
  const reserva_mes0 = loteQuitadoMes0 ? entrada_do_lote_fluxo : 0;
  const lot_balance_fluxo_conf = loteQuitadoMes0
    ? 0
    : Math.max(0, valor_lote - ja_pago_loteadora - entrada_do_lote_fluxo);
  const saidas_mes0 = loteQuitadoMes0
    ? Math.max(0, n0(entrada_fluxo) - reserva_mes0)
    : n0(entrada_fluxo);
  const fase1Fluxo = simularFase1Lote({
    prazo_meses,
    parcela_mensal: mensal_fluxo,
    taxa_parcelado,
    lot_balance_inicio: lot_balance_fluxo_conf,
  });
  const quitacao_real_fluxo = fase1Fluxo.min_quitar_lote;
  const loteQuitadoUnica = fase1Fluxo.lot_balance_fim * (1 + taxa_parcelado) <= 0;
  const mensal_unica_lote = loteQuitadoUnica ? 0 : mensal_fluxo;
  const reserva_fase1 =
    reserva_mes0 + fase1Fluxo.reserva_caixa + (loteQuitadoUnica ? mensal_fluxo : 0);
  const pag_loteadora_unica = mensal_unica_lote + quitacao_real_fluxo;
  /**
   * Caixa do mês da parcela única = quitação real do lote (fluxo) + mensal (se for à loteadora) + ITBI.
   * Com lote quitado, a mensal fica em reserva e não sai do caixa da Moní.
   */
  const saidas_unica = mensal_unica_lote + quitacao_real_fluxo + itbi_amount;

  /** Lucros + impostos no último mês de obra — só saidas_total da entrega, não entram no CP. */
  const liquidacao_entrega = lucros_cp + impostos_amount;
  const fase2Fluxo = simularFase2({
    ...paramsFase2,
    parcela_mensal: mensal_fluxo,
    excedente_parcela_unica:
      excedenteParcelaUnica(parcela_unica_fluxo, quitacao_real_fluxo) +
      Math.max(0, reserva_fase1 ?? 0),
    tipo_juros_cp,
  });
  const saldo_cp_final = fase2Fluxo.dados.length > 0 ? fase2Fluxo.dados[fase2Fluxo.dados.length - 1].saldo : 0;
  const total_parcelas_mensais_fase2 = N_obra * mensal_fluxo;
  const saldo_financiar = Math.max(
    0,
    tipo_juros_cp === 'total'
      ? saldo_cp_final + lucros_cp + impostos_amount - total_parcelas_mensais_fase2
      : saldo_cp_final + lucros_cp + impostos_amount,
  );

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
      descricao: usaPlatEntrada
        ? 'Entrada (comissão + entrada do lote + plataforma)'
        : 'Entrada (comissão + entrada do lote)',
      entrada_cliente: r2(caixa_mes0),
      saidas_obra: 0,
      saldo_lote: r2(fase1Fluxo.lot_balance_inicio),
      juros_lote_mes: 0,
      desembolso_obra: 0,
      saldo_credito_ponte: 0,
      juros_obra_mes: 0,
      saidas_total: r2(saidas_mes0),
      pagamento_loteadora: r2(pag_lote_mes0),
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
    valor_casa: r2(valor_casa),
    valor_customizacao: r2(valor_customizacao),
    valor_acoplamento: r2(valor_acoplamento),
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

