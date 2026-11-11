/**
 * Réguas do modo recursos próprios. Função pura: usa calcularOferta
 * e não grava nada. A tela e o servidor chamam este módulo.
 */
import {
  calcularOferta,
  formatarMoeda,
  mensagemEntradaMinima,
  mensagemPagamentoAMaiorRecursosProprios,
  mensagemParcelaMensalMinima,
  pagamentoAMaiorBloqueia,
  sugerirParcelaMensal,
  type OfertaConfig,
  type ResultadoCalculo,
  type TemplateConfig,
} from '@/lib/simulador/calcular-oferta';

export const AVISO_REGUA_AJUSTADA = 'Ajustado para manter o valor total';

export type CampoReguaRp = 'entrada' | 'mensal' | 'unica' | 'fixa';
export type ModoParcelasObra = 'variavel' | 'fixa';

export type EstadoReguasRp = {
  entrada: number;
  mensal: number;
  unica: number;
  modo: ModoParcelasObra;
  fixa: number;
  /** No modo fixo, quem cobre a falta de caixa. */
  ancora: 'fixa' | 'unica';
};

export type LimiteReguaRp = {
  campo: CampoReguaRp;
  valor: number;
  minimo: number;
  maximo: number;
  aviso: string | null;
};

export type ReguasAplicadas = {
  estado: EstadoReguasRp;
  resultado: ResultadoCalculo;
  limites: LimiteReguaRp[];
  ultimaParcela: number;
};

export type ValidacaoReguasRp =
  | { ok: true; aplicado: ReguasAplicadas }
  | { ok: false; error: string };

function ofertaLimpa(base: OfertaConfig): OfertaConfig {
  return {
    valor_lote: base.valor_lote,
    valor_casa: base.valor_casa,
    valor_customizacao: base.valor_customizacao,
    valor_acoplamento: base.valor_acoplamento,
    valor_ja_pago: base.valor_ja_pago,
    prazo_meses: base.prazo_meses,
    parcela_mensal: base.parcela_mensal,
    renda_cliente: base.renda_cliente,
    prazo_financiamento_anos: base.prazo_financiamento_anos,
    taxa_financiamento_anual: base.taxa_financiamento_anual,
    modalidade: 'recursos_proprios',
  };
}

function paraOferta(base: OfertaConfig, st: EstadoReguasRp): OfertaConfig {
  return {
    ...ofertaLimpa(base),
    entrada_confirmada: st.entrada,
    mensal_confirmada: st.mensal,
    parcela_unica_confirmada: st.unica,
    modo_parcelas_obra: st.modo,
    parcela_fixa_obra: st.fixa,
    ancora_cobertura: st.ancora === 'fixa' ? 'parcela_fixa' : 'parcela_unica',
  };
}

function simular(template: TemplateConfig, base: OfertaConfig, st: EstadoReguasRp): ResultadoCalculo {
  return calcularOferta(template, paraOferta(base, st), base.valor_acoplamento);
}

function ok(template: TemplateConfig, base: OfertaConfig, st: EstadoReguasRp): boolean {
  const resultado = simular(template, base, st);
  const pago = resultado.fluxo.reduce((acc, linha) => acc + linha.entrada_cliente, 0);
  return !pagamentoAMaiorBloqueia(resultado.valor_pago_a_maior) && Math.abs(pago - resultado.vte) <= 1;
}

function camposDe(st: EstadoReguasRp): CampoReguaRp[] {
  return st.modo === 'fixa' ? ['entrada', 'mensal', 'unica', 'fixa'] : ['entrada', 'mensal', 'unica'];
}

function ordemDe(st: EstadoReguasRp): CampoReguaRp[] {
  return st.modo === 'fixa' ? ['fixa', 'unica', 'mensal', 'entrada'] : ['unica', 'mensal', 'entrada'];
}

function valorDe(st: EstadoReguasRp, campo: CampoReguaRp): number {
  if (campo === 'entrada') return st.entrada;
  if (campo === 'mensal') return st.mensal;
  if (campo === 'unica') return st.unica;
  return st.fixa;
}

function comValor(st: EstadoReguasRp, campo: CampoReguaRp, valor: number): EstadoReguasRp {
  if (campo === 'entrada') return { ...st, entrada: valor };
  if (campo === 'mensal') return { ...st, mensal: valor };
  if (campo === 'unica') return { ...st, unica: valor };
  return { ...st, fixa: valor };
}

function minFor(
  template: TemplateConfig,
  base: OfertaConfig,
  campo: CampoReguaRp,
  st: EstadoReguasRp,
  entradaMinima: number,
  piso: number,
): number {
  if (campo === 'entrada') return entradaMinima;
  if (campo === 'mensal' || campo === 'fixa') return piso;
  const r = simular(template, base, st).personalizacao_rp;
  if (!r) return 0;
  return st.modo === 'fixa' && st.ancora === 'fixa' ? r.unica_minima_cobertura : r.quitacao_terreno;
}

