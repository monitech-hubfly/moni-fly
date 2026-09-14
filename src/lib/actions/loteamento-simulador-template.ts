'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isRedeStaffRole, normalizeAccessRole } from '@/lib/authz';
import { getPublicAppUrl } from '@/lib/app-url';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { isKanbanFunilLoteadoresRef } from '@/lib/kanban/loteadores-card-titulo';
import { parseDecimalInput } from '@/lib/condominios';
import { parseMoneyText } from '@/lib/dashboard-novos-negocios/parseMoney';
import {
  isColunaSimulador546Ausente,
  isColunaSimulador547Ausente,
  isColunaSimuladorAjusteAusente,
  isTabelaSimuladorAusente,
  mapTemplateRow,
  mapSimulacaoRow,
  montarPremissa,
  percentualUiParaFracao,
  percentualUiOpcionalParaFracao,
  JUROS_CREDITO_PONTE_PADRAO_FRACAO,
  TAXA_JUROS_FINANCIAMENTO_ANUAL_PADRAO_FRACAO,
  PRAZO_OBRA_MESES_MINIMO,
  TOAST_TEMPLATE_SALVO,
  inferirCondicaoLote,
  type LoteamentoSimuladorTemplateDraft,
  type LoteamentoSimuladorTemplateRow,
  type SimulacaoPagamentoResumo,
  type SimuladorOfertaDraft,
} from '@/lib/loteamento-simulador-template';

type Ok = {
  ok: true;
  template: LoteamentoSimuladorTemplateRow;
  link: string | null;
  mensagem: string;
};
type Err = { ok: false; error: string };
type AuthOk = {
  ok: true;
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
};

const TABELA = 'loteamento_simulador_templates';

async function requireStaff(): Promise<AuthOk | Err> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const access = normalizeAccessRole((profile as { role?: string } | null)?.role);
  if (!isRedeStaffRole(access)) {
    return { ok: false, error: 'Apenas administradores ou time podem configurar o template.' };
  }
  return { ok: true, supabase, userId: user.id };
}

function linkCompleto(token: string | null | undefined): string | null {
  const t = String(token ?? '').trim();
  if (!t) return null;
  return `${getPublicAppUrl()}/simulador/${t}`;
}

function mensagemTabelaAusente(): string {
  return 'Tabela do simulador ainda não existe neste banco. Aplique a migration 544 no DEV.';
}

function mensagemColunaAusente(): string {
  return 'Faltam colunas do simulador neste banco. Aplique as migrations 545, 546 e 547 no DEV.';
}

function erroBancoSimulador(message: string): Err {
  if (
    isColunaSimulador547Ausente(message) ||
    isColunaSimulador546Ausente(message) ||
    isColunaSimuladorAjusteAusente(message)
  ) {
    return { ok: false, error: mensagemColunaAusente() };
  }
  if (isTabelaSimuladorAusente(message)) {
    return { ok: false, error: mensagemTabelaAusente() };
  }
  return { ok: false, error: message };
}

async function carregarCardLoteadores(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cardId: string,
): Promise<{ ok: true; titulo: string; redeLoteadorId: string | null; loteadorNome: string | null } | Err> {
  const { data, error } = await supabase
    .from('kanban_cards')
    .select('id, titulo, kanban_id, rede_loteador_id')
    .eq('id', cardId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Card não encontrado.' };
  const row = data as {
    titulo?: string | null;
    kanban_id?: string | null;
    rede_loteador_id?: string | null;
  };
  if (!isKanbanFunilLoteadoresRef(row.kanban_id, null) && row.kanban_id !== KANBAN_IDS.LOTEADORES) {
    return { ok: false, error: 'Este card não pertence ao Funil Loteadores.' };
  }
  const redeLoteadorId = row.rede_loteador_id ? String(row.rede_loteador_id) : null;
  let loteadorNome: string | null = null;
  if (redeLoteadorId) {
    const { data: loteador } = await supabase
      .from('rede_loteadores')
      .select('nome')
      .eq('id', redeLoteadorId)
      .maybeSingle();
    loteadorNome = String((loteador as { nome?: string | null } | null)?.nome ?? '').trim() || null;
  }
  return {
    ok: true,
    titulo: String(row.titulo ?? '').trim() || 'Card sem título',
    redeLoteadorId,
    loteadorNome,
  };
}

export async function carregarSimuladorTemplateDoCard(cardId: string): Promise<
  | {
      ok: true;
      cardTitulo: string;
      loteadorNome: string | null;
      redeLoteadorId: string | null;
      template: LoteamentoSimuladorTemplateRow | null;
      link: string | null;
      simulacoes: SimulacaoPagamentoResumo[];
    }
  | Err
> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;
  const card = await carregarCardLoteadores(auth.supabase, cardId);
  if (!card.ok) return card;

  const { data, error } = await auth.supabase
    .from(TABELA)
    .select('*')
    .eq('kanban_card_id', cardId)
    .maybeSingle();

  if (error) {
    return erroBancoSimulador(error.message);
  }

  const template = data ? mapTemplateRow(data as Record<string, unknown>) : null;
  const simulacoes = template ? await listarSimulacoesDoTemplateId(auth.supabase, template.id) : [];
  return {
    ok: true,
    cardTitulo: card.titulo,
    loteadorNome: card.loteadorNome,
    redeLoteadorId: card.redeLoteadorId,
    template,
    link: linkCompleto(template?.link_token),
    simulacoes,
  };
}

