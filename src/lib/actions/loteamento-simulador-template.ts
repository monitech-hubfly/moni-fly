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
  normalizarSlugJornadaPublica,
  type LoteamentoSimuladorTemplateDraft,
  type LoteamentoSimuladorTemplateRow,
  type SimulacaoPagamentoResumo,
  type SimuladorOfertaDraft,
} from '@/lib/loteamento-simulador-template';
import { vincularOfertaAoEmpreendimentoImob } from '@/lib/actions/imob-simulacoes-card';
import { gerarSlugCard } from '@/lib/utils/slug';
import {
  calcularOferta,
  calcularParcelaUnicaMinimaConfirmada,
  formatarMoedaCentavos,
  parcelaUnicaAbaixoDoMinimo,
  type OfertaConfig,
} from '@/lib/simulador/calcular-oferta';
import { montarTemplateParaEngine } from '@/lib/simulador/montar-template-jornada';

type Ok = {
  ok: true;
  template: LoteamentoSimuladorTemplateRow;
  link: string | null;
  linkMoni: string | null;
  pageSlug: string | null;
  pageAtiva?: boolean;
  mensagem: string;
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
): Promise<{ ok: true; slug: string | null; pageAtiva: boolean } | Err> {
  const slugLimpo = String(slug ?? '').trim() || null;
  if (slugLimpo) {
    const { data: existing, error: errSlug } = await supabase
      .from('imob_card_modelo')
      .select('card_id')
      .eq('page_slug', slugLimpo)
      .neq('card_id', cardId)
      .maybeSingle();
    if (errSlug && !/page_slug|schema cache|does not exist|could not find/i.test(errSlug.message)) {
      return { ok: false, error: errSlug.message };
    }
    if (existing) {
      return {
        ok: false,
        error: 'Este slug já está em uso por outro empreendimento. Escolha um slug diferente.',
      };
    }
  }

  const atual = await supabase
    .from('imob_card_modelo')
    .select('planilha_lotes_path')
    .eq('card_id', cardId)
    .maybeSingle();
  const planilha = String(
    (atual.data as { planilha_lotes_path?: string | null } | null)?.planilha_lotes_path ?? '',
  ).trim();
  const pageAtiva = !!(slugLimpo && planilha);
  const patch = {
    page_slug: slugLimpo,
    page_ativa: pageAtiva,
    updated_at: new Date().toISOString(),
  };
  const upd = await supabase
    .from('imob_card_modelo')
    .update(patch as never)
    .eq('card_id', cardId)
    .select('card_id');
  if (upd.error) return erroSlugJornada(upd.error.message, upd.error.code);
  if ((upd.data ?? []).length > 0) return { ok: true, slug: slugLimpo, pageAtiva };

  const ins = await supabase.from('imob_card_modelo').insert({ card_id: cardId, ...patch } as never);
  if (ins.error) return erroSlugJornada(ins.error.message, ins.error.code);
  return { ok: true, slug: slugLimpo, pageAtiva };
}

