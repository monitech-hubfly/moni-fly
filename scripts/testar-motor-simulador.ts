/**
 * Prova do motor do simulador. Roda com:
 * npx --yes tsx scripts/testar-motor-simulador.ts
 */
import {
  calcularOferta,
  calcularParcelaUnicaMinimaConfirmada,
  pagamentoAMaiorBloqueia,
  type OfertaConfig,
  type ResultadoCalculo,
  type TemplateConfig,
} from '../src/lib/simulador/calcular-oferta';
import {
  montarTemplateParaEngine,
  type TemplateFonteEngine,
} from '../src/lib/simulador/montar-template-jornada';

const SEMENTE = 20261106;
const COMBINACOES = 5000;
const TOL = 1;

type Falha = { check: string; entrada: unknown; detalhe: string };

const falhas: Falha[] = [];
const exemplos = new Map<string, Falha[]>();

function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function perto(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOL;
}

function registrar(check: string, entrada: unknown, detalhe: string) {
  const item = { check, entrada, detalhe };
  falhas.push(item);
  const lista = exemplos.get(check) ?? [];
  if (lista.length < 3) {
    lista.push(item);
    exemplos.set(check, lista);
  }
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function templateDe(fonte: TemplateFonteEngine): TemplateConfig {
  return montarTemplateParaEngine(fonte);
}

function baseFonte(extra: Partial<TemplateFonteEngine> = {}): TemplateFonteEngine {
  return {
    pct_itbi: 0.03,
    pct_impostos: 0.06,
    pct_taxa_plataforma: 0.08,
    pct_plataforma_entrada: 0.5,
    pct_taxa_gestao: 0.07,
    tipo_taxa_gestao: 'percentual',
    pct_lucro_loteadora: 0,
    pct_lucro_moni: 0.1,
    pct_lucro_franqueado: 0,
    pct_comissao_corretor: 0.06,
    taxa_juros_credito_ponte: 0.025,
    tipo_juros_cp: 'mes_a_mes',
    taxa_juros_parcelado_mes: 0,
    taxa_juros_financiamento_anual: 0.1,
    prazo_obra_meses: 7,
    entrada_minima_loteadora: { tipo: 'percentual', valor: 0.2 },
    ...extra,
  };
}

function ofertaBase(parcial: Partial<OfertaConfig> & { parcela_mensal: number }): OfertaConfig {
  return {
    valor_lote: 1_200_000,
    valor_casa: 1_000_000,
    valor_customizacao: 0,
    valor_acoplamento: 200_000,
    valor_ja_pago: 0,
    prazo_meses: 5,
    renda_cliente: 0,
    prazo_financiamento_anos: 30,
    ...parcial,
  };
}

function soma(valores: number[]): number {
  return valores.reduce((a, b) => a + b, 0);
}

function verificar(r: ResultadoCalculo, oferta: OfertaConfig, tpl: TemplateConfig, confirmar: boolean) {
  const entrada = {
    lote: oferta.valor_lote,
    casa: oferta.valor_casa,
    acoplamento: oferta.valor_acoplamento ?? 0,
    customizacao: oferta.valor_customizacao,
    jaPago: oferta.valor_ja_pago,
    prazoFase1: oferta.prazo_meses,
    obra: tpl.prazo_obra_meses,
    mensal: oferta.parcela_mensal,
    metodo: tpl.tipo_juros_cp ?? 'mes_a_mes',
    jurosLote: tpl.taxa_juros_parcelado_mes,
    entradaConfirmada: oferta.entrada_confirmada ?? null,
    mensalConfirmada: oferta.mensal_confirmada ?? null,
    unicaConfirmada: oferta.parcela_unica_confirmada ?? null,
  };
  const entradas = soma(r.fluxo.map((l) => l.entrada_cliente));
  const loteadora = soma(r.fluxo.map((l) => l.pagamento_loteadora));
  const jurosCp = soma(r.fluxo.map((l) => l.juros_obra_mes));
  const jurosLote = soma(r.fluxo.map((l) => l.juros_lote_mes));
  const teto = oferta.valor_lote + jurosLote;
  if (loteadora > teto + TOL) {
    registrar('V1', entrada, `loteadora ${r2(loteadora)} > lote + juros ${r2(teto)}`);
  }
  if (r.falta_parcela_unica <= TOL && !perto(loteadora, teto)) {
    registrar('V1', entrada, `lote quitado, loteadora ${r2(loteadora)} ≠ ${r2(teto)}`);
  }

  const construcao = oferta.valor_casa + (oferta.valor_acoplamento ?? 0) + oferta.valor_customizacao;
  const lucros = r.lucro_loteadora_amount + r.lucro_moni_amount + r.lucro_franqueado_amount;
  const direita =
    oferta.valor_lote +
    jurosLote +
    r.itbi_amount +
    r.comissao_amount +
    r.taxa_plataforma_amount +
    r.taxa_gestao_amount +
    construcao +
    lucros +
    r.impostos_amount +
    jurosCp;
  const esquerda = entradas + r.saldo_financiar - r.valor_pago_a_maior;
  if (!perto(esquerda, direita)) {
    registrar('V2', entrada, `esquerda ${r2(esquerda)} direita ${r2(direita)}`);
  }

  const mes0 = r.fluxo.find((l) => l.fase === 'mes0');
  const unica = r.fluxo.find((l) => l.fase === 'parcela_unica');
  const obra = r.fluxo.filter((l) => l.fase === 'fase2');
  const fracPlat = Math.min(1, Math.max(0, tpl.percentual_plataforma_entrada ?? 0));
  const platEntrada = r2(r.taxa_plataforma_amount * fracPlat);
  const platRest = r2(r.taxa_plataforma_amount - platEntrada);
  if (mes0 && !perto(mes0.saidas_total - mes0.pagamento_loteadora, r.comissao_amount + platEntrada)) {
    registrar('V3', entrada, `comissão/plataforma no mês 0 ${r2(mes0.saidas_total - mes0.pagamento_loteadora)}`);
  }
  if (unica && !perto(unica.saidas_total - unica.pagamento_loteadora, r.itbi_amount)) {
    registrar('V3', entrada, `ITBI ${r2(unica.saidas_total - unica.pagamento_loteadora)} ≠ ${r2(r.itbi_amount)}`);
  }
  const k = Math.min(3, obra.length);
  const parcelaPlat = k > 0 ? r2(platRest / k) : 0;
  let accPlat = 0;
  const gestaoMes = obra.length > 0 ? r.taxa_gestao_amount / obra.length : 0;
  obra.forEach((linha, i) => {
    let plat = 0;
    if (i < k - 1) plat = parcelaPlat;
    else if (i === k - 1) plat = r2(platRest - accPlat);
    if (i < k - 1) accPlat += parcelaPlat;
    const extra = linha.saidas_obra - linha.desembolso_obra;
    if (!perto(extra, gestaoMes + plat)) {
      registrar('V3', entrada, `mês ${linha.mes} gestão+plataforma ${r2(extra)} ≠ ${r2(gestaoMes + plat)}`);
    }
  });
  const construido = soma(obra.map((l) => l.desembolso_obra));
  if (!perto(construido, construcao)) {
    registrar('V3', entrada, `construção ${r2(construido)} ≠ ${r2(construcao)}`);
  }

  for (const linha of r.fluxo) {
    if (linha.saldo_lote < -TOL || linha.saldo_credito_ponte < -TOL || linha.caixa_cliente < -TOL) {
      registrar('V4', entrada, `linha ${linha.mes} ${linha.fase} negativa`);
    }
  }
  if (r.saldo_financiar < -TOL || r.caixa_final < -TOL || r.valor_pago_a_maior < -TOL) {
    registrar('V4', entrada, 'saldo ou caixa final negativo');
  }
  if (r.saldo_financiar > TOL && r.caixa_final > TOL) {
    registrar('V5', entrada, `saldo ${r.saldo_financiar} e caixa ${r.caixa_final}`);
  }
  const trava = pagamentoAMaiorBloqueia(r.valor_pago_a_maior);
  if (trava !== r.caixa_final > TOL) {
    registrar('V6', entrada, `trava ${trava} caixa ${r.caixa_final}`);
  }

  let caixaAnt = 0;
  for (const linha of r.fluxo) {
    if (linha.fase === 'fase1' && linha.saldo_lote > TOL && linha.caixa_cliente > caixaAnt + TOL) {
      registrar('V7', entrada, `mês ${linha.mes} caixa subiu com lote em aberto`);
    }
    caixaAnt = linha.caixa_cliente;
  }

  obra.forEach((linha, i) => {
    if (i === obra.length - 1) return;
    if (!perto(linha.saidas_total, linha.saidas_obra + linha.amortizacao_cp)) {
      registrar(
        'V8',
        entrada,
        `mês ${linha.mes} saídas ${linha.saidas_total} ≠ ${r2(linha.saidas_obra + linha.amortizacao_cp)}`,
      );
    }
  });

  if (!confirmar) {
    const fluxoTotal = entradas + r.saldo_financiar - r.valor_pago_a_maior;
    if (!perto(fluxoTotal, r.vte)) {
      registrar('V9', entrada, `fluxo ${r2(fluxoTotal)} ≠ resumo ${r2(r.vte)}`);
    }
  }
  return { entradas, loteadora, jurosCp };
}

function exigir(nome: string, ok: boolean, detalhe: string) {
  if (!ok) registrar(nome, nome, detalhe);
}

function casoFixo(nome: string, tpl: TemplateConfig, oferta: OfertaConfig, confirmar = false) {
  const r = calcularOferta(tpl, oferta, oferta.valor_acoplamento);
  verificar(r, oferta, tpl, confirmar);
  const entradas = r2(soma(r.fluxo.map((l) => l.entrada_cliente)));
  const saidas = r2(soma(r.fluxo.map((l) => l.saidas_total)));
  console.log(
    nome,
    JSON.stringify({
      saldo: r.saldo_financiar,
      entradas,
      saidas,
      juros: r.juros_obra_total,
      caixa: r.caixa_final,
      maior: r.valor_pago_a_maior,
      trava: pagamentoAMaiorBloqueia(r.valor_pago_a_maior),
      vte: r.vte,
      loteadora: r2(soma(r.fluxo.map((l) => l.pagamento_loteadora))),
      jurosLote: r.juros_lote_total,
      minima: r.parcela_unica_minima_display,
    }),
  );
  return r;
}

function igual(nome: string, valor: number, esperado: number) {
  exigir(nome, perto(valor, esperado), `${nome}: ${valor} ≠ ${esperado}`);
}

const rand = mulberry32(SEMENTE);
const entre = (min: number, max: number) => min + rand() * (max - min);
const inteiro = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const escolha = <T,>(itens: T[]): T => itens[Math.floor(rand() * itens.length)]!;

let pendencia = 0;
let maiorPendencia = 0;

for (let i = 0; i < COMBINACOES; i += 1) {
  const obra = inteiro(3, 7);
  const fonte = baseFonte({
    pct_itbi: entre(0.02, 0.04),
    pct_impostos: entre(0.04, 0.08),
    pct_taxa_plataforma: entre(0.04, 0.1),
    pct_plataforma_entrada: escolha([0, 0.25, 0.5, 1]),
    pct_taxa_gestao: entre(0.04, 0.1),
    pct_lucro_loteadora: entre(0, 0.05),
    pct_lucro_moni: entre(0.05, 0.15),
    pct_lucro_franqueado: entre(0, 0.05),
    pct_comissao_corretor: entre(0.04, 0.08),
    taxa_juros_credito_ponte: entre(0.01, 0.03),
    tipo_juros_cp: rand() < 0.5 ? 'mes_a_mes' : 'total',
    taxa_juros_parcelado_mes: rand() < 0.5 ? 0 : entre(0.005, 0.02),
    prazo_obra_meses: obra,
    entrada_minima_loteadora: { tipo: 'percentual', valor: entre(0.1, 0.3) },
  });
  const tpl = templateDe(fonte);
  const lote = Math.round(entre(100_000, 2_000_000));
  const modoPago = escolha(['zero', 'parcial', 'quitado'] as const);
  const jaPago = modoPago === 'zero' ? 0 : modoPago === 'quitado' ? lote : Math.round(lote * entre(0.05, 0.9));
  const oferta: OfertaConfig = {
    valor_lote: lote,
    valor_casa: Math.round(entre(200_000, 1_500_000)),
    valor_customizacao: rand() < 0.3 ? 0 : Math.round(entre(0, 80_000)),
    valor_acoplamento: rand() < 0.3 ? 0 : Math.round(entre(0, 300_000)),
    valor_ja_pago: jaPago,
    prazo_meses: inteiro(1, 18),
    parcela_mensal: rand() < 0.05 ? 0 : Math.round(entre(1_000, 80_000)),
    renda_cliente: 0,
    prazo_financiamento_anos: 30,
  };
  let r = calcularOferta(tpl, oferta, oferta.valor_acoplamento);
  verificar(r, oferta, tpl, false);

  if (rand() < 0.55) {
    const mensal = Math.round(r.parcela_mensal_usada * entre(0.2, 2.5));
    const entrada = Math.round(r.entrada_sugerida * entre(1, 1.8));
    const minima = calcularParcelaUnicaMinimaConfirmada(tpl, oferta, entrada, mensal, oferta.valor_acoplamento);
    const unica = Math.round(minima + Math.max(0, r.parcela_unica_sugerida) * entre(0, 0.4));
    const confirmada: OfertaConfig = {
      ...oferta,
      entrada_confirmada: entrada,
      mensal_confirmada: mensal,
      parcela_unica_confirmada: unica,
    };
    r = calcularOferta(tpl, confirmada, confirmada.valor_acoplamento);
    verificar(r, confirmada, tpl, true);
    const entradas = soma(r.fluxo.map((l) => l.entrada_cliente));
    const diff = Math.abs(entradas + r.saldo_financiar - r.valor_pago_a_maior - r.vte);
    if (diff > TOL) {
      pendencia += 1;
      if (diff > maiorPendencia) maiorPendencia = diff;
    }
  }
}

const tpl = templateDe(baseFonte());
const tplTotal = templateDe(baseFonte({ tipo_juros_cp: 'total' }));
const tplJuros = templateDe(baseFonte({ taxa_juros_parcelado_mes: 0.01 }));
const ofertaReal: OfertaConfig = {
  valor_lote: 100_000,
  valor_casa: 1_000_000,
  valor_customizacao: 0,
  valor_acoplamento: 200_000,
  valor_ja_pago: 0,
  prazo_meses: 5,
  parcela_mensal: 500_000,
  renda_cliente: 0,
  prazo_financiamento_anos: 30,
  entrada_confirmada: 420_000,
  mensal_confirmada: 120_000,
  parcela_unica_confirmada: 0,
};

console.log('\nCasos fixos');
const a = casoFixo('a', tpl, ofertaBase({ parcela_mensal: 500_000 }));
igual('a.saldo', a.saldo_financiar, 0);
igual('a.maior', a.valor_pago_a_maior, 3_296_640);
igual('a.m2', a.fluxo.find((l) => l.mes === 2 && l.fase === 'fase1')?.pagamento_loteadora ?? -1, 460_000);

const b = casoFixo('b', tpl, ofertaBase({ parcela_mensal: 15_000 }));
igual('b.saldo', b.saldo_financiar, 1_845_528.91);
igual('b.unica', b.parcela_unica_sugerida, 885_000);

const c = casoFixo('c', tplTotal, ofertaBase({ parcela_mensal: 15_000 }));
igual('c.saldo', c.saldo_financiar, 2_033_816.97);
igual('c.juros', c.juros_obra_total, 373_072.61);

const d = casoFixo('d', tpl, ofertaBase({ parcela_mensal: 15_000, valor_ja_pago: 300_000 }));
igual('d.saldo', d.saldo_financiar, 1_845_528.91);
igual('d.mes0', d.fluxo.find((l) => l.fase === 'mes0')?.entrada_cliente ?? -1, 219_360);
igual('d.unica', d.parcela_unica_sugerida, 825_000);

const e = casoFixo('e', tpl, ofertaBase({ parcela_mensal: 150_000 }));
igual('e.saldo', e.saldo_financiar, 744_808.98);
igual('e.juros', e.juros_obra_total, 48_536.77);
igual('e.entradas', soma(e.fluxo.map((l) => l.entrada_cliente)), 2_505_360);

const f = casoFixo(
  'f',
  tpl,
  ofertaBase({ parcela_mensal: 15_000, parcela_unica_confirmada: 1_085_000 }),
  true,
);
igual('f.saldo', f.saldo_financiar, 1_600_997.59);

const g = casoFixo('g', tpl, ofertaReal, true);
igual('g.saldo', g.saldo_financiar, 0);
igual('g.maior', g.valor_pago_a_maior, 56_440);
igual('g.m0', g.fluxo.find((l) => l.fase === 'mes0')?.pagamento_loteadora ?? -1, 100_000);
igual('g.caixa0', g.fluxo.find((l) => l.fase === 'mes0')?.caixa_cliente ?? -1, 175_220);

const h = casoFixo('h', tpl, { ...ofertaReal, mensal_confirmada: 100_000 }, true);
igual('h.saldo', h.saldo_financiar, 183_560);
igual('h.cp', Math.max(...h.fluxo.map((l) => l.saldo_credito_ponte)), 0);

const j = casoFixo('j', tpl, ofertaBase({ parcela_mensal: 15_000, entrada_confirmada: 600_000 }), true);
igual('j.m0', j.fluxo.find((l) => l.fase === 'mes0')?.pagamento_loteadora ?? -1, 380_640);
igual('j.minima', j.parcela_unica_minima_display, 744_360);

const k = casoFixo('k', tpl, ofertaBase({ parcela_mensal: 200_000 }));
const amortK = k.fluxo.filter((l) => l.fase === 'fase2' && l.etapa_obra !== 7 && l.amortizacao_cp > TOL);
exigir('k.amort', amortK.length > 0, 'nenhum mês de obra amortizou crédito-ponte');
console.log(
  'k meses',
  k.fluxo
    .filter((l) => l.fase === 'fase2')
    .map((l) => ({ mes: l.mes, caixa: l.caixa_cliente, cp: l.saldo_credito_ponte, amort: l.amortizacao_cp })),
);

const l = casoFixo('l', tpl, ofertaBase({ parcela_mensal: 70_000 }));
const obraL = l.fluxo.filter((lnh) => lnh.fase === 'fase2');
const fim = obraL[obraL.length - 1]!;
const antes = obraL[obraL.length - 2]!;
const jurosMes = antes.saldo_credito_ponte * 0.025;
const baseBuffer = antes.saldo_credito_ponte + jurosMes - fim.amortizacao_cp;
const buffer = baseBuffer * ((1.025) ** 3 - 1);
exigir('l.parcial', fim.amortizacao_cp > TOL && fim.saldo_credito_ponte > TOL, 'não quitou só uma parte');
exigir('l.buffer', perto(fim.juros_obra_mes, jurosMes + buffer), `juros ${fim.juros_obra_mes} ≠ ${r2(jurosMes + buffer)}`);
console.log('l último', {
  amort: fim.amortizacao_cp,
  cpAberto: fim.saldo_credito_ponte,
  juros: fim.juros_obra_mes,
  bufferSobre: r2(baseBuffer),
  buffer: r2(buffer),
});

const m = casoFixo('m', tplJuros, ofertaBase({ parcela_mensal: 15_000 }));
const pagoM = soma(m.fluxo.map((l) => l.pagamento_loteadora));
igual('m.loteadora', pagoM, 1_200_000 + m.juros_lote_total);

console.log('\nLimites');
casoFixo('lote quitado', tpl, ofertaBase({ parcela_mensal: 15_000, valor_ja_pago: 1_200_000 }));
const entradaMin = calcularOferta(tpl, ofertaBase({ parcela_mensal: 15_000 }), 200_000);
casoFixo(
  'entrada igual à mínima',
  tpl,
  ofertaBase({
    parcela_mensal: 15_000,
    entrada_confirmada: entradaMin.entrada_sugerida,
    mensal_confirmada: 15_000,
    parcela_unica_confirmada: entradaMin.parcela_unica_sugerida,
  }),
  true,
);
casoFixo('mensal zero', tpl, ofertaBase({ parcela_mensal: 0 }));
casoFixo('obra 3', templateDe(baseFonte({ prazo_obra_meses: 3 })), ofertaBase({ parcela_mensal: 15_000, prazo_meses: 1 }));
casoFixo('acoplamento e customização zero', tpl, ofertaBase({ parcela_mensal: 15_000, valor_acoplamento: 0, valor_customizacao: 0 }));

const jaPagoMaior = calcularOferta(tpl, ofertaBase({ parcela_mensal: 15_000, valor_ja_pago: 2_000_000 }), 200_000);
const pagMaior = soma(jaPagoMaior.fluxo.map((l) => l.pagamento_loteadora));
console.log('\nJá pago maior que o lote');
console.log(
  JSON.stringify({
    bloqueia: jaPagoMaior.alertas.some((a) => a.tipo !== 'capacidade_pagamento' && a.tipo !== 'parcela_unica_zero'),
    alertas: jaPagoMaior.alertas.map((a) => a.tipo),
    pagoALoteadora: r2(pagMaior),
    preContrato: jaPagoMaior.fluxo.find((l) => l.fase === 'pre_contrato')?.pagamento_loteadora ?? 0,
  }),
);

console.log(`\nCombinações com valores confirmados em que o resumo difere do fluxo: ${pendencia}`);
console.log(`Maior diferença: ${r2(maiorPendencia)}`);
console.log(`Falhas: ${falhas.length}`);
for (const [check, itens] of exemplos) {
  console.log(`\n${check} (${itens.length} exemplo(s) de até 3)`);
  for (const item of itens) console.log(item.detalhe, JSON.stringify(item.entrada));
}
if (falhas.length > 0) process.exit(1);
console.log(`\n${COMBINACOES} combinações aleatórias mais os casos fixos passaram nas verificações V1–V9.`);
