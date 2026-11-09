'use server';
// src/lib/actions/jornada-cliente.ts

import { createClient } from '@/lib/supabase/server';
import { tryCreateAdminClient } from '@/lib/supabase/admin';
import type {
  ItemCustomizacaoEscolhido,
  JornadaSessao,
} from '@/app/empreendimento/[slug]/types';
import { parseItensCustomizacaoEscolhidos } from '@/lib/empreendimento/customizacao-itens';
import {
  calcularOferta,
  jaPagoAcimaDoLote,
  mensagemJaPagoAcimaDoLote,
  mensagemPagamentoAMaior,
  mensagemPagamentoAMaiorRecursosProprios,
  pagamentoAMaiorBloqueia,
  sugerirParcelaMensal,
  type OfertaConfig,
} from '@/lib/simulador/calcular-oferta';
import { mapTemplateRow, parsePremissaJson } from '@/lib/loteamento-simulador-template';
import { montarTemplateParaEngine } from '@/lib/simulador/montar-template-jornada';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SnapshotSimulacaoJornada = {
  oferta_nome: string | null;
  lote: string | null;
  valor_terreno: number;
  valor_ja_pago: number;
  acoplamento: number;
  customizacao_total: number;
  prazo_obra_meses: number;
  renda: number | null;
  prazo_financiamento_anos: number;
  taxa_financiamento_anual: number;
  taxa_percentual: number;
  entrada: number;
  parcela_mensal: number;
  parcela_unica: number;
  saldo_a_financiar: number;
  modalidade?: 'financiamento' | 'recursos_proprios';
  customizacao_itens: ItemCustomizacaoEscolhido[];
  fluxo: {
    mes: number;
    fase: string;
    descricao: string;
    entrada_cliente: number;
    saidas_total: number;
    saldo_lote: number;
    caixa_cliente?: number;
  }[];
};

type LeadJornadaInput = {
  token: string;
  cardId: string;
  nome: string;
  telefone: string;
  slug: string;
  corretorId: string | null;
  loteamentoNome: string;
  mover: boolean;
  jaTemLote: boolean;
  loteCodigo: string | null;
  loteValor: number | null;
};

type ErroSupabase = {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
};

function mensagemSupabase(error: ErroSupabase): string {
  return [error.code, error.message, error.details, error.hint]
    .map((parte) => (parte == null ? '' : String(parte).trim()))
    .filter(Boolean)
    .join(' — ');
}

async function chamarRegistrarLead(
  input: LeadJornadaInput,
): Promise<{ ok: true; cardId: string | null } | { ok: false; error: string }> {
  const supabase = await createClient();
  const corretor = input.corretorId && UUID_RE.test(input.corretorId) ? input.corretorId : null;
  const lead = await supabase.rpc('jornada_registrar_lead', {
    p_token: input.token,
    p_card_origem: input.cardId,
    p_nome: input.nome,
    p_telefone: input.telefone,
    p_slug: input.slug,
    p_corretor_id: corretor,
    p_loteamento_nome: input.loteamentoNome,
    p_mover: input.mover,
    p_ja_tem_lote: input.jaTemLote,
    p_dados: {
      lote_codigo: input.loteCodigo,
      lote_valor: input.loteValor,
    },
  });
  if (lead.error) {
    const texto = mensagemSupabase(lead.error);
    console.error('[JORNADA-LEAD]', texto);
    return { ok: false, error: texto };
  }
  const cardId = String((lead.data as { card_id?: string } | null)?.card_id ?? '').trim();
  return { ok: true, cardId: cardId || null };
}

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

  if (error) {
    console.error('[JORNADA-LEAD]', `jornada_sessao_salvar: ${mensagemSupabase(error)}`);
    return { ok: false, error: '' };
  }

  const raw = data as { session_token?: string; etapa_atual?: number } | null;
  if (!raw?.session_token) {
    console.error('[JORNADA-LEAD]', 'jornada_sessao_salvar: sessão não retornada.');
    return { ok: false, error: '' };
  }

  const nomeCliente = String(dados.nome_cliente ?? '').trim();
  const telefoneDigitos = String(dados.telefone_cliente ?? '').replace(/\D/g, '');
  if (nomeCliente.length >= 2 && telefoneDigitos.length >= 10) {
    await chamarRegistrarLead({
      token: raw.session_token,
      cardId,
      nome: nomeCliente,
      telefone: String(dados.telefone_cliente ?? ''),
      slug: String(dados.slug_empreendimento ?? ''),
      corretorId: String(dados.corretor_id ?? '').trim() || null,
      loteamentoNome: String(dados.loteamento_nome ?? ''),
      mover: dados.mover_kanban_vcl === true,
      jaTemLote: dados.lote_ja_adquirido === true,
      loteCodigo: dados.lote_codigo != null ? String(dados.lote_codigo) : null,
      loteValor: dados.lote_valor != null ? Number(dados.lote_valor) : null,
    });
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
    vcl_card_id: raw.vcl_card_id != null ? String(raw.vcl_card_id) : null,
    concluida: Boolean(raw.concluida),
  };
}

