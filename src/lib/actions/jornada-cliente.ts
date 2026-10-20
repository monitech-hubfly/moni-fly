'use server';
// src/lib/actions/jornada-cliente.ts

import { createClient } from '@/lib/supabase/server';
import type {
  ItemCustomizacaoEscolhido,
  JornadaSessao,
} from '@/app/empreendimento/[slug]/types';
import { nascerCardVclDoCliente } from '@/lib/kanban/vcl-lead-nascimento';
import { parseItensCustomizacaoEscolhidos } from '@/lib/empreendimento/customizacao-itens';

// ─────────────────────────────────────────────────────────────────────────────
// Salvar/criar sessão do cliente
// ─────────────────────────────────────────────────────────────────────────────
type SalvarSessaoInput = {
  token: string | null;
  cardId: string;
  etapa: number;
  dados: Record<string, unknown>;
};

type SalvarSessaoResult =
  | { ok: true; session_token: string; etapa_atual: number }
  | { ok: false; error: string };

export async function salvarJornadaSessao(
  input: SalvarSessaoInput,
): Promise<SalvarSessaoResult> {
  const { token, cardId, etapa, dados } = input;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('jornada_sessao_salvar', {
    p_token: token ?? '',
    p_card_id: cardId,
    p_etapa: etapa,
    p_dados: dados,
  });

  if (error) return { ok: false, error: error.message };

  const raw = data as { session_token?: string; etapa_atual?: number } | null;
  if (!raw?.session_token) return { ok: false, error: 'Sessão não retornada.' };

  const corretorId = String(dados.corretor_id ?? '').trim();
  const nomeCliente = String(dados.nome_cliente ?? '').trim();
  const telefoneDigitos = String(dados.telefone_cliente ?? '').replace(/\D/g, '');
  if (corretorId && nomeCliente.length >= 2 && telefoneDigitos.length >= 10) {
    const loteValorRaw = dados.lote_valor;
    const loteValor = loteValorRaw == null || loteValorRaw === '' ? null : Number(loteValorRaw);
    try {
      await nascerCardVclDoCliente({
        sessionToken: raw.session_token,
        cardOrigemId: cardId,
        slug: String(dados.slug_empreendimento ?? ''),
        corretorId,
        nomeCliente,
        telefone: String(dados.telefone_cliente ?? ''),
        loteCodigo: dados.lote_codigo == null ? null : String(dados.lote_codigo),
        loteValor: loteValor != null && Number.isFinite(loteValor) ? loteValor : null,
      });
    } catch (err) {
      console.error('[vcl-lead]', err);
    }
  }

  return {
    ok: true,
    session_token: raw.session_token,
    etapa_atual: raw.etapa_atual ?? etapa,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Carregar sessão por token (retomada)
// ─────────────────────────────────────────────────────────────────────────────
export async function carregarJornadaSessao(
  token: string,
  cardId: string,
): Promise<JornadaSessao | null> {
  if (!token || !cardId) return null;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('jornada_sessao_carregar', {
    p_token: token,
    p_card_id: cardId,
  });

  if (error || !data || typeof data !== 'object') return null;

  const raw = data as Record<string, unknown>;
  return {
    session_token: String(raw.session_token ?? ''),
    etapa_atual: Number(raw.etapa_atual ?? 1),
    nome_cliente: raw.nome_cliente != null ? String(raw.nome_cliente) : null,
    telefone_cliente: raw.telefone_cliente != null ? String(raw.telefone_cliente) : null,
    lote_codigo: raw.lote_codigo != null ? String(raw.lote_codigo) : null,
    lote_valor: raw.lote_valor != null ? Number(raw.lote_valor) : null,
    lote_ja_adquirido:
      raw.lote_ja_adquirido == null ? null : Boolean(raw.lote_ja_adquirido),
    valor_ja_pago: raw.valor_ja_pago != null ? Number(raw.valor_ja_pago) : null,
    empreendimento_id: raw.empreendimento_id != null ? String(raw.empreendimento_id) : null,
    itens_selecionados: Array.isArray(raw.itens_selecionados)
      ? (raw.itens_selecionados as string[])
      : [],
    customizacao_itens: parseItensCustomizacaoEscolhidos(raw.customizacao_itens),
    valor_acoplamento: raw.valor_acoplamento != null ? Number(raw.valor_acoplamento) : null,
    valor_kit: raw.valor_kit != null ? Number(raw.valor_kit) : null,
    valor_gadgets: raw.valor_gadgets != null ? Number(raw.valor_gadgets) : null,
    valor_lote: raw.valor_lote != null ? Number(raw.valor_lote) : null,
    valor_casa: raw.valor_casa != null ? Number(raw.valor_casa) : null,
    valor_customizacao: raw.valor_customizacao != null ? Number(raw.valor_customizacao) : null,
    simulacao_id: raw.simulacao_id != null ? String(raw.simulacao_id) : null,
    concluida: Boolean(raw.concluida),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Gravar simulação e vincular à sessão
// ─────────────────────────────────────────────────────────────────────────────
type GravarSimulacaoInput = {
  templateId: string;
  cardId: string;
  sessaoToken: string;
  valorLote: number;
  valorCasa: number;
  valorCustomizacao: number;
  customizacaoItens: ItemCustomizacaoEscolhido[];
  valorJaPago: number;
  rendaCliente: number | null;
  prazoObraMeses: number;
  prazoFinanciamentoAnos: number;
  taxaFinanciamentoAnual: number;
  nomeCliente: string;
  telefoneCliente: string;
  condicaoLote: 'nao_pago' | 'parcial' | 'quitado' | 'recurso_proprio';
};

type GravarSimulacaoResult =
  | { ok: true; simulacaoId: string }
  | { ok: false; error: string };

export async function gravarSimulacaoJornada(
  input: GravarSimulacaoInput,
): Promise<GravarSimulacaoResult> {
  const supabase = await createClient();
  const {
    templateId, cardId, sessaoToken,
    valorLote, valorCasa, valorCustomizacao, customizacaoItens,
    valorJaPago, rendaCliente, prazoObraMeses, prazoFinanciamentoAnos, taxaFinanciamentoAnual,
    nomeCliente, telefoneCliente, condicaoLote,
  } = input;

  // TODO(jornada→kanban): este insert roda como visitante anônimo e provavelmente falha por RLS
  // (simulacoes_pagamento só aceita escrita de admin/team — migration 544). Só grava quando há
  // usuário interno logado. Resolver depois do treinamento junto com a ligação jornada → kanban.
  // Os itens escolhidos ficam garantidos em jornada_cliente_sessao.customizacao_itens.
  const { data, error } = await supabase
    .from('simulacoes_pagamento')
    .insert({
      template_id: templateId,
      kanban_card_id: cardId,
      cliente_nome: nomeCliente,
      cliente_telefone: telefoneCliente,
      valor_lote: valorLote,
      valor_casa: valorCasa,
      valor_customizacao: valorCustomizacao,
      customizacao_itens: customizacaoItens,
      valor_ja_pago: valorJaPago,
      renda_cliente: rendaCliente,
      prazo_meses: prazoObraMeses,
      prazo_financiamento_anos: prazoFinanciamentoAnos,
      taxa_financiamento_anual: taxaFinanciamentoAnual / 100,
      condicao_lote: condicaoLote,
      status: 'rascunho',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    return { ok: false, error: error?.message ?? 'Erro ao gravar simulação.' };
  }

  const simulacaoId = data.id as string;

  // Vincula à sessão
  await salvarJornadaSessao({
    token: sessaoToken,
    cardId,
    etapa: 5,
    dados: { simulacao_id: simulacaoId },
  });

  return { ok: true, simulacaoId };
}
