import { parseDecimalInput } from '@/lib/condominios';
import { parseMoneyText } from '@/lib/dashboard-novos-negocios/parseMoney';
import type { TemplateConfig } from '@/lib/simulador/calcular-oferta';

export type PremissaEntradaTipo = 'percentual' | 'valor_fixo';

export type PremissaEntrada = {
  tipo: PremissaEntradaTipo;
  valor: number;
};

/** Fração no banco (0.025 = 2,5% a.m.). */
export const JUROS_CREDITO_PONTE_PADRAO_FRACAO = 0.025;
export const JUROS_CREDITO_PONTE_PADRAO_UI = '2,5';
export const TAXA_JUROS_FINANCIAMENTO_ANUAL_PADRAO_FRACAO = 0.1;
export const TAXA_JUROS_FINANCIAMENTO_ANUAL_PADRAO_UI = '10';
export const PCT_ITBI_PADRAO_UI = '3';
export const PCT_IMPOSTOS_PADRAO_UI = '4,4';
export const PCT_TAXA_PLATAFORMA_PADRAO_UI = '8';
export const PCT_TAXA_GESTAO_PADRAO_UI = '7';
export const PCT_COMISSAO_CORRETOR_PADRAO_UI = '5';
export const PRAZO_OBRA_MESES_PADRAO = 7;
export const PRAZO_OBRA_MESES_MINIMO = 3;

export const TOAST_TEMPLATE_SALVO = 'Template salvo!';