export async function garantirLeadJornada(
  input: LeadJornadaInput,
): Promise<{ ok: true; cardId: string | null } | { ok: false; error: string }> {
  const nome = input.nome.trim();
  const telefoneDigitos = input.telefone.replace(/\D/g, '');
  if (nome.length < 2 || telefoneDigitos.length < 10 || !input.token || !input.cardId) {
    return { ok: true, cardId: null };
  }
  const lead = await chamarRegistrarLead({ ...input, nome });
  return { ok: true, cardId: lead.ok ? lead.cardId : null };
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
  personalizada: boolean;
  entradaConfirmada: number | null;
  parcelaMensalConfirmada: number | null;
  parcelaUnicaConfirmada: number | null;
  ofertaNome: string | null;
  loteCodigo: string | null;
  loteRotulo: string | null;
  slug: string;
  snapshot: SnapshotSimulacaoJornada;
  loteamentoNome: string;
  corretorId: string | null;
  jaTemLote: boolean;
  moverLead: boolean;
};

type GravarSimulacaoResult =
  | { ok: true; simulacaoId: string }
  | { ok: false; error: string };

function fracaoPremissa(raw: unknown): number {
  const valor = parsePremissaJson(raw)?.valor;
  if (valor == null || !Number.isFinite(valor) || valor < 0) return 0;
  return valor >= 1 ? valor / 100 : valor;
}

/**
 * Recalcula no servidor. A jornada anônima não lê o template; a service role lê.
 * Recusa quando as parcelas passam do valor total.
 */
async function recusarPagamentoAMaiorJornada(
  input: GravarSimulacaoInput,
): Promise<string | null> {
  if (jaPagoAcimaDoLote(input.valorJaPago, input.valorLote)) {
    return mensagemJaPagoAcimaDoLote();
  }
  const admin = tryCreateAdminClient();
  const db = admin ?? (await createClient());
  const { data, error } = await db
    .from('loteamento_simulador_templates')
    .select('*')
    .eq('id', input.templateId)
    .maybeSingle();
  if (error || !data) return 'Não foi possível validar a simulação.';
  const row = data as Record<string, unknown>;
  const template = montarTemplateParaEngine(mapTemplateRow(row));
  const prazoEntrega = Math.max(1, Math.round(input.prazoObraMeses || 12));
  const nObra = Math.min(
    7,
    Math.max(3, Math.round(input.prazoObraMeses || template.prazo_obra_meses || 7)),
  );
  const prazoFase1 = prazoEntrega > nObra ? prazoEntrega - nObra : Math.max(1, prazoEntrega);
  const percMensal = fracaoPremissa(row.premissa_entrada_lote_nao_pago);
  const parcelaBase =
    percMensal > 0 ? percMensal * input.valorLote : sugerirParcelaMensal(input.valorLote);
  const recursosProprios = input.snapshot.modalidade === 'recursos_proprios';
  const oferta: OfertaConfig = recursosProprios
    ? {
        valor_lote: input.valorLote,
        valor_casa: input.valorCasa,
        valor_customizacao: input.valorCustomizacao,
        valor_acoplamento: input.valorAcoplamento,
        valor_ja_pago: input.valorJaPago,
        prazo_meses: prazoFase1,
        parcela_mensal: Math.max(0, Number(input.snapshot.parcela_mensal ?? 0)),
        renda_cliente: input.rendaCliente ?? 0,
        prazo_financiamento_anos: Math.max(1, Math.round(input.prazoFinanciamentoAnos || 30)),
        taxa_financiamento_anual: input.taxaFinanciamentoAnual / 100,
        modalidade: 'recursos_proprios',
      }
    : {
        valor_lote: input.valorLote,
        valor_casa: input.valorCasa,
        valor_customizacao: input.valorCustomizacao,
        valor_acoplamento: input.valorAcoplamento,
        valor_ja_pago: input.valorJaPago,
        prazo_meses: prazoFase1,
        parcela_mensal: parcelaBase,
        renda_cliente: input.rendaCliente ?? 0,
        prazo_financiamento_anos: Math.max(1, Math.round(input.prazoFinanciamentoAnos || 30)),
        taxa_financiamento_anual: input.taxaFinanciamentoAnual / 100,
        ...(input.personalizada
          ? {
              entrada_confirmada: input.entradaConfirmada ?? undefined,
              mensal_confirmada: input.parcelaMensalConfirmada ?? undefined,
              parcela_unica_confirmada: input.parcelaUnicaConfirmada ?? undefined,
            }
          : {}),
      };
  const calc = calcularOferta(template, oferta, input.valorAcoplamento);
  if (!pagamentoAMaiorBloqueia(calc.valor_pago_a_maior)) return null;
  return recursosProprios
    ? mensagemPagamentoAMaiorRecursosProprios(calc.valor_pago_a_maior)
    : mensagemPagamentoAMaior(calc.valor_pago_a_maior);
}

