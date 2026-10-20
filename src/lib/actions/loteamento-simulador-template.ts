'use server';

import { revalidatePath, unstable_noStore as noStore } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isRedeStaffRole } from '@/lib/authz';
import { persistSeededStaffRoleIfNeeded } from '@/lib/seeded-staff-role';
import { getPublicAppUrl } from '@/lib/app-url';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { isKanbanFunilLoteadoresRef } from '@/lib/kanban/loteadores-card-titulo';
import { parseDecimalInput } from '@/lib/condominios';
import { parseMoneyText } from '@/lib/dashboard-novos-negocios/parseMoney';
import {
  isColunaSimulador546Ausente,
  isColunaSimulador547Ausente,
  isColunaSimulador548Ausente,
  isColunaSimulador571Ausente,
  isColunaSimulador575Ausente,
  isColunaSimulador576Ausente,
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
  valoresImobDaSimulacao,
  type LoteamentoSimuladorTemplateDraft,
  type LoteamentoSimuladorTemplateRow,
  type SimulacaoPagamentoResumo,
  type SimuladorOfertaDraft,
} from '@/lib/loteamento-simulador-template';
import { vincularOfertaAoEmpreendimentoImob } from '@/lib/actions/imob-simulacoes-card';

type Ok = {
  ok: true;
  template: LoteamentoSimuladorTemplateRow;
  link: string | null;
  linkMoni: string | null;
  pageSlug: string | null;
  mensagem: string;
  pageAtiva?: boolean;
};
type Err = { ok: false; error: string };
type AuthOk = {
  ok: true;
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
};

const TABELA = 'loteamento_simulador_templates';

function revalidateAposMutacaoSimulador(cardId: string, slugJornada?: string | null) {
  revalidatePath('/hub-funis');
  revalidatePath('/loteadores');
  revalidatePath(`/loteadores/${cardId}/simulador-template`);
  revalidatePath(`/loteadores/${cardId}/simulador-template/ofertas`);
  const slug = String(slugJornada ?? '').trim();
  if (slug) revalidatePath(`/empreendimento/${slug}`);
}

async function requireUser(): Promise<AuthOk | Err> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };
  return { ok: true, supabase, userId: user.id };
}

async function requireStaff(): Promise<AuthOk | Err> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const access = await persistSeededStaffRoleIfNeeded(
    supabase,
    { id: user.id, email: user.email },
    (profile as { role?: string } | null)?.role,
  );
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

function linkJornadaPublica(slug: string | null | undefined): string | null {
  const s = String(slug ?? '').trim();
  if (!s) return null;
  return `${getPublicAppUrl()}/empreendimento/${encodeURIComponent(s)}`;
}

function erroSlugJornada(message: string, code?: string): Err {
  if (code === '23505' || /duplicate key|idx_imob_card_modelo_page_slug/i.test(message)) {
    return { ok: false, error: 'Este slug já está em uso por outro empreendimento.' };
  }
  if (/page_slug|schema cache|does not exist|could not find/i.test(message)) {
    return { ok: false, error: 'Coluna page_slug ainda não existe neste banco. Aplique a migration 560 no DEV.' };
  }
  return { ok: false, error: message };
}

async function persistirSlugJornadaDoCard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cardId: string,
  slug: string | null,
): Promise<{ ok: true; slug: string | null } | Err> {
  const patch = { page_slug: slug, updated_at: new Date().toISOString() };
  const upd = await supabase
    .from('imob_card_modelo')
    .update(patch as never)
    .eq('card_id', cardId)
    .select('card_id');
  if (upd.error) return erroSlugJornada(upd.error.message, upd.error.code);
  if ((upd.data ?? []).length > 0) return { ok: true, slug };

  const ins = await supabase.from('imob_card_modelo').insert({ card_id: cardId, ...patch } as never);
  if (ins.error) return erroSlugJornada(ins.error.message, ins.error.code);
  return { ok: true, slug };
}

async function carregarSlugJornadaDoCard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cardId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('imob_card_modelo')
    .select('page_slug')
    .eq('card_id', cardId)
    .maybeSingle();
  if (error) {
    if (!/page_slug|schema cache|does not exist|could not find/i.test(error.message)) {
      console.warn('[simulador-template] slug da jornada:', error.message);
    }
    return null;
  }
  return String((data as { page_slug?: string | null } | null)?.page_slug ?? '').trim() || null;
}