export type LoteamentoSimuladorTemplateRow = {
  id: string;
  kanban_card_id: string | null;
  rede_loteador_id: string | null;
  nome: string | null;
  pct_itbi: number;
  pct_taxa_plataforma: number;
  pct_taxa_gestao: number;
  pct_lucro_loteadora: number;
  pct_lucro_moni: number;
  pct_lucro_franqueado: number;
  pct_impostos: number;
  pct_comissao_corretor: number;
  taxa_juros_credito_ponte: number;
  taxa_juros_financiamento_anual: number | null;
  taxa_juros_parcelado_mes: number | null;
  valor_lote_padrao: number | null;
  entrada_minima_loteadora: PremissaEntrada | null;
  premissa_entrada_lote_parcial: PremissaEntrada | null;
  premissa_entrada_lote_nao_pago: PremissaEntrada | null;
  prazo_obra_meses: number;
  prazo_desembolso_sugerido: number;
  curva_desembolso_override: unknown | null;
  link_token: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type LoteamentoSimuladorTemplateDraft = {
  nome: string;
  pct_itbi: string;
  pct_impostos: string;
  taxa_juros_credito_ponte: string;
  taxa_juros_financiamento_anual: string;
  pct_taxa_plataforma: string;
  pct_taxa_gestao: string;
  pct_lucro_loteadora: string;
  pct_lucro_moni: string;
  pct_lucro_franqueado: string;
  pct_comissao_corretor: string;
  entrada_minima_tipo: PremissaEntradaTipo;
  entrada_minima_valor: string;
  taxa_juros_parcelado_mes: string;
  prazo_obra_meses: string;
};

export const PCT_FIELDS = [
  { key: 'pct_itbi', label: 'ITBI', hint: 'Sobre o valor do lote, pago na quitação.', placeholder: PCT_ITBI_PADRAO_UI },
  {
    key: 'pct_impostos',
    label: 'Impostos',
    hint: 'Sobre o VTP (exceto corretagem); pago no último mês.',
    placeholder: PCT_IMPOSTOS_PADRAO_UI,
  },
  {
    key: 'taxa_juros_credito_ponte',
    label: 'Juros do crédito-ponte',
    hint: 'Taxa mensal (a.m.). Padrão 2,5%.',
    placeholder: JUROS_CREDITO_PONTE_PADRAO_UI,
  },
  {
    key: 'taxa_juros_financiamento_anual',
    label: 'Taxa de juros do financiamento',
    hint: 'Taxa anual (a.a.). Padrão 10%.',
    placeholder: TAXA_JUROS_FINANCIAMENTO_ANUAL_PADRAO_UI,
    suffix: ' (% ao ano)',
  },
  {
    key: 'pct_taxa_plataforma',
    label: 'Taxa de plataforma',
    hint: 'Sobre custo da casa + lote; parcelas iguais na obra.',
    placeholder: PCT_TAXA_PLATAFORMA_PADRAO_UI,
  },
  {
    key: 'pct_taxa_gestao',
    label: 'Taxa de gestão',
    hint: 'Sobre custo da casa + lote; parcelas iguais na obra.',
    placeholder: PCT_TAXA_GESTAO_PADRAO_UI,
  },
  {
    key: 'pct_lucro_loteadora',
    label: 'Lucro loteadora',
    hint: 'Sobre custo da casa + lote; pago no último mês.',
  },
  {
    key: 'pct_lucro_moni',
    label: 'Lucro Moní',
    hint: 'Sobre custo da casa + lote; pago no último mês.',
  },
  {
    key: 'pct_lucro_franqueado',
    label: 'Lucro franqueado',
    hint: 'Sobre custo da casa + lote; pago no último mês.',
  },
  {
    key: 'pct_comissao_corretor',
    label: 'Comissão do corretor',
    hint: 'Sobre o VTP; paga na entrada.',
    placeholder: PCT_COMISSAO_CORRETOR_PADRAO_UI,
  },
] as const satisfies ReadonlyArray<{
  key: keyof Pick<
    LoteamentoSimuladorTemplateDraft,
    | 'pct_itbi'
    | 'pct_impostos'
    | 'taxa_juros_credito_ponte'
    | 'taxa_juros_financiamento_anual'
    | 'pct_taxa_plataforma'
    | 'pct_taxa_gestao'
    | 'pct_lucro_loteadora'
    | 'pct_lucro_moni'
    | 'pct_lucro_franqueado'
    | 'pct_comissao_corretor'
  >;
  label: string;
  hint: string;
  placeholder?: string;
  suffix?: string;
}>;

export function emptySimuladorTemplateDraft(): LoteamentoSimuladorTemplateDraft {
  return {
    nome: '',
    pct_itbi: PCT_ITBI_PADRAO_UI,
    pct_impostos: PCT_IMPOSTOS_PADRAO_UI,
    taxa_juros_credito_ponte: JUROS_CREDITO_PONTE_PADRAO_UI,
    taxa_juros_financiamento_anual: TAXA_JUROS_FINANCIAMENTO_ANUAL_PADRAO_UI,
    pct_taxa_plataforma: PCT_TAXA_PLATAFORMA_PADRAO_UI,
    pct_taxa_gestao: PCT_TAXA_GESTAO_PADRAO_UI,
    pct_lucro_loteadora: '',
    pct_lucro_moni: '',
    pct_lucro_franqueado: '',
    pct_comissao_corretor: PCT_COMISSAO_CORRETOR_PADRAO_UI,
    entrada_minima_tipo: 'percentual',
    entrada_minima_valor: '',
    taxa_juros_parcelado_mes: '',
    prazo_obra_meses: String(PRAZO_OBRA_MESES_PADRAO),
  };
}

/** Evita "3.5" na UI: parseDecimalInput trata ponto como milhar e viraria 35. */
export function numeroParaInputBr(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '';
  const rounded = Math.round(Number(n) * 1e6) / 1e6;
  return String(rounded).replace('.', ',');
}

/**
 * Interpreta o que a Helena digitou no campo de % (3 / 3,5 / 2.5).
 * Ponto só é milhar quando há exatamente 3 dígitos depois (ex.: 1.500).
 */
export function parsePercentualUi(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, '').replace('%', '');
  if (!t) return null;
  const temVirgula = t.includes(',');
  const temPonto = t.includes('.');
  if (temVirgula && temPonto) {
    return parseDecimalInput(t);
  }
  if (temVirgula) {
    const n = Number(t.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  if (temPonto) {
    const partes = t.split('.');
    if (partes.length === 2 && partes[1].length === 3 && partes[0] !== '') {
      return parseDecimalInput(t);
    }
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Fração 0.03 → "3" na UI. */
export function fracaoParaPercentualUi(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '';
  return numeroParaInputBr(Number(n) * 100);
}

export function percentualUiParaFracao(raw: string): number {
  const n = parsePercentualUi(raw);
  if (n == null) return 0;
  return n / 100;
}

/**
 * Banco → fração mensal para o motor.
 * 0 é taxa válida (não substitui pelo padrão 2,5%).
 * Valores >= 1 foram gravados como % (2,5) em vez de fração (0,025).
 */
export function normalizarTaxaMensalFracao(
  raw: number | null | undefined,
  fallback: number = JUROS_CREDITO_PONTE_PADRAO_FRACAO,
): number {
  if (raw == null) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  if (n >= 1) return n / 100;
  return n;
}

export function parsePremissaJson(raw: unknown): PremissaEntrada | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as { tipo?: unknown; valor?: unknown };
  const tipo = o.tipo === 'valor_fixo' ? 'valor_fixo' : o.tipo === 'percentual' ? 'percentual' : null;
  const valor = typeof o.valor === 'number' ? o.valor : Number(o.valor);
  if (!tipo || !Number.isFinite(valor) || valor < 0) return null;
  return { tipo, valor };
}

function premissaParaDraft(p: PremissaEntrada | null): {
  tipo: PremissaEntradaTipo;
  valor: string;
} {
  if (!p) return { tipo: 'percentual', valor: '' };
  return {
    tipo: p.tipo,
    valor:
      p.tipo === 'percentual' ? fracaoParaPercentualUi(p.valor) : numeroParaInputBr(p.valor),
  };
}

function percentualUiOuSugestao(fracao: number | null | undefined, sugestao: string): string {
  const ui = fracaoParaPercentualUi(fracao);
  if (!ui || ui === '0') return sugestao;
  return ui;
}

export function rowToSimuladorTemplateDraft(
  row: LoteamentoSimuladorTemplateRow | null,
): LoteamentoSimuladorTemplateDraft {
  const empty = emptySimuladorTemplateDraft();
  if (!row) return empty;
  const entrada =
    row.entrada_minima_loteadora ??
    row.premissa_entrada_lote_nao_pago ??
    row.premissa_entrada_lote_parcial;
  const entradaDraft = premissaParaDraft(entrada);
  const prazo = row.prazo_obra_meses || row.prazo_desembolso_sugerido || PRAZO_OBRA_MESES_PADRAO;
  const jurosFracao = normalizarTaxaMensalFracao(row.taxa_juros_credito_ponte);
  return {
    nome: row.nome ?? '',
    pct_itbi: percentualUiOuSugestao(row.pct_itbi, PCT_ITBI_PADRAO_UI),
    pct_impostos: percentualUiOuSugestao(row.pct_impostos, PCT_IMPOSTOS_PADRAO_UI),
    taxa_juros_credito_ponte: percentualUiOuSugestao(jurosFracao, JUROS_CREDITO_PONTE_PADRAO_UI),
    taxa_juros_financiamento_anual:
      row.taxa_juros_financiamento_anual == null
        ? TAXA_JUROS_FINANCIAMENTO_ANUAL_PADRAO_UI
        : percentualUiOuSugestao(
            row.taxa_juros_financiamento_anual,
            TAXA_JUROS_FINANCIAMENTO_ANUAL_PADRAO_UI,
          ),
    pct_taxa_plataforma: percentualUiOuSugestao(row.pct_taxa_plataforma, PCT_TAXA_PLATAFORMA_PADRAO_UI),
    pct_taxa_gestao: percentualUiOuSugestao(row.pct_taxa_gestao, PCT_TAXA_GESTAO_PADRAO_UI),
    pct_lucro_loteadora: fracaoParaPercentualUi(row.pct_lucro_loteadora),
    pct_lucro_moni: fracaoParaPercentualUi(row.pct_lucro_moni),
    pct_lucro_franqueado: fracaoParaPercentualUi(row.pct_lucro_franqueado),
    pct_comissao_corretor: percentualUiOuSugestao(
      row.pct_comissao_corretor,
      PCT_COMISSAO_CORRETOR_PADRAO_UI,
    ),
    entrada_minima_tipo: entradaDraft.tipo,
    entrada_minima_valor: entradaDraft.valor,
    taxa_juros_parcelado_mes: fracaoParaPercentualUi(row.taxa_juros_parcelado_mes),
    prazo_obra_meses: String(prazo),
  };
}

export function mapTemplateRow(raw: Record<string, unknown>): LoteamentoSimuladorTemplateRow {
  const prazoDesembolso = Number(raw.prazo_desembolso_sugerido ?? PRAZO_OBRA_MESES_PADRAO);
  const prazoObraRaw = raw.prazo_obra_meses;
  const prazoObra =
    prazoObraRaw == null || prazoObraRaw === ''
      ? prazoDesembolso
      : Number(prazoObraRaw);
  return {
    id: String(raw.id),
    kanban_card_id: raw.kanban_card_id != null ? String(raw.kanban_card_id) : null,
    rede_loteador_id: raw.rede_loteador_id != null ? String(raw.rede_loteador_id) : null,
    nome: raw.nome != null ? String(raw.nome) : null,
    pct_itbi: Number(raw.pct_itbi ?? 0),
    pct_taxa_plataforma: Number(raw.pct_taxa_plataforma ?? 0),
    pct_taxa_gestao: Number(raw.pct_taxa_gestao ?? 0),
    pct_lucro_loteadora: Number(raw.pct_lucro_loteadora ?? 0),
    pct_lucro_moni: Number(raw.pct_lucro_moni ?? 0),
    pct_lucro_franqueado: Number(raw.pct_lucro_franqueado ?? 0),
    pct_impostos: Number(raw.pct_impostos ?? 0),
    pct_comissao_corretor: Number(raw.pct_comissao_corretor ?? 0),
    taxa_juros_credito_ponte: Number(raw.taxa_juros_credito_ponte ?? 0),
    taxa_juros_financiamento_anual: numOrNull(raw.taxa_juros_financiamento_anual),
    taxa_juros_parcelado_mes: numOrNull(raw.taxa_juros_parcelado_mes),
    valor_lote_padrao: raw.valor_lote_padrao == null ? null : Number(raw.valor_lote_padrao),
    entrada_minima_loteadora: parsePremissaJson(raw.entrada_minima_loteadora),
    premissa_entrada_lote_parcial: parsePremissaJson(raw.premissa_entrada_lote_parcial),
    premissa_entrada_lote_nao_pago: parsePremissaJson(raw.premissa_entrada_lote_nao_pago),
    prazo_obra_meses: Number.isFinite(prazoObra) ? prazoObra : PRAZO_OBRA_MESES_PADRAO,
    prazo_desembolso_sugerido: Number.isFinite(prazoDesembolso)
      ? prazoDesembolso
      : PRAZO_OBRA_MESES_PADRAO,
    curva_desembolso_override: raw.curva_desembolso_override ?? null,
    link_token: raw.link_token != null ? String(raw.link_token) : null,
    created_at: raw.created_at != null ? String(raw.created_at) : null,
    updated_at: raw.updated_at != null ? String(raw.updated_at) : null,
  };
}

export function montarPremissa(tipo: PremissaEntradaTipo, rawValor: string): PremissaEntrada | null {
  if (tipo === 'percentual') {
    const fracao = percentualUiParaFracao(rawValor);
    if (!rawValor.trim()) return null;
    return { tipo, valor: fracao };
  }
  const n = parseMoneyText(rawValor) ?? parseDecimalInput(rawValor);
  if (n == null) return null;
  return { tipo, valor: n };
}

export function pathSimuladorPublico(token: string | null | undefined): string | null {
  const t = String(token ?? '').trim();
  if (!t) return null;
  return `/simulador/${t}`;
}

export function isTabelaSimuladorAusente(message: string | undefined): boolean {
  // Detecta apenas erros reais de tabela ausente no schema do banco.
  // NÃO inclui o nome da tabela isolado para evitar falso positivo com PGRST116
  // ("The result contains 0 rows" que o PostgREST emite ao retornar 0 linhas com maybeSingle).
  return /schema cache|relation .* does not exist|table .* does not exist/i.test(message ?? '');
}

export function isColunaSimuladorAjusteAusente(message: string | undefined): boolean {
  return /prazo_obra_meses|entrada_minima_loteadora/i.test(message ?? '');
}

export function isColunaSimulador546Ausente(message: string | undefined): boolean {
  return /taxa_juros_parcelado_mes|taxa_juros_financiamento_anual|valor_lote|valor_casa|valor_customizacao|valor_ja_pago|prazo_meses|renda_cliente|prazo_financiamento_anos|taxa_financiamento_anual/i.test(
    message ?? '',
  );
}

export function isColunaSimulador547Ausente(message: string | undefined): boolean {
  return /parcela_mensal/i.test(message ?? '');
}

export function isColunaSimulador548Ausente(message: string | undefined): boolean {
  return /'nome' column of 'simulacoes_pagamento'|simulacoes_pagamento\.nome|column "nome" of relation "simulacoes_pagamento"/i.test(
    message ?? '',
  );
}

function numOrNull(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function percentualUiOpcionalParaFracao(raw: string): number | null {
  if (!raw.trim()) return null;
  return percentualUiParaFracao(raw);
}

export function formatarMoedaBr(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export type SimuladorOfertaDraft = {
  nome: string;
  valor_lote: string;
  valor_casa: string;
  valor_customizacao: string;
  valor_ja_pago: string;
  prazo_meses: string;
  parcela_mensal: string;
  renda_cliente: string;
  prazo_financiamento_anos: string;
  taxa_financiamento_anual: string;
  entrada_confirmada?: string;
  parcela_unica_confirmada?: string;
};

export function emptySimuladorOfertaDraft(taxaAnualUi?: string): SimuladorOfertaDraft {
  return {
    nome: '',
    valor_lote: '',
    valor_casa: '',
    valor_customizacao: '',
    valor_ja_pago: '',
    prazo_meses: '',
    parcela_mensal: '',
    renda_cliente: '',
    prazo_financiamento_anos: '',
    taxa_financiamento_anual: taxaAnualUi?.trim() || TAXA_JUROS_FINANCIAMENTO_ANUAL_PADRAO_UI,
  };
}

/** Banco (frações + JSON da entrada) → motor de cálculo. */
export function rowToTemplateConfig(row: LoteamentoSimuladorTemplateRow): TemplateConfig {
  const entrada =
    row.entrada_minima_loteadora ??
    row.premissa_entrada_lote_nao_pago ??
    row.premissa_entrada_lote_parcial;
  return {
    percentual_itbi: Number(row.pct_itbi ?? 0),
    percentual_impostos: Number(row.pct_impostos ?? 0),
    percentual_taxa_plataforma: Number(row.pct_taxa_plataforma ?? 0),
    percentual_taxa_gestao: Number(row.pct_taxa_gestao ?? 0),
    percentual_lucro_loteadora: Number(row.pct_lucro_loteadora ?? 0),
    percentual_lucro_moni: Number(row.pct_lucro_moni ?? 0),
    percentual_lucro_franqueado: Number(row.pct_lucro_franqueado ?? 0),
    percentual_comissao_corretor: Number(row.pct_comissao_corretor ?? 0),
    prazo_obra_meses: row.prazo_obra_meses || row.prazo_desembolso_sugerido || PRAZO_OBRA_MESES_PADRAO,
    taxa_juros_credito_ponte: normalizarTaxaMensalFracao(row.taxa_juros_credito_ponte),
    taxa_juros_parcelado_mes: Number(row.taxa_juros_parcelado_mes ?? 0),
    taxa_juros_financiamento_anual:
      row.taxa_juros_financiamento_anual == null
        ? TAXA_JUROS_FINANCIAMENTO_ANUAL_PADRAO_FRACAO
        : row.taxa_juros_financiamento_anual,
    entrada_minima_loteadora: entrada
      ? {
          tipo: entrada.tipo === 'valor_fixo' ? 'fixo' : 'percentual',
          valor: entrada.valor,
        }
      : null,
  };
}

export function inferirCondicaoLote(valorJaPago: number): 'nao_pago' | 'parcial' {
  return valorJaPago > 0 ? 'parcial' : 'nao_pago';
}

export const CONDICAO_LOTE_LABEL: Record<string, string> = {
  nao_pago: 'Lote não pago',
  parcial: 'Lote parcial',
  quitado: 'Lote quitado',
  recurso_proprio: 'Recurso próprio',
};

export const STATUS_SIMULACAO_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  salva: 'Salva',
  pdf_gerado: 'PDF gerado',
};

export type SimulacaoPagamentoResumo = {
  id: string;
  nome: string | null;
  condicao_lote: string;
  status: string;
  renda_informada_cliente: number | null;
  created_at: string | null;
  valor_lote: number | null;
  valor_casa: number | null;
  valor_customizacao: number | null;
  valor_ja_pago: number | null;
  prazo_meses: number | null;
  renda_cliente: number | null;
  prazo_financiamento_anos: number | null;
  taxa_financiamento_anual: number | null;
  parcela_mensal: number | null;
  entrada_confirmada: number | null;
  parcela_unica_confirmada: number | null;
  parcela_mensal_confirmada: number | null;
  template_id: string | null;
};

function inputsDaSimulacao(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
    return {};
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

function textoOuNulo(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  return s || null;
}

export function mapSimulacaoRow(raw: Record<string, unknown>): SimulacaoPagamentoResumo {
  const inp = inputsDaSimulacao(raw.inputs);
  const pick = (key: string) => numOrNull(raw[key]) ?? numOrNull(inp[key]);
  const rendaCliente = pick('renda_cliente');
  const rendaInformada = numOrNull(raw.renda_informada_cliente);
  const parcelaMensal = pick('parcela_mensal');
  return {
    id: String(raw.id),
    nome: textoOuNulo(raw.nome) ?? textoOuNulo(inp.nome),
    condicao_lote: String(raw.condicao_lote ?? ''),
    status: String(raw.status ?? ''),
    renda_informada_cliente: rendaCliente ?? rendaInformada,
    created_at: raw.created_at != null ? String(raw.created_at) : null,
    valor_lote: pick('valor_lote'),
    valor_casa: pick('valor_casa'),
    valor_customizacao: pick('valor_customizacao'),
    valor_ja_pago: pick('valor_ja_pago'),
    prazo_meses: pick('prazo_meses'),
    renda_cliente: rendaCliente ?? rendaInformada,
    prazo_financiamento_anos: pick('prazo_financiamento_anos'),
    taxa_financiamento_anual: pick('taxa_financiamento_anual'),
    parcela_mensal: parcelaMensal,
    entrada_confirmada:
      numOrNull(inp.entrada_confirmada) ??
      numOrNull(raw.entrada_confirmada) ??
      numOrNull(raw.entrada_conf),
    parcela_unica_confirmada:
      numOrNull(inp.parcela_unica_confirmada) ??
      numOrNull(raw.parcela_unica_confirmada) ??
      numOrNull(raw.parcela_unica_conf),
    parcela_mensal_confirmada:
      numOrNull(inp.parcela_mensal_confirmada) ??
      numOrNull(raw.parcela_mensal_confirmada) ??
      numOrNull(raw.parcela_mensal_conf) ??
      parcelaMensal,
    template_id: raw.template_id != null ? String(raw.template_id) : null,
  };
}