export async function gravarSimulacaoJornada(
  input: GravarSimulacaoInput,
): Promise<GravarSimulacaoResult> {
  const bloqueio = await recusarPagamentoAMaiorJornada(input);
  if (bloqueio) return { ok: false, error: bloqueio };
  const supabase = await createClient();
  const {
    templateId, cardId, sessaoToken,
    valorLote, valorCasa, valorCustomizacao, valorAcoplamento, customizacaoItens,
    valorJaPago, rendaCliente, prazoObraMeses, prazoFinanciamentoAnos, taxaFinanciamentoAnual,
    nomeCliente, telefoneCliente, condicaoLote,
    personalizada, entradaConfirmada, parcelaMensalConfirmada, parcelaUnicaConfirmada,
    ofertaNome, loteCodigo, loteRotulo, slug, snapshot,
    loteamentoNome, corretorId, jaTemLote, moverLead,
  } = input;

  const nome = nomeCliente.trim();
  const telefoneDigitos = telefoneCliente.replace(/\D/g, '');
  if (nome.length >= 2 && telefoneDigitos.length >= 10) {
    const lead = await chamarRegistrarLead({
      token: sessaoToken,
      cardId,
      nome,
      telefone: telefoneCliente,
      slug,
      corretorId,
      loteamentoNome,
      mover: moverLead,
      jaTemLote,
      loteCodigo,
      loteValor: valorLote,
    });
    if (!lead.ok) {
      console.error('[JORNADA-SIMULACAO]', `Lead não gravado; a simulação segue para a RPC: ${lead.error}`);
    }
  }

  let data: unknown;
  let error: ErroSupabase | null = null;
  try {
    const rpc = await supabase.rpc('jornada_registrar_simulacao', {
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
        parcela_mensal: snapshot.parcela_mensal,
        personalizada,
        entrada_confirmada: personalizada ? entradaConfirmada : null,
        parcela_mensal_confirmada: personalizada ? parcelaMensalConfirmada : null,
        parcela_unica_confirmada: personalizada ? parcelaUnicaConfirmada : null,
        customizacao_itens: customizacaoItens,
        oferta_nome: ofertaNome,
        lote_codigo: loteCodigo,
        lote_rotulo: loteRotulo,
        slug,
        resultado: snapshot,
      },
    });
    data = rpc.data;
    error = rpc.error;
  } catch (err) {
    const texto = err instanceof Error ? err.message : String(err);
    console.error('[JORNADA-SIMULACAO]', texto);
    return { ok: false, error: '' };
  }

  if (error) {
    const texto = mensagemSupabase(error);
    console.error('[JORNADA-SIMULACAO]', texto);
    return { ok: false, error: '' };
  }
  const simulacaoId = String((data as { id?: string } | null)?.id ?? '').trim();
  if (!simulacaoId) {
    console.error('[JORNADA-SIMULACAO]', 'Simulação não retornada.');
    return { ok: false, error: '' };
  }

  return { ok: true, simulacaoId };
}
