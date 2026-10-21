'use server';
// src/lib/actions/jornada-cliente.ts

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type {
  ItemCustomizacaoEscolhido,
  JornadaSessao,
} from '@/app/empreendimento/[slug]/types';
import { parseItensCustomizacaoEscolhidos } from '@/lib/empreendimento/customizacao-itens';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  const nomeCliente = String(dados.nome_cliente ?? '').trim();
  const telefoneDigitos = String(dados.telefone_cliente ?? '').replace(/\D/g, '');
  if (nomeCliente.length >= 2 && telefoneDigitos.length >= 10) {
    const corretorBruto = String(dados.corretor_id ?? '').trim();
    const lead = await supabase.rpc('jornada_registrar_lead', {
      p_token: raw.session_token,
      p_card_origem: cardId,
      p_nome: nomeCliente,
      p_telefone: String(dados.telefone_cliente ?? ''),
      p_slug: String(dados.slug_empreendimento ?? ''),
      p_corretor_id: UUID_RE.test(corretorBruto) ? corretorBruto : null,
      p_loteamento_nome: String(dados.loteamento_nome ?? ''),
      p_mover: dados.mover_kanban_vcl === true,
      p_ja_tem_lote: dados.lote_ja_adquirido === true,
      p_dados: {
        lote_codigo: dados.lote_codigo ?? null,
        lote_valor: dados.lote_valor ?? null,
      },
    });
    if (lead.error) return { ok: false, error: lead.error.message };
    revalidatePath('/venda-casas-loteadores');
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
  valorAcoplamento: number;
  customizacaoItens: ItemCustomizacaoEscolhido[];
  valorJaPago: number;
  rendaCliente: number | null;
  prazoObraMeses: number;
  prazoFinanciamentoAnos: number;
  taxaFinanciamentoAnual: number;
  nomeCliente: string;
  telefoneCliente: string;
  condicaoLote: 'nao_pago' | 'parcial' | 'quitado' | 'recurso_proprio';
  ofertaNome: string | null;
  loteCodigo: string | null;
  loteRotulo: string | null;
  slug: string;
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
    valorLote, valorCasa, valorCustomizacao, valorAcoplamento, customizacaoItens,
    valorJaPago, rendaCliente, prazoObraMeses, prazoFinanciamentoAnos, taxaFinanciamentoAnual,
    nomeCliente, telefoneCliente, condicaoLote,
    ofertaNome, loteCodigo, loteRotulo, slug,
  } = input;

  const { data, error } = await supabase.rpc('jornada_registrar_simulacao', {
    p_token: sessaoToken,
    p_card_origem: cardId,
    p_payload: {
      template_id: templateId,
      condicao_lote: condicaoLote,
      cliente_nome: nomeCliente,
      cliente_telefone: telefoneCliente,
      valor_lote: valorLote,
      valor_casa: valorCasa,
      valor_customizacao: valorCustomizacao,
      valor_acoplamento: valorAcoplamento,
      valor_ja_pago: valorJaPago,
      renda_cliente: rendaCliente,
      prazo_meses: prazoObraMeses,
      prazo_financiamento_anos: prazoFinanciamentoAnos,
      taxa_financiamento_anual: taxaFinanciamentoAnual / 100,
      customizacao_itens: customizacaoItens,
      oferta_nome: ofertaNome,
      lote_codigo: loteCodigo,
      lote_rotulo: loteRotulo,
      slug,
    },
  });

  if (error) return { ok: false, error: error.message };
  const simulacaoId = String((data as { id?: string } | null)?.id ?? '').trim();
  if (!simulacaoId) return { ok: false, error: 'Simulação não retornada.' };

  revalidatePath('/venda-casas-loteadores');
  return { ok: true, simulacaoId };
}