function rowSemColunas546(row: Record<string, unknown>): Record<string, unknown> {
  const {
    taxa_juros_parcelado_mes,
    taxa_juros_financiamento_anual,
    ...rest
  } = row;
  void taxa_juros_parcelado_mes;
  void taxa_juros_financiamento_anual;
  return rest;
}

function rowSemColunas545(row: Record<string, unknown>): Record<string, unknown> {
  const {
    prazo_obra_meses,
    entrada_minima_loteadora,
    ...rest
  } = row;
  return {
    ...rest,
    prazo_desembolso_sugerido: prazo_obra_meses ?? rest.prazo_desembolso_sugerido,
    premissa_entrada_lote_nao_pago: entrada_minima_loteadora ?? null,
  };
}

function draftParaRow(
  draft: LoteamentoSimuladorTemplateDraft,
  ctx: { cardId: string; redeLoteadorId: string | null; userId: string; tituloCard: string },
): { ok: true; row: Record<string, unknown> } | Err {
  const prazo = parseDecimalInput(draft.prazo_obra_meses);
  if (prazo == null || prazo < PRAZO_OBRA_MESES_MINIMO) {
    return { ok: false, error: `Prazo de obra mínimo é ${PRAZO_OBRA_MESES_MINIMO} meses.` };
  }

  const nome = draft.nome.trim() || ctx.tituloCard || null;

  return {
    ok: true,
    row: {
      kanban_card_id: ctx.cardId,
      rede_loteador_id: ctx.redeLoteadorId,
      nome,
      pct_itbi: percentualUiParaFracao(draft.pct_itbi),
      pct_taxa_plataforma: percentualUiParaFracao(draft.pct_taxa_plataforma),
      pct_taxa_gestao: percentualUiParaFracao(draft.pct_taxa_gestao),
      pct_lucro_loteadora: percentualUiParaFracao(draft.pct_lucro_loteadora),
      pct_lucro_moni: percentualUiParaFracao(draft.pct_lucro_moni),
      pct_lucro_franqueado: percentualUiParaFracao(draft.pct_lucro_franqueado),
      pct_impostos: percentualUiParaFracao(draft.pct_impostos),
      pct_comissao_corretor: percentualUiParaFracao(draft.pct_comissao_corretor),
      taxa_juros_credito_ponte: draft.taxa_juros_credito_ponte.trim()
        ? percentualUiParaFracao(draft.taxa_juros_credito_ponte)
        : JUROS_CREDITO_PONTE_PADRAO_FRACAO,
      taxa_juros_financiamento_anual: draft.taxa_juros_financiamento_anual.trim()
        ? percentualUiParaFracao(draft.taxa_juros_financiamento_anual)
        : TAXA_JUROS_FINANCIAMENTO_ANUAL_PADRAO_FRACAO,
      taxa_juros_parcelado_mes: percentualUiOpcionalParaFracao(draft.taxa_juros_parcelado_mes),
      entrada_minima_loteadora: montarPremissa(
        draft.entrada_minima_tipo,
        draft.entrada_minima_valor,
      ),
      prazo_obra_meses: Math.round(prazo),
      prazo_desembolso_sugerido: Math.round(prazo),
      updated_by: ctx.userId,
    },
  };
}