function slugDesteCard(cardId: string, nomeCondominio: string | null): string {
  return gerarSlugCard(nomeCondominio, cardId);
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

function mensagemColunas575(): string {
  return 'Colunas tipo_taxa_gestao / taxa_gestao_valor / percentual_plataforma_entrada ausentes neste banco. Aplique a migration 636 e rode NOTIFY pgrst, \'reload schema\'.';
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
      pageAtiva: boolean;
      simulacoes: SimulacaoPagamentoResumo[];
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
  const [simulacoes, slugBanco] = await Promise.all([
    template ? listarSimulacoesDoTemplateId(auth.supabase, template.id) : Promise.resolve([]),
    carregarSlugJornadaDoCard(auth.supabase, cardId),
  ]);
  const slugDoCard = slugDesteCard(cardId, card.nomeCondominio);
  let empreendimentoSlug = slugBanco;
  let pageAtiva = false;
  if (slugDoCard !== (slugBanco ?? '')) {
    const gravado = await persistirSlugJornadaDoCard(auth.supabase, cardId, slugDoCard);
    if (gravado.ok) {
      empreendimentoSlug = gravado.slug;
      pageAtiva = gravado.pageAtiva;
    } else {
      empreendimentoSlug = slugDoCard;
    }
  } else {
    const { data: modelo } = await auth.supabase
      .from('imob_card_modelo')
      .select('page_ativa')
      .eq('card_id', cardId)
      .maybeSingle();
    pageAtiva = (modelo as { page_ativa?: boolean | null } | null)?.page_ativa === true;
    empreendimentoSlug = slugBanco;
  }
  return {
    ok: true,
    cardTitulo: card.titulo,
    nomeCondominio: card.nomeCondominio,
    loteadorNome: card.loteadorNome,
    redeLoteadorId: card.redeLoteadorId,
    template,
    link: linkCompleto(template?.link_token),
    linkMoni: pageAtiva ? linkJornadaPublica(empreendimentoSlug) : null,
    empreendimentoSlug,
    pageAtiva,
    simulacoes,
  };
}

function omitKeys(row: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const next = { ...row };
  for (const key of keys) delete next[key];
  return next;
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

const COLUNAS_575 = ['tipo_taxa_gestao', 'taxa_gestao_valor', 'percentual_plataforma_entrada'] as const;

/**
 * PostgREST/Postgres: "Could not find the 'tipo_juros_cp' column ... schema cache"
 * ou `column "tipo_juros_cp" of relation "..." does not exist`.
 * Só aceita o nome extraído desses padrões — não varre qualquer trecho entre aspas.
 */
function colunaAusenteDoErro(
  message: string,
  payload: Record<string, unknown>,
): string | null {
  const m = message ?? '';
  const especificos = [
    /Could not find the ['"]([a-z_][a-z0-9_]*)['"] column/i,
    /column ['"]([a-z_][a-z0-9_]*)['"] of relation/i,
    /column ([a-z_][a-z0-9_]*) does not exist/i,
  ];
  for (const re of especificos) {
    const hit = m.match(re);
    const col = hit?.[1];
    if (col && Object.prototype.hasOwnProperty.call(payload, col)) return col;
  }
  return null;
}

function payloadAposErroColuna(
  payload: Record<string, unknown>,
  message: string,
): Record<string, unknown> | null {
  const col = colunaAusenteDoErro(message, payload);
  if (!col) return null;
  if ((COLUNAS_575 as readonly string[]).includes(col)) return null;
  if (col === 'prazo_obra_meses' || col === 'entrada_minima_loteadora') {
    return rowSemColunas545(payload);
  }
  return omitKeys(payload, [col]);
}

/** Valores já convertidos em draftParaRow: fração (7% → 0.07), fixo em R$. */
function patchCamposGestaoPlataforma(row: Record<string, unknown>): Record<string, unknown> {
  return {
    pct_taxa_gestao: Number(row.pct_taxa_gestao ?? 0),
    tipo_taxa_gestao: row.tipo_taxa_gestao === 'fixo' ? 'fixo' : 'percentual',
    taxa_gestao_valor: Number(row.taxa_gestao_valor ?? 0),
    percentual_plataforma_entrada: Number(row.percentual_plataforma_entrada ?? 0),
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
      pct_taxa_gestao: Number(percentualUiParaFracao(draft.pct_taxa_gestao)),
      tipo_taxa_gestao: draft.tipo_taxa_gestao === 'fixo' ? 'fixo' : 'percentual',
      taxa_gestao_valor: Math.max(
        0,
        parseMoneyText(draft.taxa_gestao_valor) ?? parseDecimalInput(draft.taxa_gestao_valor) ?? 0,
      ),
      percentual_plataforma_entrada: Number(
        Math.min(1, Math.max(0, percentualUiOpcionalParaFracao(draft.percentual_plataforma_entrada) ?? 0)),
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
  _pageSlugRaw = '',
): Promise<Ok | Err> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;
  const card = await carregarCardLoteadores(auth.supabase, cardId);
  if (!card.ok) return card;

  const slugNorm = normalizarSlugJornadaPublica(slugDesteCard(cardId, card.nomeCondominio));
  if (!slugNorm.ok) return slugNorm;

  const packed = draftParaRow(draft, {
    cardId,
    redeLoteadorId: card.redeLoteadorId,
    userId: auth.userId,
    tituloCard: card.titulo,
  });
  if (!packed.ok) return packed;
  const row = packed.row;
  console.log('[salvarSimuladorTemplate] payload enviado ao Supabase', {
    keys: Object.keys(row),
    tipo_taxa_gestao: row.tipo_taxa_gestao,
    pct_taxa_gestao: row.pct_taxa_gestao,
    taxa_gestao_valor: row.taxa_gestao_valor,
    percentual_plataforma_entrada: row.percentual_plataforma_entrada,
    payload: row,
  });

  const { data: existente, error: errExist } = await auth.supabase
    .from(TABELA)
    .select('id')
    .eq('kanban_card_id', cardId)
    .maybeSingle();
  if (errExist && errExist.code !== 'PGRST116') {
    return erroBancoSimulador(errExist.message);
  }

  let payload: Record<string, unknown> = row;
  let saved: Record<string, unknown> | null = null;
  let lastError: string | null = null;
  for (let tentativa = 0; tentativa < 6; tentativa += 1) {
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
      console.warn('[salvarSimuladorTemplate] update falhou', {
        tentativa,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      if ((COLUNAS_575 as readonly string[]).includes(colunaAusenteDoErro(error.message, payload) ?? '')) {
        return { ok: false, error: mensagemColunas575() };
      }
      const next = payloadAposErroColuna(payload, error.message);
      if (!next) return erroBancoSimulador(error.message);
      payload = next;
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
      console.warn('[salvarSimuladorTemplate] insert falhou', {
        tentativa,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      if ((COLUNAS_575 as readonly string[]).includes(colunaAusenteDoErro(error.message, payload) ?? '')) {
        return { ok: false, error: mensagemColunas575() };
      }
      const next = payloadAposErroColuna(payload, error.message);
      if (!next) return erroBancoSimulador(error.message);
      payload = next;
    }
  }
  if (!saved) {
    return erroBancoSimulador(lastError ?? 'Não foi possível salvar o template.');
  }

  const idSalvo = String(saved.id ?? existente?.id ?? '').trim();
  if (idSalvo) {
    const patch575 = patchCamposGestaoPlataforma(row);
    console.log('[salvarSimuladorTemplate] patch dedicado 575', patch575);
    for (const [coluna, valor] of Object.entries(patch575)) {
      const { data: savedCampo, error: errCampo } = await auth.supabase
        .from(TABELA)
        .update({ [coluna]: valor } as never)
        .eq('id', idSalvo)
        .select('*')
        .single();
      if (!errCampo && savedCampo) {
        saved = savedCampo as Record<string, unknown>;
        continue;
      }
      if (!errCampo) continue;
      console.warn('[salvarSimuladorTemplate] patch 575 falhou', {
        coluna,
        valor,
        code: errCampo.code,
        message: errCampo.message,
      });
      const ausente = colunaAusenteDoErro(errCampo.message, { [coluna]: valor });
      if (ausente === coluna && (COLUNAS_575 as readonly string[]).includes(coluna)) {
        return { ok: false, error: mensagemColunas575() };
      }
      if (ausente === coluna) continue;
      return erroBancoSimulador(errCampo.message);
    }
  }

  console.log('[salvarSimuladorTemplate] row retornada pelo banco', {
    tipo_taxa_gestao: saved.tipo_taxa_gestao,
    pct_taxa_gestao: saved.pct_taxa_gestao,
    taxa_gestao_valor: saved.taxa_gestao_valor,
    percentual_plataforma_entrada: saved.percentual_plataforma_entrada,
    keys: Object.keys(saved),
  });
  if (
    !Object.prototype.hasOwnProperty.call(saved, 'tipo_taxa_gestao') ||
    !Object.prototype.hasOwnProperty.call(saved, 'percentual_plataforma_entrada') ||
    !Object.prototype.hasOwnProperty.call(saved, 'taxa_gestao_valor')
  ) {
    return { ok: false, error: mensagemColunas575() };
  }

  const template = mapTemplateRow(saved);
  const slugSalvo = await persistirSlugJornadaDoCard(auth.supabase, cardId, slugNorm.slug);
  if (!slugSalvo.ok) return slugSalvo;

  revalidateAposMutacaoSimulador(cardId, slugSalvo.slug);
  return {
    ok: true,
    template,
    link: linkCompleto(template.link_token),
    linkMoni: slugSalvo.pageAtiva ? linkJornadaPublica(slugSalvo.slug) : null,
    pageSlug: slugSalvo.slug,
    pageAtiva: slugSalvo.pageAtiva,
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

/**
 * Recusa oferta com parcela única abaixo do mínimo do motor, com as mesmas entradas da
 * CalculadoraOferta (`parcela_mensal` do draft é a confirmada; a base é a sugerida).
 */
async function validarParcelaUnicaMinimaOferta(
  supabase: AuthOk['supabase'],
  cardId: string,
  v: {
    valorLote: number;
    valorCasa: number;
    valorCustomizacao: number;
    valorAcoplamento: number;
    valorJaPago: number;
    prazoTotalMeses: number | null;
    parcelaMensalBase: number;
    renda: number;
    prazoFinanciamentoAnos: number | null;
    taxaFinanciamentoAnual: number;
    entradaConfirmada: number | null;
    mensalConfirmada: number;
    parcelaUnicaConfirmada: number | null;
  },
): Promise<Err | null> {
  if (v.parcelaUnicaConfirmada == null) return null;
  const { data, error } = await supabase.from(TABELA).select('*').eq('kanban_card_id', cardId).limit(1);
  const row = !error && Array.isArray(data) ? data[0] : null;
  if (!row) return null;
  const template = montarTemplateParaEngine(mapTemplateRow(row as Record<string, unknown>));
  const prazoFase1 = (v.prazoTotalMeses ?? 0) - Math.max(0, Math.round(template.prazo_obra_meses));
  if (prazoFase1 < 1) return null;

  const oferta: OfertaConfig = {
    valor_lote: v.valorLote,
    valor_casa: v.valorCasa,
    valor_customizacao: v.valorCustomizacao,
    valor_acoplamento: v.valorAcoplamento,
    valor_ja_pago: v.valorJaPago,
    prazo_meses: prazoFase1,
    parcela_mensal: v.parcelaMensalBase,
    renda_cliente: v.renda,
    prazo_financiamento_anos: v.prazoFinanciamentoAnos ?? 30,
    taxa_financiamento_anual: v.taxaFinanciamentoAnual,
  };
  const sugerido = calcularOferta(template, oferta);
  const entrada =
    v.entradaConfirmada != null && v.entradaConfirmada > 0
      ? v.entradaConfirmada
      : sugerido.entrada_sugerida;
  const mensal = v.mensalConfirmada > 0 ? v.mensalConfirmada : sugerido.parcela_mensal_usada;
  const minimo = calcularParcelaUnicaMinimaConfirmada(template, oferta, entrada, mensal);
  if (!parcelaUnicaAbaixoDoMinimo(v.parcelaUnicaConfirmada, minimo)) return null;
  return {
    ok: false,
    error: `A parcela única precisa ser de pelo menos ${formatarMoedaCentavos(minimo)} para quitar o lote.`,
  };
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

  const erroMinimo = await validarParcelaUnicaMinimaOferta(auth.supabase, cardId, {
    valorLote: valorLote.valor,
    valorCasa: valorCasa.valor,
    valorCustomizacao: valorCustom.valor,
    valorAcoplamento: valorAcoplamento.valor,
    valorJaPago: valorPago.valor,
    prazoTotalMeses: prazoMeses.valor,
    parcelaMensalBase: draft.parcela_mensal_sugerida ?? parcelaMensal.valor,
    renda: renda.valor,
    prazoFinanciamentoAnos: prazoFin.valor,
    taxaFinanciamentoAnual: taxaFin,
    entradaConfirmada: draft.entrada_confirmada?.trim() ? entradaConfirmada.valor : null,
    mensalConfirmada: parcelaMensalConfirmada.valor,
    parcelaUnicaConfirmada: draft.parcela_unica_confirmada?.trim()
      ? parcelaUnicaConfirmada.valor
      : null,
  });
  if (erroMinimo) return erroMinimo;

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

  const erroMinimo = await validarParcelaUnicaMinimaOferta(supabase, cid, {
    valorLote: valorLote.valor,
    valorCasa: valorCasa.valor,
    valorCustomizacao: valorCustom.valor,
    valorAcoplamento: valorAcoplamento.valor,
    valorJaPago: valorPago.valor,
    prazoTotalMeses: prazoMeses.valor,
    parcelaMensalBase: draft.parcela_mensal_sugerida ?? parcelaMensal.valor,
    renda: renda.valor,
    prazoFinanciamentoAnos: prazoFin.valor,
    taxaFinanciamentoAnual: taxaFin,
    entradaConfirmada: draft.entrada_confirmada?.trim() ? entradaConfirmada.valor : null,
    mensalConfirmada: parcelaMensalConfirmada.valor,
    parcelaUnicaConfirmada: draft.parcela_unica_confirmada?.trim() ? parcelaUnicaConfirmada.valor : null,
  });
  if (erroMinimo) return erroMinimo;

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
