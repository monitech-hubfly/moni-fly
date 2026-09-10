'use server';

import { createClient } from '@/lib/supabase/server';
import { tryCreateAdminClient } from '@/lib/supabase/admin';
import { inferirCondicaoLote, prazoFase1DePrazoSalvo } from '@/lib/loteamento-simulador-template';
import { calcularOferta, type OfertaConfig } from '@/lib/simulador/calcular-oferta';
import { carregarSimuladorPublico } from '@/lib/simulador/carregar-simulador-publico';

export type SalvarOfertaCorretorInput = {
  clienteNome: string;
  clienteTelefone: string;
  clienteEmail: string;
  loteId: string | null;
  loteValorManual: number | null;
  valorCasa: number;
  valorCustomizacao: number;
  valorJaPago: number;
  prazoMesesTotal: number;
  parcelaMensal: number;
  renda: number;
  prazoFinanciamentoAnos: number;
  taxaJurosAnualFracao: number;
  entradaConfirmada: number;
  mensalConfirmada: number;
  parcelaUnicaConfirmada: number;
  personalizada: boolean;
};

export type SalvarOfertaCorretorResult =
  | { ok: true; ofertaId: string; nome: string }
  | { ok: false; error: string };

function n0(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isColuna549Ausente(message: string | undefined): boolean {
  return /cliente_nome|cliente_telefone|cliente_email|lote_id|lote_valor_manual|personalizada|parcela_mensal_confirmada|entrada_confirmada|parcela_unica_confirmada/i.test(
    message ?? '',
  );
}

function rpcAusente(message: string | undefined): boolean {
  return /could not find the function|schema cache|does not exist/i.test(message ?? '');
}

export async function salvarOfertaCorretor(
  token: string,
  input: SalvarOfertaCorretorInput,
): Promise<SalvarOfertaCorretorResult> {
  const linkToken = String(token ?? '').trim();
  if (!linkToken) return { ok: false, error: 'Link do simulador inválido.' };

  const nome = String(input.clienteNome ?? '').trim();
  if (!nome) return { ok: false, error: 'Informe o nome completo do cliente.' };

  const view = await carregarSimuladorPublico(linkToken);
  if (!view) return { ok: false, error: 'Template não encontrado para este link.' };

  let valorLote = 0;
  let loteId: string | null = input.loteId ? String(input.loteId) : null;
  let loteValorManual: number | null = null;
  let loteCodigo: string | null = null;

  if (loteId) {
    const lote = view.lotes.find((l) => l.id === loteId);
    if (!lote) return { ok: false, error: 'Lote inválido para este loteamento.' };
    valorLote = lote.valor;
    loteCodigo = lote.codigo;
  } else {
    const manual = n0(input.loteValorManual);
    if (manual <= 0) return { ok: false, error: 'Informe o valor do lote.' };
    valorLote = manual;
    loteValorManual = manual;
    loteId = null;
  }

  const valorCasa = n0(input.valorCasa);
  if (valorCasa < 0) return { ok: false, error: 'Informe o valor da casa.' };
  const valorCustomizacao = Math.max(0, n0(input.valorCustomizacao));
  const valorJaPago = Math.max(0, n0(input.valorJaPago));
  const prazoTotal = Math.round(n0(input.prazoMesesTotal));
  if (prazoTotal < 1) return { ok: false, error: 'Informe o prazo total em meses.' };
  const prazoFase1 = prazoFase1DePrazoSalvo(prazoTotal, view.prazoObraMeses);
  if (prazoTotal <= view.prazoObraMeses) {
    return {
      ok: false,
      error: `O prazo total deve ser maior que o prazo de obra (${view.prazoObraMeses} meses).`,
    };
  }

  const parcelaMensal = n0(input.parcelaMensal);
  if (parcelaMensal < 0) return { ok: false, error: 'Informe a parcela mensal.' };
  const renda = Math.max(0, n0(input.renda));
  const prazoFin = Math.max(1, Math.round(n0(input.prazoFinanciamentoAnos)));
  const taxaFin = n0(input.taxaJurosAnualFracao);
  if (taxaFin < 0) return { ok: false, error: 'Taxa de juros inválida.' };

  const entradaConfirmada = n0(input.entradaConfirmada);
  const mensalConfirmada = n0(input.mensalConfirmada);
  const parcelaUnicaConfirmada = n0(input.parcelaUnicaConfirmada);
  const personalizada = Boolean(input.personalizada);

  const oferta: OfertaConfig = {
    valor_lote: valorLote,
    valor_casa: valorCasa,
    valor_customizacao: valorCustomizacao,
    valor_ja_pago: valorJaPago,
    prazo_meses: prazoFase1,
    parcela_mensal: parcelaMensal,
    renda_cliente: renda,
    prazo_financiamento_anos: prazoFin,
    taxa_financiamento_anual: taxaFin,
    entrada_confirmada: personalizada ? entradaConfirmada : undefined,
    mensal_confirmada: personalizada ? mensalConfirmada : undefined,
    parcela_unica_confirmada: personalizada ? parcelaUnicaConfirmada : undefined,
  };
  const resultado = calcularOferta(view.config, oferta);

  const telefone = String(input.clienteTelefone ?? '').trim() || null;
  const email = String(input.clienteEmail ?? '').trim() || null;
  const nomeOferta = loteCodigo ? `${nome} — ${loteCodigo}` : nome;
  const condicaoLote = inferirCondicaoLote(valorJaPago);

  const inputs = {
    origem: 'corretor_qr',
    nome: nomeOferta,
    cliente_nome: nome,
    cliente_telefone: telefone,
    cliente_email: email,
    lote_id: loteId,
    lote_valor_manual: loteValorManual,
    valor_lote: valorLote,
    valor_casa: valorCasa,
    valor_customizacao: valorCustomizacao,
    valor_ja_pago: valorJaPago,
    prazo_meses: prazoTotal,
    parcela_mensal: parcelaMensal,
    renda_cliente: renda || null,
    prazo_financiamento_anos: prazoFin,
    taxa_financiamento_anual: taxaFin,
    entrada_confirmada: entradaConfirmada,
    parcela_mensal_confirmada: mensalConfirmada,
    parcela_unica_confirmada: parcelaUnicaConfirmada,
    personalizada,
  };

  const payload = {
    cliente_nome: nome,
    cliente_telefone: telefone,
    cliente_email: email,
    lote_id: loteId,
    valor_lote: valorLote,
    valor_casa: valorCasa,
    valor_customizacao: valorCustomizacao,
    valor_ja_pago: valorJaPago,
    prazo_meses: prazoTotal,
    parcela_mensal: parcelaMensal,
    renda_cliente: renda || null,
    prazo_financiamento_anos: prazoFin,
    taxa_financiamento_anual: taxaFin,
    entrada_confirmada: entradaConfirmada,
    parcela_mensal_confirmada: mensalConfirmada,
    parcela_unica_confirmada: parcelaUnicaConfirmada,
    personalizada,
    condicao_lote: condicaoLote,
    inputs,
    resultado,
    alertas: resultado.alertas,
  };

  const supabase = await createClient();
  const rpc = await supabase.rpc('simulador_publico_salvar', {
    p_token: linkToken,
    p_payload: payload,
  });
  if (!rpc.error && rpc.data) {
    const saved = rpc.data as { id?: string; nome?: string };
    return {
      ok: true,
      ofertaId: String(saved.id ?? ''),
      nome: String(saved.nome ?? nomeOferta),
    };
  }

  if (rpc.error && !rpcAusente(rpc.error.message)) {
    return { ok: false, error: rpc.error.message };
  }

  const admin = tryCreateAdminClient();
  if (!admin) {
    return {
      ok: false,
      error:
        'Não foi possível gravar a oferta. Aplique a migration 549 no DEV (tabela lotes_template + RPCs).',
    };
  }

  const rowCheio: Record<string, unknown> = {
    template_id: view.templateId,
    kanban_card_id: view.kanbanCardId,
    rede_loteador_id: view.redeLoteadorId,
    created_by: null,
    nome: nomeOferta,
    condicao_lote: condicaoLote,
    renda_informada_cliente: renda || null,
    valor_lote: valorLote,
    valor_casa: valorCasa,
    valor_customizacao: valorCustomizacao,
    valor_ja_pago: valorJaPago,
    prazo_meses: prazoTotal,
    parcela_mensal: parcelaMensal,
    renda_cliente: renda || null,
    prazo_financiamento_anos: prazoFin,
    taxa_financiamento_anual: taxaFin,
    cliente_nome: nome,
    cliente_telefone: telefone,
    cliente_email: email,
    lote_id: loteId,
    lote_valor_manual: loteValorManual,
    personalizada,
    entrada_confirmada: entradaConfirmada,
    parcela_mensal_confirmada: mensalConfirmada,
    parcela_unica_confirmada: parcelaUnicaConfirmada,
    inputs,
    resultado,
    alertas: resultado.alertas,
    status: 'rascunho',
  };

  const insert = await admin.from('simulacoes_pagamento').insert(rowCheio as never).select('id').single();
  if (insert.error && isColuna549Ausente(insert.error.message)) {
    const {
      cliente_nome,
      cliente_telefone,
      cliente_email,
      lote_id,
      lote_valor_manual,
      personalizada: _p,
      entrada_confirmada,
      parcela_mensal_confirmada,
      parcela_unica_confirmada,
      ...sem549
    } = rowCheio;
    void cliente_nome;
    void cliente_telefone;
    void cliente_email;
    void lote_id;
    void lote_valor_manual;
    void _p;
    void entrada_confirmada;
    void parcela_mensal_confirmada;
    void parcela_unica_confirmada;
    const retry = await admin.from('simulacoes_pagamento').insert(sem549 as never).select('id').single();
    if (retry.error) return { ok: false, error: retry.error.message };
    return { ok: true, ofertaId: String((retry.data as { id: string }).id), nome: nomeOferta };
  }
  if (insert.error) return { ok: false, error: insert.error.message };
  return { ok: true, ofertaId: String((insert.data as { id: string }).id), nome: nomeOferta };
}