export async function salvarSimuladorTemplateDoCard(
  cardId: string,
  draft: LoteamentoSimuladorTemplateDraft,
): Promise<Ok | Err> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;
  const card = await carregarCardLoteadores(auth.supabase, cardId);
  if (!card.ok) return card;

  const packed = draftParaRow(draft, {
    cardId,
    redeLoteadorId: card.redeLoteadorId,
    userId: auth.userId,
    tituloCard: card.titulo,
  });
  if (!packed.ok) return packed;
  const row = packed.row;

  const { data: existente, error: errExist } = await auth.supabase
    .from(TABELA)
    .select('id')
    .eq('kanban_card_id', cardId)
    .maybeSingle();
  if (errExist) {
    return erroBancoSimulador(errExist.message);
  }

  const payloads = [
    row,
    rowSemColunas546(row),
    rowSemColunas545(rowSemColunas546(row)),
  ];
  let saved: Record<string, unknown> | null = null;
  let lastError: string | null = null;
  for (const payload of payloads) {
    if (existente?.id) {
      const { data, error } = await auth.supabase
        .from(TABELA)
        .update(payload as never)
        .eq('id', existente.id)
        .select('*')
        .single();
      if (!error) {
        saved = data as Record<string, unknown>;
        break;
      }
      lastError = error.message;
      if (!isColunaSimulador546Ausente(error.message) && !isColunaSimuladorAjusteAusente(error.message)) {
        return erroBancoSimulador(error.message);
      }
    } else {
      const { data, error } = await auth.supabase
        .from(TABELA)
        .insert({ ...payload, created_by: auth.userId } as never)
        .select('*')
        .single();
      if (!error) {
        saved = data as Record<string, unknown>;
        break;
      }
      lastError = error.message;
      if (!isColunaSimulador546Ausente(error.message) && !isColunaSimuladorAjusteAusente(error.message)) {
        return erroBancoSimulador(error.message);
      }
    }
  }
  if (!saved) {
    return erroBancoSimulador(lastError ?? 'Não foi possível salvar o template.');
  }

  const template = mapTemplateRow(saved);
  revalidatePath(`/loteadores/${cardId}/simulador-template`);
  revalidatePath(`/loteadores/${cardId}/simulador-template/ofertas`);
  revalidatePath('/loteadores');
  return {
    ok: true,
    template,
    link: linkCompleto(template.link_token),
    mensagem: TOAST_TEMPLATE_SALVO,
  };
}

async function listarSimulacoesDoTemplateId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  templateId: string,
): Promise<SimulacaoPagamentoResumo[]> {
  const { data, error } = await supabase
    .from('simulacoes_pagamento')
    .select('*')
    .eq('template_id', templateId)
    .order('created_at', { ascending: false })
    .limit(80);
  if (error) {
    if (isTabelaSimuladorAusente(error.message)) return [];
    console.error('[simulacoes_pagamento] listar:', error.message);
    return [];
  }
  return (data ?? []).map((r) => mapSimulacaoRow(r as Record<string, unknown>));
}

export async function regenerarLinkSimuladorTemplate(cardId: string): Promise<Ok | Err> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;
  const card = await carregarCardLoteadores(auth.supabase, cardId);
  if (!card.ok) return card;

  const novoToken = randomBytes(32).toString('hex');
  const { data: existente, error: errExist } = await auth.supabase
    .from(TABELA)
    .select('id')
    .eq('kanban_card_id', cardId)
    .maybeSingle();
  if (errExist) {
    return erroBancoSimulador(errExist.message);
  }
  if (!existente?.id) {
    return { ok: false, error: 'Salve o template antes de gerar o link.' };
  }

  const { data, error } = await auth.supabase
    .from(TABELA)
    .update({ link_token: novoToken, updated_by: auth.userId } as never)
    .eq('id', existente.id)
    .select('*')
    .single();
  if (error) return erroBancoSimulador(error.message);

  const template = mapTemplateRow(data as Record<string, unknown>);
  revalidatePath(`/loteadores/${cardId}/simulador-template`);
  return {
    ok: true,
    template,
    link: linkCompleto(template.link_token),
    mensagem: 'Novo link gerado. O QR anterior deixa de funcionar.',
  };
}

function parseMoedaCampo(raw: string, label: string, opts?: { obrigatorio?: boolean; padrao?: number }):
  | { ok: true; valor: number }
  | Err {
  const t = raw.trim();
  if (!t) {
    if (opts?.obrigatorio) return { ok: false, error: `Informe ${label}.` };
    return { ok: true, valor: opts?.padrao ?? 0 };
  }
  const n = parseMoneyText(t) ?? parseDecimalInput(t);
  if (n == null || n < 0) return { ok: false, error: `${label} inválido.` };
  return { ok: true, valor: n };
}