function mensagemTabelaAusente(): string {
  return 'Tabela do simulador ainda não existe neste banco. Aplique a migration 544 no DEV.';
}

function mensagemColunaAusente(): string {
  return 'Faltam colunas do simulador neste banco. Aplique as migrations 545, 546, 547, 548, 575 e 576 no DEV.';
}

function erroBancoSimulador(message: string): Err {
  if (
    isColunaSimulador548Ausente(message) ||
    isColunaSimulador547Ausente(message) ||
    isColunaSimulador546Ausente(message) ||
    isColunaSimulador571Ausente(message) ||
    isColunaSimulador575Ausente(message) ||
    isColunaSimulador576Ausente(message) ||
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
): Promise<
  | {
      ok: true;
      titulo: string;
      nomeCondominio: string | null;
      redeLoteadorId: string | null;
      loteadorNome: string | null;
    }
  | Err
> {
  const { data, error } = await supabase
    .from('kanban_cards')
    .select('id, titulo, nome_condominio, kanban_id, rede_loteador_id')
    .eq('id', cardId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Card não encontrado.' };
  const row = data as {
    titulo?: string | null;
    nome_condominio?: string | null;
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
    nomeCondominio: String(row.nome_condominio ?? '').trim() || null,
    redeLoteadorId,
    loteadorNome,
  };
}

export type JornadaPublicaCard = {
  pageSlug: string | null;
  pageAtiva: boolean;
  planilhaLotesPath: string | null;
};

async function carregarJornadaPublica(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cardId: string,
): Promise<JornadaPublicaCard> {
  const vazia: JornadaPublicaCard = { pageSlug: null, pageAtiva: false, planilhaLotesPath: null };
  const { data, error } = await supabase
    .from('imob_card_modelo')
    .select('page_slug, page_ativa, planilha_lotes_path')
    .eq('card_id', cardId)
    .maybeSingle();
  if (error || !data) return vazia;
  const row = data as {
    page_slug?: string | null;
    page_ativa?: boolean | null;
    planilha_lotes_path?: string | null;
  };
  const pageSlug = String(row.page_slug ?? '').trim() || null;
  const planilhaLotesPath = String(row.planilha_lotes_path ?? '').trim() || null;
  return {
    pageSlug,
    pageAtiva: row.page_ativa === true,
    planilhaLotesPath,
  };
}

export async function carregarSimuladorTemplateDoCard(cardId: string): Promise<
  | {
      ok: true;
      cardTitulo: string;
      nomeCondominio: string | null;
      loteadorNome: string | null;
      redeLoteadorId: string | null;
      template: LoteamentoSimuladorTemplateRow | null;
      link: string | null;
      linkMoni: string | null;
      empreendimentoSlug: string | null;
      simulacoes: SimulacaoPagamentoResumo[];
      jornada: JornadaPublicaCard;
    }
  | Err
> {
  noStore();
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const card = await carregarCardLoteadores(auth.supabase, cardId);
  if (!card.ok) return card;

  const { data, error } = await auth.supabase
    .from(TABELA)
    .select('*')
    .eq('kanban_card_id', cardId)
    .limit(1);

  if (error) {
    if (error.code !== 'PGRST116' && !/0 rows|multiple \(or no\) rows/i.test(error.message)) {
      return erroBancoSimulador(error.message);
    }
  }

  const row = Array.isArray(data) ? data[0] : data;
  const template = row ? mapTemplateRow(row as Record<string, unknown>) : null;
  const simulacoes = template ? await listarSimulacoesDoTemplateId(auth.supabase, template.id) : [];
  const jornada = await carregarJornadaPublica(auth.supabase, cardId);
  return {
    ok: true,
    cardTitulo: card.titulo,
    nomeCondominio: card.nomeCondominio,
    loteadorNome: card.loteadorNome,
    redeLoteadorId: card.redeLoteadorId,
    template,
    link: linkCompleto(template?.link_token),
    empreendimentoSlug: jornada.pageSlug,
    linkMoni: linkJornadaPublica(jornada.pageSlug),
    simulacoes,
    jornada,
  };
}

function rowSemColunas576(row: Record<string, unknown>): Record<string, unknown> {
  const { tipo_juros_cp, ...rest } = row;
  void tipo_juros_cp;
  return rest;
}

function rowSemColunas575(row: Record<string, unknown>): Record<string, unknown> {
  const { tipo_taxa_gestao, pct_plataforma_entrada, ...rest } = row;
  void tipo_taxa_gestao;
  void pct_plataforma_entrada;
  return rest;
}

const SLUG_DUPLICADO =
  'Este slug já está em uso por outro empreendimento. Escolha um slug diferente.';

export async function salvarTemplate(
  cardId: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string; pageAtiva?: boolean }> {
  const id = String(cardId ?? '').trim();
  if (!id) return { success: false, error: 'Card inválido.' };

  const auth = await requireStaff();
  if (!auth.ok) return { success: false, error: auth.error };
  const card = await carregarCardLoteadores(auth.supabase, id);
  if (!card.ok) return { success: false, error: card.error };

  const slug = (formData.get('page_slug') as string)?.trim() || null;
  const planilha = (formData.get('planilha_lotes_path') as string)?.trim() || null;
  const pageAtiva = !!(slug && planilha);

  if (slug) {
    const { data: existing, error: errSlug } = await auth.supabase
      .from('imob_card_modelo')
      .select('card_id')
      .eq('page_slug', slug)
      .neq('card_id', id)
      .maybeSingle();
    if (errSlug) return { success: false, error: errSlug.message };
    if (existing) return { success: false, error: SLUG_DUPLICADO };
  }

  const patch = {
    page_slug: slug,
    page_ativa: pageAtiva,
    planilha_lotes_path: planilha,
  };

  const { data: updated, error } = await auth.supabase
    .from('imob_card_modelo')
    .update(patch)
    .eq('card_id', id)
    .select('card_id');

  if (error) {
    if (error.code === '23505') return { success: false, error: SLUG_DUPLICADO };
    return { success: false, error: error.message };
  }

  if (!updated?.length) {
    const { error: insErr } = await auth.supabase
      .from('imob_card_modelo')
      .insert({ card_id: id, ...patch });
    if (insErr) {
      if (insErr.code === '23505') return { success: false, error: SLUG_DUPLICADO };
      return { success: false, error: insErr.message };
    }
  }

  revalidateAposMutacaoSimulador(id);
  if (slug) revalidatePath(`/empreendimento/${slug}`);
  return { success: true, pageAtiva };
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
      pct_taxa_gestao:
        draft.tipo_taxa_gestao === 'fixo'
          ? Math.max(
              0,
              parseMoneyText(draft.valor_taxa_gestao) ?? parseDecimalInput(draft.valor_taxa_gestao) ?? 0,
            )
          : percentualUiParaFracao(draft.pct_taxa_gestao),
      tipo_taxa_gestao: draft.tipo_taxa_gestao === 'fixo' ? 'fixo' : 'percentual',
      pct_plataforma_entrada: Math.min(
        1,
        Math.max(0, percentualUiOpcionalParaFracao(draft.pct_plataforma_entrada) ?? 0),
      ),
      pct_lucro_loteadora: percentualUiParaFracao(draft.pct_lucro_loteadora),
      pct_lucro_moni: percentualUiParaFracao(draft.pct_lucro_moni),
      pct_lucro_franqueado: percentualUiParaFracao(draft.pct_lucro_franqueado),
      pct_impostos: percentualUiParaFracao(draft.pct_impostos),
      pct_comissao_corretor: percentualUiParaFracao(draft.pct_comissao_corretor),
      taxa_juros_credito_ponte:
        draft.taxa_juros_credito_ponte.trim() === ''
          ? JUROS_CREDITO_PONTE_PADRAO_FRACAO
          : percentualUiParaFracao(draft.taxa_juros_credito_ponte),
      tipo_juros_cp: draft.tipo_juros_cp === 'total' ? 'total' : 'mes_a_mes',
      taxa_juros_financiamento_anual:
        draft.taxa_juros_financiamento_anual.trim() === ''
          ? TAXA_JUROS_FINANCIAMENTO_ANUAL_PADRAO_FRACAO
          : percentualUiParaFracao(draft.taxa_juros_financiamento_anual),
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
  formData?: FormData,
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
  if (errExist && errExist.code !== 'PGRST116') {
    return erroBancoSimulador(errExist.message);
  }

  const payloads = [
    row,
    rowSemColunas576(row),
    rowSemColunas575(rowSemColunas576(row)),
    rowSemColunas546(rowSemColunas575(rowSemColunas576(row))),
    rowSemColunas545(rowSemColunas546(rowSemColunas575(rowSemColunas576(row)))),
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
      if (
        !isColunaSimulador546Ausente(error.message) &&
        !isColunaSimuladorAjusteAusente(error.message) &&
        !isColunaSimulador575Ausente(error.message) &&
        !isColunaSimulador576Ausente(error.message)
      ) {
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
      if (
        !isColunaSimulador546Ausente(error.message) &&
        !isColunaSimuladorAjusteAusente(error.message) &&
        !isColunaSimulador575Ausente(error.message) &&
        !isColunaSimulador576Ausente(error.message)
      ) {
        return erroBancoSimulador(error.message);
      }
    }
  }
  if (!saved) {
    return erroBancoSimulador(lastError ?? 'Não foi possível salvar o template.');
  }

  let pageAtiva: boolean | undefined;
  if (formData) {
    const jornada = await salvarTemplate(cardId, formData);
    if (!jornada.success) {
      return { ok: false, error: jornada.error ?? 'Não foi possível salvar a jornada pública.' };
    }
    pageAtiva = jornada.pageAtiva;
  }

  const template = mapTemplateRow(saved);

  // slug + page_ativa are handled by salvarTemplate above (via formData)
  // If formData was not provided, we skip slug persistence
  let pageSlugFinal: string | null = null;
  if (formData) {
    const slugRaw = (formData.get('page_slug') as string)?.trim() || null;
    pageSlugFinal = slugRaw;
  }

  revalidateAposMutacaoSimulador(cardId, pageSlugFinal);
  return {
    ok: true,
    template,
    link: linkCompleto(template.link_token),
    linkMoni: pageSlugFinal ? linkJornadaPublica(pageSlugFinal) : null,
    pageSlug: pageSlugFinal,
    mensagem: TOAST_TEMPLATE_SALVO,
    pageAtiva,
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
    .not('nome', 'is', null)
    .order('created_at', { ascending: false })
    .limit(80);
  if (error) {
    if (isTabelaSimuladorAusente(error.message)) return [];
    if (isColunaSimulador548Ausente(error.message)) return [];
    console.error('[simulacoes_pagamento] listar:', error.message);
    return [];
  }
  return (data ?? [])
    .map((r) => mapSimulacaoRow(r as Record<string, unknown>))
    .filter((s) => Boolean(s.nome?.trim()));
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
    if (retry.error && retry.error.code !== 'PGRST116') {
      return erroBancoSimulador(retry.error.message);
    }
    tpl = retry.data as { id: string; rede_loteador_id?: string | null } | null;
  } else if (errTpl && errTpl.code !== 'PGRST116') {
    return erroBancoSimulador(errTpl.message);
  }
  if (!tpl?.id) {
    return { ok: false, error: 'Salve o template antes de criar ofertas.' };
  }

  const nome = String(draft.nome ?? '').trim();
  if (!nome) return { ok: false, error: 'Informe o nome da oferta.' };

  const valorLote = parseMoedaCampo(draft.valor_lote, 'o valor do lote à vista', { obrigatorio: true });
  if (!valorLote.ok) return valorLote;
  if (valorLote.valor <= 0) return { ok: false, error: 'Valor do lote à vista deve ser maior que zero.' };
  const valorCasa = parseMoedaCampo(draft.valor_casa, 'o valor da casa', { obrigatorio: true });
  if (!valorCasa.ok) return valorCasa;
  const valorCustom = parseMoedaCampo(draft.valor_customizacao, 'o valor da customização', { padrao: 0 });
  if (!valorCustom.ok) return valorCustom;
  const valorAcoplamento = parseMoedaCampo(draft.valor_acoplamento ?? '', 'o valor do acoplamento', { padrao: 0 });
  if (!valorAcoplamento.ok) return valorAcoplamento;
  const valorPago = parseMoedaCampo(draft.valor_ja_pago, 'o valor já pago à loteadora', { padrao: 0 });
  if (!valorPago.ok) return valorPago;
  const prazoMeses = parseInteiroCampo(draft.prazo_meses, 'o prazo total do contrato', { obrigatorio: true });
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

  const parcelaMensalConfirmada = draft.parcela_mensal_confirmada?.trim()
    ? parseMoedaCampo(draft.parcela_mensal_confirmada, 'a parcela mensal confirmada')
    : { ok: true as const, valor: parcelaMensal.valor };
  if (!parcelaMensalConfirmada.ok) return parcelaMensalConfirmada;

  const inputs = {
    nome,
    empreendimento_id: String(draft.empreendimento_id ?? '').trim() || null,
    valor_lote: valorLote.valor,
    valor_casa: valorCasa.valor,
    valor_customizacao: valorCustom.valor,
    valor_acoplamento: valorAcoplamento.valor,
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
    parcela_mensal_confirmada: draft.parcela_mensal_confirmada?.trim()
      ? parcelaMensalConfirmada.valor
      : parcelaMensal.valor,
    vte_avista: draft.vte_avista ?? null,
    entrada_sugerida: draft.entrada_sugerida ?? null,
    parcela_mensal_sugerida: draft.parcela_mensal_sugerida ?? null,
    parcela_unica_sugerida: draft.parcela_unica_sugerida ?? null,
    prazo_total_meses: draft.prazo_total_meses ?? prazoMeses.valor,
  };

  const resultadoSnapshot = {
    vte_avista: draft.vte_avista ?? null,
    entrada_sugerida: draft.entrada_sugerida ?? null,
    parcela_mensal_usada: draft.parcela_mensal_sugerida ?? null,
    parcela_unica_sugerida: draft.parcela_unica_sugerida ?? null,
    quantidade_parcelas_total: draft.prazo_total_meses ?? prazoMeses.valor,
  };

  const rowCheio: Record<string, unknown> = {
    template_id: tpl.id,
    kanban_card_id: cardId,
    rede_loteador_id: tpl.rede_loteador_id ?? card.redeLoteadorId,
    created_by: auth.userId,
    nome,
    condicao_lote: inferirCondicaoLote(valorPago.valor),
    renda_informada_cliente: renda.valor || null,
    valor_lote: valorLote.valor,
    valor_casa: valorCasa.valor,
    valor_customizacao: valorCustom.valor,
    valor_acoplamento: valorAcoplamento.valor,
    valor_ja_pago: valorPago.valor,
    prazo_meses: prazoMeses.valor,
    parcela_mensal: parcelaMensal.valor,
    renda_cliente: renda.valor || null,
    prazo_financiamento_anos: prazoFin.valor,
    taxa_financiamento_anual: taxaFin,
    inputs,
    resultado: resultadoSnapshot,
    alertas: [],
    status: 'rascunho',
  };

  const { data, error } = await auth.supabase
    .from('simulacoes_pagamento')
    .insert(rowCheio as never)
    .select('*')
    .single();

  let saved = data as Record<string, unknown> | null;
  if (error && isColunaSimulador571Ausente(error.message)) {
    const { valor_acoplamento, ...sem571 } = rowCheio;
    void valor_acoplamento;
    const retry571 = await auth.supabase
      .from('simulacoes_pagamento')
      .insert(sem571 as never)
      .select('*')
      .single();
    if (retry571.error) return erroBancoSimulador(retry571.error.message);
    saved = retry571.data as Record<string, unknown>;
  } else if (error && isColunaSimulador547Ausente(error.message)) {
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
  } else if (error && isColunaSimulador548Ausente(error.message)) {
    return erroBancoSimulador(error.message);
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

  const oferta = mapSimulacaoRow(saved);
  const empId = String(draft.empreendimento_id ?? '').trim();
  if (empId) {
    const valores = valoresImobDaSimulacao(oferta);
    const vinculo = await vincularOfertaAoEmpreendimentoImob(cardId, empId, {
      simulacao_pagamento_id: oferta.id,
      ...valores,
    });
    if (!vinculo.ok) return vinculo;
  }

  revalidateAposMutacaoSimulador(cardId);
  return {
    ok: true,
    mensagem: 'Oferta salva como rascunho!',
    oferta,
  };
}

export async function carregarSimuladorOfertaDoCard(
  cardId: string,
  ofertaId: string,
): Promise<
  | {
      ok: true;
      oferta: SimulacaoPagamentoResumo;
      template: LoteamentoSimuladorTemplateRow | null;
      loteadorNome: string | null;
    }
  | Err
> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;
  const card = await carregarCardLoteadores(auth.supabase, cardId);
  if (!card.ok) return card;

  const { data, error } = await auth.supabase
    .from('simulacoes_pagamento')
    .select('*')
    .eq('id', ofertaId)
    .eq('kanban_card_id', cardId)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') return erroBancoSimulador(error.message);
  if (!data) return { ok: false, error: 'Oferta não encontrada.' };

  const raw = data as Record<string, unknown>;
  const oferta = mapSimulacaoRow(raw);
  const templateId = oferta.template_id;
  if (!templateId) {
    return { ok: true, oferta, template: null, loteadorNome: card.loteadorNome };
  }

  const { data: tplData, error: tplError } = await auth.supabase
    .from(TABELA)
    .select('*')
    .eq('id', templateId)
    .maybeSingle();
  if (tplError && tplError.code !== 'PGRST116') return erroBancoSimulador(tplError.message);
  const template = tplData ? mapTemplateRow(tplData as Record<string, unknown>) : null;
  return { ok: true, oferta, template, loteadorNome: card.loteadorNome };
}

export async function excluirOfertaSimulacao(
  ofertaId: string,
  cardId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const oid = String(ofertaId ?? '').trim();
  const cid = String(cardId ?? '').trim();
  if (!oid || !cid) return { ok: false, error: 'IDs inválidos.' };

  const auth = await requireStaff();
  if (!auth.ok) return auth;
  const { supabase } = auth;

  // Limpar FK em imob_card_empreendimentos antes de deletar
  await supabase
    .from('imob_card_empreendimentos')
    .update({ simulacao_pagamento_id: null })
    .eq('simulacao_pagamento_id', oid);

  const { error } = await supabase
    .from('simulacoes_pagamento')
    .delete()
    .eq('id', oid)
    .eq('kanban_card_id', cid); // segurança: só deleta se pertence ao card

  if (error) return { ok: false, error: error.message };

  revalidateAposMutacaoSimulador(cid);
  return { ok: true };
}

export async function atualizarSimuladorOferta(
  cardId: string,
  ofertaId: string,
  draft: SimuladorOfertaDraft,
): Promise<{ ok: true; mensagem: string; oferta: SimulacaoPagamentoResumo } | Err> {
  const oid = String(ofertaId ?? '').trim();
  const cid = String(cardId ?? '').trim();
  if (!oid || !cid) return { ok: false, error: 'IDs inválidos.' };

  const auth = await requireStaff();
  if (!auth.ok) return auth;
  const { supabase } = auth;

  const { data: tplData, error: errTpl } = await supabase
    .from(TABELA)
    .select('id, taxa_juros_financiamento_anual')
    .eq('kanban_card_id', cid)
    .maybeSingle();
  const tpl = tplData as { id: string; taxa_juros_financiamento_anual?: number | null } | null;
  if (errTpl && errTpl.code !== 'PGRST116') return erroBancoSimulador(errTpl.message);

  const nome = String(draft.nome ?? '').trim();
  if (!nome) return { ok: false, error: 'Informe o nome da oferta.' };

  const valorLote = parseMoedaCampo(draft.valor_lote, 'o valor do lote à vista', { obrigatorio: true });
  if (!valorLote.ok) return valorLote;
  if (valorLote.valor <= 0) return { ok: false, error: 'Valor do lote à vista deve ser maior que zero.' };
  const valorCasa = parseMoedaCampo(draft.valor_casa, 'o valor da casa', { obrigatorio: true });
  if (!valorCasa.ok) return valorCasa;
  const valorCustom = parseMoedaCampo(draft.valor_customizacao, 'o valor da customização', { padrao: 0 });
  if (!valorCustom.ok) return valorCustom;
  const valorAcoplamento = parseMoedaCampo(draft.valor_acoplamento ?? '', 'o valor do acoplamento', { padrao: 0 });
  if (!valorAcoplamento.ok) return valorAcoplamento;
  const valorPago = parseMoedaCampo(draft.valor_ja_pago, 'o valor já pago à loteadora', { padrao: 0 });
  if (!valorPago.ok) return valorPago;
  const prazoMeses = parseInteiroCampo(draft.prazo_meses, 'o prazo total do contrato', { obrigatorio: true });
  if (!prazoMeses.ok) return prazoMeses;
  const parcelaMensal = parseMoedaCampo(draft.parcela_mensal, 'a parcela mensal', { obrigatorio: true });
  if (!parcelaMensal.ok) return parcelaMensal;
  const renda = parseMoedaCampo(draft.renda_cliente, 'a renda do cliente');
  if (!renda.ok) return renda;
  const prazoFin = parseInteiroCampo(draft.prazo_financiamento_anos, 'o prazo de financiamento');
  if (!prazoFin.ok) return prazoFin;
  const taxaFin = draft.taxa_financiamento_anual.trim()
    ? percentualUiParaFracao(draft.taxa_financiamento_anual)
    : Number(tpl?.taxa_juros_financiamento_anual) || TAXA_JUROS_FINANCIAMENTO_ANUAL_PADRAO_FRACAO;
  if (taxaFin < 0) return { ok: false, error: 'Taxa do financiamento inválida.' };

  const entradaConfirmada = draft.entrada_confirmada?.trim()
    ? parseMoedaCampo(draft.entrada_confirmada, 'a entrada confirmada')
    : { ok: true as const, valor: 0 };
  if (!entradaConfirmada.ok) return entradaConfirmada;
  const parcelaUnicaConfirmada = draft.parcela_unica_confirmada?.trim()
    ? parseMoedaCampo(draft.parcela_unica_confirmada, 'a parcela única confirmada')
    : { ok: true as const, valor: 0 };
  if (!parcelaUnicaConfirmada.ok) return parcelaUnicaConfirmada;
  const parcelaMensalConfirmada = draft.parcela_mensal_confirmada?.trim()
    ? parseMoedaCampo(draft.parcela_mensal_confirmada, 'a parcela mensal confirmada')
    : { ok: true as const, valor: parcelaMensal.valor };
  if (!parcelaMensalConfirmada.ok) return parcelaMensalConfirmada;

  const inputs = {
    nome,
    empreendimento_id: String(draft.empreendimento_id ?? '').trim() || null,
    valor_lote: valorLote.valor,
    valor_casa: valorCasa.valor,
    valor_customizacao: valorCustom.valor,
    valor_acoplamento: valorAcoplamento.valor,
    valor_ja_pago: valorPago.valor,
    prazo_meses: prazoMeses.valor,
    parcela_mensal: parcelaMensal.valor,
    renda_cliente: renda.valor || null,
    prazo_financiamento_anos: prazoFin.valor,
    taxa_financiamento_anual: taxaFin,
    entrada_confirmada: draft.entrada_confirmada?.trim() ? entradaConfirmada.valor : null,
    parcela_unica_confirmada: draft.parcela_unica_confirmada?.trim() ? parcelaUnicaConfirmada.valor : null,
    parcela_mensal_confirmada: parcelaMensalConfirmada.valor,
    vte_avista: draft.vte_avista ?? null,
    entrada_sugerida: draft.entrada_sugerida ?? null,
    parcela_mensal_sugerida: draft.parcela_mensal_sugerida ?? null,
    parcela_unica_sugerida: draft.parcela_unica_sugerida ?? null,
    prazo_total_meses: draft.prazo_total_meses ?? prazoMeses.valor,
  };

  const resultadoSnapshot = {
    vte_avista: draft.vte_avista ?? null,
    entrada_sugerida: draft.entrada_sugerida ?? null,
    parcela_mensal_usada: draft.parcela_mensal_sugerida ?? null,
    parcela_unica_sugerida: draft.parcela_unica_sugerida ?? null,
    quantidade_parcelas_total: draft.prazo_total_meses ?? prazoMeses.valor,
  };

  // Mesma estrutura do criarSimuladorOfertaDoCard: colunas mais antigas no topo,
  // dados extras apenas em `inputs` para compatibilidade com bancos sem migrations.
  const rowCheio = {
    nome,
    condicao_lote: inferirCondicaoLote(valorPago.valor),
    renda_informada_cliente: renda.valor || null,
    valor_lote: valorLote.valor,
    valor_casa: valorCasa.valor,
    valor_customizacao: valorCustom.valor,
    valor_acoplamento: valorAcoplamento.valor,
    valor_ja_pago: valorPago.valor,
    prazo_meses: prazoMeses.valor,
    parcela_mensal: parcelaMensal.valor,
    renda_cliente: renda.valor || null,
    prazo_financiamento_anos: prazoFin.valor,
    taxa_financiamento_anual: taxaFin,
    inputs,
    resultado: resultadoSnapshot,
  };

  const doUpdate = (payload: Record<string, unknown>) =>
    supabase
      .from('simulacoes_pagamento')
      .update(payload as never)
      .eq('id', oid)
      .eq('kanban_card_id', cid)
      .select('*')
      .single();

  const { data, error } = await doUpdate(rowCheio);

  let saved = data as Record<string, unknown> | null;

  if (error && isColunaSimulador571Ausente(error.message)) {
    const { valor_acoplamento, ...sem571 } = rowCheio;
    void valor_acoplamento;
    const retry571 = await doUpdate(sem571);
    if (retry571.error) return erroBancoSimulador(retry571.error.message);
    saved = retry571.data as Record<string, unknown>;
  } else if (error && isColunaSimulador547Ausente(error.message)) {
    const { parcela_mensal, ...sem547 } = rowCheio;
    void parcela_mensal;
    const retry547 = await doUpdate(sem547);
    if (retry547.error && isColunaSimulador546Ausente(retry547.error.message)) {
      const {
        valor_lote, valor_casa, valor_customizacao, valor_ja_pago,
        prazo_meses, renda_cliente, prazo_financiamento_anos, taxa_financiamento_anual,
        ...semNovas
      } = sem547;
      void valor_lote; void valor_casa; void valor_customizacao; void valor_ja_pago;
      void prazo_meses; void renda_cliente; void prazo_financiamento_anos; void taxa_financiamento_anual;
      const retry546 = await doUpdate(semNovas);
      if (retry546.error) return erroBancoSimulador(retry546.error.message);
      saved = retry546.data as Record<string, unknown>;
    } else if (retry547.error) {
      return erroBancoSimulador(retry547.error.message);
    } else {
      saved = retry547.data as Record<string, unknown>;
    }
  } else if (error && isColunaSimulador546Ausente(error.message)) {
    const {
      valor_lote, valor_casa, valor_customizacao, valor_ja_pago,
      prazo_meses, parcela_mensal, renda_cliente, prazo_financiamento_anos, taxa_financiamento_anual,
      ...semNovas
    } = rowCheio;
    void valor_lote; void valor_casa; void valor_customizacao; void valor_ja_pago;
    void prazo_meses; void parcela_mensal; void renda_cliente; void prazo_financiamento_anos; void taxa_financiamento_anual;
    const retry = await doUpdate(semNovas);
    if (retry.error) return erroBancoSimulador(retry.error.message);
    saved = retry.data as Record<string, unknown>;
  } else if (error) {
    return erroBancoSimulador(error.message);
  }

  if (!saved) return { ok: false, error: 'Oferta não encontrada ou sem permissão.' };

  const oferta = mapSimulacaoRow(saved);
  const empId = String(draft.empreendimento_id ?? oferta.empreendimento_id ?? '').trim();
  if (empId) {
    const valores = valoresImobDaSimulacao(oferta);
    const vinculo = await vincularOfertaAoEmpreendimentoImob(cid, empId, {
      simulacao_pagamento_id: oferta.id,
      ...valores,
    });
    if (!vinculo.ok) return vinculo;
  }

  revalidateAposMutacaoSimulador(cid);
  revalidatePath(`/loteadores/${cid}/simulador-template/ofertas/${oid}`);
  return {
    ok: true,
    mensagem: 'Oferta atualizada com sucesso!',
    oferta,
  };
}