function maiorViavel(
  template: TemplateConfig,
  base: OfertaConfig,
  st: EstadoReguasRp,
  campo: CampoReguaRp,
  lo: number,
  hi: number,
): number {
  if (!ok(template, base, comValor(st, campo, lo))) return lo;
  if (ok(template, base, comValor(st, campo, hi))) return hi;
  let a = lo;
  let b = hi;
  for (let i = 0; i < 50; i += 1) {
    const m = (a + b) / 2;
    if (ok(template, base, comValor(st, campo, m))) a = m;
    else b = m;
  }
  return a;
}

function maxFor(
  template: TemplateConfig,
  base: OfertaConfig,
  campo: CampoReguaRp,
  st: EstadoReguasRp,
  entradaMinima: number,
  piso: number,
): number {
  let t: EstadoReguasRp = { ...st };
  if (t.modo === 'fixa') t = { ...t, ancora: campo === 'fixa' ? 'fixa' : 'unica' };
  for (const g of ['entrada', 'mensal', 'fixa'] as const) {
    if (g !== campo && camposDe(t).includes(g)) {
      t = comValor(t, g, minFor(template, base, g, t, entradaMinima, piso));
    }
  }
  if (campo !== 'unica') t = { ...t, unica: 0 };
  const lo = minFor(template, base, campo, t, entradaMinima, piso);
  const teto = simular(template, base, t).vte;
  return Math.max(lo, maiorViavel(template, base, t, campo, lo, teto));
}

function fixarEfetivos(
  template: TemplateConfig,
  base: OfertaConfig,
  st: EstadoReguasRp,
): EstadoReguasRp {
  const p = simular(template, base, st).personalizacao_rp;
  if (!p) return st;
  return {
    ...st,
    unica: p.parcela_unica,
    fixa: st.modo === 'fixa' && p.parcela_fixa != null ? p.parcela_fixa : st.fixa,
  };
}

function acomodar(
  template: TemplateConfig,
  base: OfertaConfig,
  st: EstadoReguasRp,
  mudou: CampoReguaRp | null,
  entradaMinima: number,
  piso: number,
): { estado: EstadoReguasRp; avisos: Partial<Record<CampoReguaRp, string>> } {
  const avisos: Partial<Record<CampoReguaRp, string>> = {};
  let atual = { ...st };
  if (atual.modo === 'fixa' && mudou) {
    atual = { ...atual, ancora: mudou === 'fixa' ? 'fixa' : 'unica' };
  }
  const antes = { ...atual };
  for (const g of ordemDe(atual)) {
    if (g === mudou) continue;
    if (ok(template, base, atual)) break;
    const mn = minFor(template, base, g, atual, entradaMinima, piso);
    atual = comValor(atual, g, maiorViavel(template, base, atual, g, mn, valorDe(atual, g)));
  }
  for (const f of camposDe(atual)) {
    if (f === mudou) continue;
    atual = comValor(atual, f, Math.max(valorDe(atual, f), minFor(template, base, f, atual, entradaMinima, piso)));
  }
  atual = fixarEfetivos(template, base, atual);
  for (const g of camposDe(atual)) {
    if (g === mudou) continue;
    if (Math.abs(valorDe(atual, g) - valorDe(antes, g)) > 0.5) avisos[g] = AVISO_REGUA_AJUSTADA;
  }
  return { estado: atual, avisos };
}

function referencia(template: TemplateConfig, base: OfertaConfig) {
  const piso = sugerirParcelaMensal(base.valor_lote);
  const resultado = calcularOferta(template, ofertaLimpa(base), base.valor_acoplamento);
  return { piso, entradaMinima: resultado.entrada_sugerida, resultado };
}

function montar(
  template: TemplateConfig,
  base: OfertaConfig,
  estado: EstadoReguasRp,
  avisos: Partial<Record<CampoReguaRp, string>>,
): ReguasAplicadas {
  const { piso, entradaMinima } = referencia(template, base);
  const resultado = simular(template, base, estado);
  const ultima = resultado.personalizacao_rp?.ultima_parcela ?? 0;
  const limites = camposDe(estado).map((campo) => {
    const minimo = minFor(template, base, campo, estado, entradaMinima, piso);
    const maximo = Math.max(minimo, maxFor(template, base, campo, estado, entradaMinima, piso));
    return {
      campo,
      valor: valorDe(estado, campo),
      minimo,
      maximo,
      aviso: avisos[campo] ?? null,
    };
  });
  return {
    estado,
    resultado,
    limites,
    ultimaParcela: ultima < 1 ? 0 : ultima,
  };
}

export function estadoInicialReguasRp(template: TemplateConfig, base: OfertaConfig): ReguasAplicadas {
  const { piso, resultado } = referencia(template, base);
  const quitacao = resultado.personalizacao_rp?.quitacao_terreno ?? 0;
  const estado: EstadoReguasRp = {
    entrada: resultado.entrada_sugerida,
    mensal: Math.max(base.parcela_mensal, piso),
    unica: quitacao,
    modo: 'variavel',
    fixa: piso,
    ancora: 'fixa',
  };
  return montar(template, base, estado, {});
}