function parseInteiroCampo(raw: string, label: string, opts?: { obrigatorio?: boolean }):
  | { ok: true; valor: number | null }
  | Err {
  const t = raw.trim();
  if (!t) {
    if (opts?.obrigatorio) return { ok: false, error: `Informe ${label}.` };
    return { ok: true, valor: null };
  }
  const n = parseDecimalInput(t);
  if (n == null || n < 1) return { ok: false, error: `${label} deve ser um inteiro ≥ 1.` };
  return { ok: true, valor: Math.round(n) };
}

export async function criarSimuladorOfertaDoCard(
  cardId: string,
  draft: SimuladorOfertaDraft,
): Promise<{ ok: true; mensagem: string; oferta: SimulacaoPagamentoResumo } | Err> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;
  const card = await carregarCardLoteadores(auth.supabase, cardId);
  if (!card.ok) return card;

  const { data: template, error: errTpl } = await auth.supabase
    .from(TABELA)
    .select('id, rede_loteador_id, taxa_juros_financiamento_anual')
    .eq('kanban_card_id', cardId)
    .maybeSingle();
  let tpl = template as { id: string; rede_loteador_id?: string | null; taxa_juros_financiamento_anual?: number | null } | null;
  if (errTpl && isColunaSimulador546Ausente(errTpl.message)) {
    const retry = await auth.supabase
      .from(TABELA)
      .select('id, rede_loteador_id')
      .eq('kanban_card_id', cardId)
      .maybeSingle();
    if (retry.error) return erroBancoSimulador(retry.error.message);
    tpl = retry.data as { id: string; rede_loteador_id?: string | null } | null;
  } else if (errTpl) {
    return erroBancoSimulador(errTpl.message);
  }
  if (!tpl?.id) {
    return { ok: false, error: 'Salve o template antes de criar ofertas.' };
  }

  const valorLote = parseMoedaCampo(draft.valor_lote, 'o valor do lote à vista', { obrigatorio: true });
  if (!valorLote.ok) return valorLote;
  if (valorLote.valor <= 0) return { ok: false, error: 'Valor do lote à vista deve ser maior que zero.' };
  const valorCasa = parseMoedaCampo(draft.valor_casa, 'o valor da casa', { obrigatorio: true });
  if (!valorCasa.ok) return valorCasa;
  const valorCustom = parseMoedaCampo(draft.valor_customizacao, 'o valor da customização', { padrao: 0 });
  if (!valorCustom.ok) return valorCustom;
  const valorPago = parseMoedaCampo(draft.valor_ja_pago, 'o valor já pago à loteadora', { padrao: 0 });
  if (!valorPago.ok) return valorPago;
  const prazoMeses = parseInteiroCampo(draft.prazo_meses, 'o prazo de Fase 1', { obrigatorio: true });
  if (!prazoMeses.ok) return prazoMeses;
  const parcelaMensal = parseMoedaCampo(draft.parcela_mensal, 'a parcela mensal', { obrigatorio: true });
  if (!parcelaMensal.ok) return parcelaMensal;
  const renda = parseMoedaCampo(draft.renda_cliente, 'a renda do cliente');
  if (!renda.ok) return renda;
  const prazoFin = parseInteiroCampo(draft.prazo_financiamento_anos, 'o prazo de financiamento');
  if (!prazoFin.ok) return prazoFin;
  const taxaFin = draft.taxa_financiamento_anual.trim()
    ? percentualUiParaFracao(draft.taxa_financiamento_anual)
    : Number(tpl.taxa_juros_financiamento_anual)
      || TAXA_JUROS_FINANCIAMENTO_ANUAL_PADRAO_FRACAO;
  if (taxaFin < 0) return { ok: false, error: 'Taxa do financiamento inválida.' };

  const entradaConfirmada = draft.entrada_confirmada?.trim()
    ? parseMoedaCampo(draft.entrada_confirmada, 'a entrada confirmada')
    : { ok: true as const, valor: 0 };
  if (!entradaConfirmada.ok) return entradaConfirmada;
  const parcelaUnicaConfirmada = draft.parcela_unica_confirmada?.trim()
    ? parseMoedaCampo(draft.parcela_unica_confirmada, 'a parcela única confirmada')
    : { ok: true as const, valor: 0 };
  if (!parcelaUnicaConfirmada.ok) return parcelaUnicaConfirmada;

  const inputs = {
    valor_lote: valorLote.valor,
    valor_casa: valorCasa.valor,
    valor_customizacao: valorCustom.valor,
    valor_ja_pago: valorPago.valor,
    prazo_meses: prazoMeses.valor,
    parcela_mensal: parcelaMensal.valor,
    renda_cliente: renda.valor || null,
    prazo_financiamento_anos: prazoFin.valor,
    taxa_financiamento_anual: taxaFin,
    entrada_confirmada: draft.entrada_confirmada?.trim() ? entradaConfirmada.valor : null,
    parcela_unica_confirmada: draft.parcela_unica_confirmada?.trim()
      ? parcelaUnicaConfirmada.valor
      : null,
  };

  const rowCheio: Record<string, unknown> = {
    template_id: tpl.id,
    kanban_card_id: cardId,
    rede_loteador_id: tpl.rede_loteador_id ?? card.redeLoteadorId,
    created_by: auth.userId,
    condicao_lote: inferirCondicaoLote(valorPago.valor),
    renda_informada_cliente: renda.valor || null,
    valor_lote: valorLote.valor,
    valor_casa: valorCasa.valor,
    valor_customizacao: valorCustom.valor,
    valor_ja_pago: valorPago.valor,
    prazo_meses: prazoMeses.valor,
    parcela_mensal: parcelaMensal.valor,
    renda_cliente: renda.valor || null,
    prazo_financiamento_anos: prazoFin.valor,
    taxa_financiamento_anual: taxaFin,
    inputs,
    resultado: {},
    alertas: [],
    status: 'rascunho',
  };

  const { data, error } = await auth.supabase
    .from('simulacoes_pagamento')
    .insert(rowCheio as never)
    .select('*')
    .single();

  let saved = data as Record<string, unknown> | null;
  if (error && isColunaSimulador547Ausente(error.message)) {
    const { parcela_mensal, ...sem547 } = rowCheio;
    void parcela_mensal;
    const retry547 = await auth.supabase
      .from('simulacoes_pagamento')
      .insert(sem547 as never)
      .select('*')
      .single();
    if (retry547.error && isColunaSimulador546Ausente(retry547.error.message)) {
      const {
        valor_lote,
        valor_casa,
        valor_customizacao,
        valor_ja_pago,
        prazo_meses,
        renda_cliente,
        prazo_financiamento_anos,
        taxa_financiamento_anual,
        ...semNovas
      } = sem547;
      void valor_lote;
      void valor_casa;
      void valor_customizacao;
      void valor_ja_pago;
      void prazo_meses;
      void renda_cliente;
      void prazo_financiamento_anos;
      void taxa_financiamento_anual;
      const retry546 = await auth.supabase
        .from('simulacoes_pagamento')
        .insert(semNovas as never)
        .select('*')
        .single();
      if (retry546.error) return erroBancoSimulador(retry546.error.message);
      saved = retry546.data as Record<string, unknown>;
    } else if (retry547.error) {
      return erroBancoSimulador(retry547.error.message);
    } else {
      saved = retry547.data as Record<string, unknown>;
    }
  } else if (error && isColunaSimulador546Ausente(error.message)) {
    const {
      valor_lote,
      valor_casa,
      valor_customizacao,
      valor_ja_pago,
      prazo_meses,
      parcela_mensal,
      renda_cliente,
      prazo_financiamento_anos,
      taxa_financiamento_anual,
      ...semNovas
    } = rowCheio;
    void valor_lote;
    void valor_casa;
    void valor_customizacao;
    void valor_ja_pago;
    void prazo_meses;
    void parcela_mensal;
    void renda_cliente;
    void prazo_financiamento_anos;
    void taxa_financiamento_anual;
    const retry = await auth.supabase
      .from('simulacoes_pagamento')
      .insert(semNovas as never)
      .select('*')
      .single();
    if (retry.error) return erroBancoSimulador(retry.error.message);
    saved = retry.data as Record<string, unknown>;
  } else if (error) {
    return erroBancoSimulador(error.message);
  }

  if (!saved) return { ok: false, error: 'Não foi possível salvar a oferta.' };

  revalidatePath(`/loteadores/${cardId}/simulador-template/ofertas`);
  revalidatePath(`/loteadores/${cardId}/simulador-template`);
  return {
    ok: true,
    mensagem: 'Oferta salva como rascunho!',
    oferta: mapSimulacaoRow(saved),
  };
}