export function moverReguaRp(
  template: TemplateConfig,
  base: OfertaConfig,
  estado: EstadoReguasRp,
  campo: CampoReguaRp,
  valor: number,
): ReguasAplicadas {
  const { piso, entradaMinima } = referencia(template, base);
  let atual: EstadoReguasRp = { ...estado };
  if (atual.modo === 'fixa') atual = { ...atual, ancora: campo === 'fixa' ? 'fixa' : 'unica' };
  const mn = minFor(template, base, campo, atual, entradaMinima, piso);
  const mx = Math.max(mn, maxFor(template, base, campo, atual, entradaMinima, piso));
  const pedido = Number.isFinite(valor) ? valor : mn;
  atual = comValor(atual, campo, Math.min(Math.max(pedido, mn), mx));
  const acomodado = acomodar(template, base, atual, campo, entradaMinima, piso);
  return montar(template, base, acomodado.estado, acomodado.avisos);
}

export function definirModoReguasRp(
  template: TemplateConfig,
  base: OfertaConfig,
  estado: EstadoReguasRp,
  modo: ModoParcelasObra,
): ReguasAplicadas {
  if (estado.modo === modo) return montar(template, base, estado, {});
  const { piso, entradaMinima } = referencia(template, base);
  const antes = { ...estado };
  let atual: EstadoReguasRp = { ...estado, modo };
  if (modo === 'fixa') {
    const variavel = simular(template, base, { ...atual, modo: 'variavel' });
    const pays = variavel.fluxo.filter((l) => l.fase === 'fase2');
    const media = pays.reduce((acc, l) => acc + l.entrada_cliente, 0) / Math.max(1, pays.length);
    atual = { ...atual, ancora: 'fixa', fixa: Math.max(piso, media) };
  } else {
    const quitacao = simular(template, base, { ...atual, modo: 'variavel', unica: 0 }).personalizacao_rp
      ?.quitacao_terreno ?? 0;
    atual = { ...atual, unica: quitacao };
  }
  const mudou = modo === 'fixa' ? 'fixa' : null;
  const acomodado = acomodar(template, base, atual, mudou, entradaMinima, piso);
  const avisos = { ...acomodado.avisos };
  if (modo === 'variavel' && Math.abs(acomodado.estado.unica - antes.unica) > 0.5) {
    avisos.unica = AVISO_REGUA_AJUSTADA;
  }
  return montar(template, base, acomodado.estado, avisos);
}

function mensagemAbaixo(campo: CampoReguaRp, minimo: number, quitacao: number): string {
  if (campo === 'entrada') return mensagemEntradaMinima(minimo);
  if (campo === 'mensal' || campo === 'fixa') return mensagemParcelaMensalMinima(minimo);
  if (Math.abs(minimo - quitacao) <= 1) {
    return `A parcela única precisa ser de pelo menos ${formatarMoeda(minimo)} para quitar o terreno.`;
  }
  return `A parcela única precisa ser de pelo menos ${formatarMoeda(minimo)}.`;
}

export function validarReguasRp(
  template: TemplateConfig,
  base: OfertaConfig,
  estado: EstadoReguasRp,
): ValidacaoReguasRp {
  const aplicado = montar(template, base, estado, {});
  const quitacao = aplicado.resultado.personalizacao_rp?.quitacao_terreno ?? 0;
  for (const limite of aplicado.limites) {
    if (limite.valor < limite.minimo - 1) {
      return { ok: false, error: mensagemAbaixo(limite.campo, limite.minimo, quitacao) };
    }
    if (limite.valor > limite.maximo + 1) {
      return { ok: false, error: `O valor não pode passar de ${formatarMoeda(limite.maximo)}.` };
    }
  }
  const efetivo = aplicado.resultado.personalizacao_rp;
  if (
    efetivo &&
    (Math.abs(efetivo.parcela_unica - estado.unica) > 1 ||
      (estado.modo === 'fixa' &&
        efetivo.parcela_fixa != null &&
        Math.abs(efetivo.parcela_fixa - estado.fixa) > 1))
  ) {
    return { ok: false, error: 'A simulação não fecha com esses valores.' };
  }
  const pago = aplicado.resultado.fluxo.reduce((acc, l) => acc + l.entrada_cliente, 0);
  if (pagamentoAMaiorBloqueia(aplicado.resultado.valor_pago_a_maior) || Math.abs(pago - aplicado.resultado.vte) > 1) {
    return {
      ok: false,
      error: pagamentoAMaiorBloqueia(aplicado.resultado.valor_pago_a_maior)
        ? mensagemPagamentoAMaiorRecursosProprios(aplicado.resultado.valor_pago_a_maior)
        : 'A simulação não fecha com esses valores.',
    };
  }
  return { ok: true, aplicado };
}
