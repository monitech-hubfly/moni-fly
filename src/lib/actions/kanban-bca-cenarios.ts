'use server';

import type { BcaInputs, BcaResults } from '@/lib/bca-calc';
import { BCA_DEFAULTS, calcBca } from '@/lib/bca-calc';
import { BCA_CHECKLIST_LABEL_SIMULADOR } from '@/lib/kanban/bca-checklist';
import { CONFIGURADOR_CASAS_CHECKLIST_LABEL_RANKING } from '@/lib/kanban/configurador-casas-checklist';
import type { FaixaMercado } from '@/lib/kanban/mapa-competidores-condominio';
import { gerarResumoBcaHumano, type BcaResumoHumano } from '@/lib/kanban/bca-resumo-humano';
import { parseConfiguradorCasasValores, type ConfiguradorCasasValoresJson } from '@/lib/kanban/configurador-casas-ranking';
import { carregarProspectsCondominioCard } from '@/lib/actions/kanban-condominio-pesquisa';
import { verifyProcessoCasasAccess } from '@/lib/zap-save-casas';
import { KANBAN_IDS, FASE_SLUGS } from '@/lib/constants/kanban-ids';
import { createClient } from '@/lib/supabase/server';

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

/** Autoriza pelo processo e usa cliente autenticado (RLS), não service role — evita 403 em tabelas sem GRANT. */
async function supabaseAposAutorizarBca(
  processoId: string,
): Promise<{ ok: true; supabase: SupabaseServer } | { ok: false; error: string }> {
  const access = await verifyProcessoCasasAccess(processoId.trim());
  if (!access.ok) return access;
  return { ok: true, supabase: await createClient() };
}

export type BcaCenarioRow = {
  id: string;
  card_id: string;
  processo_id: string;
  prospect_row_id: string;
  condominio_nome: string;
  ordem: number;
  catalogo_casa_id: string | null;
  topografia: string | null;
  faixa_mercado: FaixaMercado | null;
  inputs: Partial<BcaInputs>;
  resultado: BcaResults | null;
  resumo: BcaResumoHumano | null;
  status: 'rascunho' | 'confirmado';
  confirmado_em: string | null;
};

export type CatalogoCasaBca = {
  id: string;
  nome: string | null;
  topografia: string | null;
  area_m2: number | null;
  largura_m: number | null;
  profundidade_m: number | null;
  quartos: number | null;
  banheiros: number | null;
  vagas: number | null;
};

export type BcaChecklistData =
  | {
      ok: true;
      catalogo: CatalogoCasaBca[];
      cenarios: BcaCenarioRow[];
      custosConfigurador: ConfiguradorCasasValoresJson;
    }
  | { ok: false; error: string };

function rowToBcaCenario(row: Record<string, unknown>): BcaCenarioRow {
  const inputs = (row.inputs_json as Partial<BcaInputs>) ?? {};
  let resultado: BcaResults | null = null;
  let resumo: BcaResumoHumano | null = null;
  try {
    const merged: BcaInputs = { ...BCA_DEFAULTS, ...inputs };
    resultado = calcBca(merged);
    resumo = gerarResumoBcaHumano(merged, resultado);
  } catch {
    resultado = null;
    resumo = null;
  }
  return {
    id: String(row.id),
    card_id: String(row.card_id),
    processo_id: String(row.processo_id),
    prospect_row_id: String(row.prospect_row_id ?? ''),
    condominio_nome: String(row.condominio_nome ?? ''),
    ordem: Number(row.ordem ?? 1),
    catalogo_casa_id: (row.catalogo_casa_id as string | null) ?? null,
    topografia: (row.topografia as string | null) ?? null,
    faixa_mercado: (row.faixa_mercado as FaixaMercado | null) ?? null,
    inputs,
    resultado,
    resumo,
    status: row.status === 'confirmado' ? 'confirmado' : 'rascunho',
    confirmado_em: (row.confirmado_em as string | null) ?? null,
  };
}

export async function carregarCustosConfiguradorPorCard(
  cardId: string,
): Promise<ConfiguradorCasasValoresJson> {
  const cid = cardId.trim();
  if (!cid) return { v: 1, valores: {} };

  const supabase = await createClient();
  const { data: fase } = await supabase
    .from('kanban_fases')
    .select('id')
    .eq('kanban_id', KANBAN_IDS.STEP_ONE)
    .eq('slug', FASE_SLUGS.CONFIGURADOR_CASAS)
    .maybeSingle();

  if (!fase?.id) return { v: 1, valores: {} };

  const { data: item } = await supabase
    .from('kanban_fase_checklist_itens')
    .select('id')
    .eq('fase_id', fase.id)
    .eq('label', CONFIGURADOR_CASAS_CHECKLIST_LABEL_RANKING)
    .maybeSingle();

  if (!item?.id) return { v: 1, valores: {} };

  const { data: resp } = await supabase
    .from('kanban_fase_checklist_respostas')
    .select('valor')
    .eq('card_id', cid)
    .eq('item_id', item.id)
    .maybeSingle();

  return parseConfiguradorCasasValores((resp as { valor?: string | null } | null)?.valor ?? '');
}

export async function carregarBcaChecklistData(
  cardId: string,
  processoId: string,
): Promise<BcaChecklistData> {
  const cid = cardId.trim();
  const pid = processoId.trim();
  if (!cid || !pid) return { ok: false, error: 'Card ou processo inválido.' };

  const auth = await supabaseAposAutorizarBca(pid);
  if (!auth.ok) return { ok: false, error: auth.error };
  const supabase = auth.supabase;

  const [catRes, cenRes, custosConfigurador] = await Promise.all([
    supabase
      .from('catalogo_casas')
      .select('id, nome, topografia, area_m2, largura_m, profundidade_m, quartos, banheiros, vagas')
      .eq('ativo', true)
      .order('nome', { ascending: true }),
    supabase
      .from('bca_cenarios')
      .select('*')
      .eq('card_id', cid)
      .order('prospect_row_id', { ascending: true })
      .order('ordem', { ascending: true }),
    carregarCustosConfiguradorPorCard(cid),
  ]);

  if (catRes.error) return { ok: false, error: catRes.error.message };
  if (cenRes.error) {
    const msg = cenRes.error.message ?? '';
    if (msg.includes('bca_cenarios') || msg.includes('schema cache')) {
      return {
        ok: false,
        error:
          'Tabela bca_cenarios não encontrada. Aplique as migrations 328–330 no Supabase DEV.',
      };
    }
    return { ok: false, error: msg };
  }

  const catalogo = (catRes.data ?? []) as CatalogoCasaBca[];
  const cenarios = (cenRes.data ?? []).map((r) => rowToBcaCenario(r as Record<string, unknown>));

  return { ok: true, catalogo, cenarios, custosConfigurador };
}

export async function criarBcaCenario(input: {
  cardId: string;
  processoId: string;
  prospectRowId: string;
  condominioNome: string;
  ordem: number;
}): Promise<{ ok: true; cenario: BcaCenarioRow } | { ok: false; error: string }> {
  const auth = await supabaseAposAutorizarBca(input.processoId.trim());
  if (!auth.ok) return { ok: false, error: auth.error };
  const supabase = auth.supabase;

  const defaults: Partial<BcaInputs> = {
    ...BCA_DEFAULTS,
    nome_condominio: input.condominioNome.trim(),
  };

  const { data, error } = await supabase
    .from('bca_cenarios')
    .insert({
      card_id: input.cardId.trim(),
      processo_id: input.processoId.trim(),
      prospect_row_id: input.prospectRowId.trim(),
      condominio_nome: input.condominioNome.trim(),
      ordem: input.ordem,
      inputs_json: defaults,
      status: 'rascunho',
    })
    .select('*')
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, cenario: rowToBcaCenario(data as Record<string, unknown>) };
}

export async function salvarBcaCenario(input: {
  cenarioId: string;
  processoId: string;
  patch: Partial<BcaInputs> & {
    catalogo_casa_id?: string | null;
    topografia?: string | null;
    faixa_mercado?: FaixaMercado | null;
  };
}): Promise<{ ok: true; cenario: BcaCenarioRow } | { ok: false; error: string }> {
  const auth = await supabaseAposAutorizarBca(input.processoId.trim());
  if (!auth.ok) return { ok: false, error: auth.error };
  const supabase = auth.supabase;

  const { data: existing } = await supabase
    .from('bca_cenarios')
    .select('inputs_json, status')
    .eq('id', input.cenarioId.trim())
    .maybeSingle();

  if (!existing) return { ok: false, error: 'Cenário não encontrado.' };

  const prevInputs = (existing as { inputs_json?: Partial<BcaInputs> }).inputs_json ?? {};
  const mergedInputs = { ...prevInputs, ...input.patch };
  delete (mergedInputs as Record<string, unknown>).catalogo_casa_id;
  delete (mergedInputs as Record<string, unknown>).topografia;
  delete (mergedInputs as Record<string, unknown>).faixa_mercado;

  let resultadoJson: Record<string, unknown> | null = null;
  try {
    const results = calcBca({ ...BCA_DEFAULTS, ...mergedInputs });
    resultadoJson = {
      margem_target_liquidacao: results.margem_target_liquidacao,
      target_pct_vgv: results.target.pct_vgv_alavancado,
      target_tir_terrenista_cdi: results.target.tir_terrenista_pct_cdi,
    };
  } catch {
    resultadoJson = null;
  }

  const updateRow: Record<string, unknown> = {
    inputs_json: mergedInputs,
    resultado_json: resultadoJson,
    updated_at: new Date().toISOString(),
  };
  if (input.patch.catalogo_casa_id !== undefined) {
    updateRow.catalogo_casa_id = input.patch.catalogo_casa_id;
  }
  if (input.patch.topografia !== undefined) updateRow.topografia = input.patch.topografia;
  if (input.patch.faixa_mercado !== undefined) updateRow.faixa_mercado = input.patch.faixa_mercado;

  const { data, error } = await supabase
    .from('bca_cenarios')
    .update(updateRow)
    .eq('id', input.cenarioId.trim())
    .select('*')
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, cenario: rowToBcaCenario(data as Record<string, unknown>) };
}

export async function confirmarBcaCenario(
  cenarioId: string,
  processoId: string,
): Promise<{ ok: true; cenario: BcaCenarioRow } | { ok: false; error: string }> {
  const auth = await supabaseAposAutorizarBca(processoId.trim());
  if (!auth.ok) return { ok: false, error: auth.error };
  const supabase = auth.supabase;

  const { data, error } = await supabase
    .from('bca_cenarios')
    .update({
      status: 'confirmado',
      confirmado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', cenarioId.trim())
    .select('*')
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, cenario: rowToBcaCenario(data as Record<string, unknown>) };
}

export async function listarProspectsParaBca(cardId: string) {
  return carregarProspectsCondominioCard(cardId.trim());
}

export { BCA_CHECKLIST_LABEL_SIMULADOR };

// ─── BcaCondominioChecklist (colunas planas em bca_cenarios) ─────────────────

export type BcaCondominioCenario = {
  id: string;
  card_id: string;
  processo_id: string | null;
  prospect_row_id: string;
  condominio_nome: string;
  label: string;
  ordem: number;
  status: 'rascunho' | 'completo' | 'confirmado';
  confirmado_em: string | null;
  catalogo_casa_id: string | null;
  casa_nome: string | null;
  casa_area_m2: number | null;
  casa_largura_m: number | null;
  casa_profundidade_m: number | null;
  casa_quartos: number | null;
  casa_suites: number | null;
  casa_banheiros: number | null;
  casa_vagas: number | null;
  custo_casa: number | null;
  custo_terreno: number | null;
  itbi_percentual: number | null;
  cet_am: number | null;
  mes_inicio_obra: number | null;
  mes_venda_target: number | null;
  custo_projetos: number | null;
  fluxo_obra_json: Record<string, unknown> | null;
  vgv_target: number | null;
  vgv_liquidacao: number | null;
  vgv_recompra: number | null;
};

export type CatalogoCasaBcaCondominio = {
  id: string;
  nome: string | null;
  area_m2: number | null;
  largura_m: number | null;
  profundidade_m: number | null;
  quartos: number | null;
  suites: number | null;
  banheiros: number | null;
  vagas: number | null;
  custo_projetos_padrao: number | null;
  mes_inicio_obra_padrao: number | null;
  fluxo_obra_json: Record<string, unknown> | null;
};

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function rowToBcaCondominioCenario(row: Record<string, unknown>): BcaCondominioCenario {
  return {
    id: String(row.id),
    card_id: String(row.card_id),
    processo_id: (row.processo_id as string | null) ?? null,
    prospect_row_id: String(row.prospect_row_id ?? ''),
    condominio_nome: String(row.condominio_nome ?? ''),
    label: String(row.label ?? `Casa ${row.ordem ?? 1}`),
    ordem: Number(row.ordem ?? 1),
    status:
      row.status === 'completo' || row.status === 'confirmado'
        ? (row.status as 'completo' | 'confirmado')
        : 'rascunho',
    confirmado_em: (row.confirmado_em as string | null) ?? null,
    catalogo_casa_id: (row.catalogo_casa_id as string | null) ?? null,
    casa_nome: (row.casa_nome as string | null) ?? null,
    casa_area_m2: numOrNull(row.casa_area_m2),
    casa_largura_m: numOrNull(row.casa_largura_m),
    casa_profundidade_m: numOrNull(row.casa_profundidade_m),
    casa_quartos: numOrNull(row.casa_quartos),
    casa_suites: numOrNull(row.casa_suites),
    casa_banheiros: numOrNull(row.casa_banheiros),
    casa_vagas: numOrNull(row.casa_vagas),
    custo_casa: numOrNull(row.custo_casa),
    custo_terreno: numOrNull(row.custo_terreno),
    itbi_percentual: numOrNull(row.itbi_percentual),
    cet_am: numOrNull(row.cet_am),
    mes_inicio_obra: numOrNull(row.mes_inicio_obra),
    mes_venda_target: numOrNull(row.mes_venda_target),
    custo_projetos: numOrNull(row.custo_projetos),
    fluxo_obra_json: (row.fluxo_obra_json as Record<string, unknown> | null) ?? null,
    vgv_target: numOrNull(row.vgv_target),
    vgv_liquidacao: numOrNull(row.vgv_liquidacao),
    vgv_recompra: numOrNull(row.vgv_recompra),
  };
}

export type BcaCondominioChecklistData =
  | { ok: true; catalogo: CatalogoCasaBcaCondominio[]; cenarios: BcaCondominioCenario[] }
  | { ok: false; error: string };

export async function carregarBcaCondominioChecklistData(
  cardId: string,
  processoId: string,
): Promise<BcaCondominioChecklistData> {
  const cid = cardId.trim();
  const pid = processoId.trim();
  if (!cid || !pid) return { ok: false, error: 'Card ou processo inválido.' };

  const auth = await supabaseAposAutorizarBca(pid);
  if (!auth.ok) return { ok: false, error: auth.error };
  const supabase = auth.supabase;

  const selectCatalogoCompleto =
    'id, nome, area_m2, largura_m, profundidade_m, quartos, suites, banheiros, vagas, custo_projetos_padrao, mes_inicio_obra_padrao, fluxo_obra_json';
  const selectCatalogoBasico =
    'id, nome, area_m2, largura_m, profundidade_m, quartos, suites, banheiros, vagas';

  const catResCompleto = await supabase
    .from('catalogo_casas')
    .select(selectCatalogoCompleto)
    .eq('ativo', true)
    .order('nome', { ascending: true });

  const catRes = catResCompleto.error
    ? await supabase
        .from('catalogo_casas')
        .select(selectCatalogoBasico)
        .eq('ativo', true)
        .order('nome', { ascending: true })
    : catResCompleto;

  const cenRes = await supabase
    .from('bca_cenarios')
    .select('*')
    .eq('card_id', cid)
    .order('prospect_row_id', { ascending: true })
    .order('ordem', { ascending: true });

  if (catRes.error) return { ok: false, error: catRes.error.message };
  if (cenRes.error) {
    const msg = cenRes.error.message ?? '';
    if (msg.includes('bca_cenarios') || msg.includes('schema cache')) {
      return {
        ok: false,
        error:
          'Tabela bca_cenarios não encontrada. Aplique as migrations 328–330 no Supabase DEV.',
      };
    }
    return { ok: false, error: msg };
  }

  const catalogo = ((catRes.data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    nome: (row.nome as string | null) ?? null,
    area_m2: numOrNull(row.area_m2),
    largura_m: numOrNull(row.largura_m),
    profundidade_m: numOrNull(row.profundidade_m),
    quartos: numOrNull(row.quartos),
    suites: numOrNull(row.suites),
    banheiros: numOrNull(row.banheiros),
    vagas: numOrNull(row.vagas),
    custo_projetos_padrao: numOrNull(row.custo_projetos_padrao),
    mes_inicio_obra_padrao: numOrNull(row.mes_inicio_obra_padrao),
    fluxo_obra_json: (row.fluxo_obra_json as Record<string, unknown> | null) ?? null,
  })) satisfies CatalogoCasaBcaCondominio[];

  return {
    ok: true,
    catalogo,
    cenarios: (cenRes.data ?? []).map((r) => rowToBcaCondominioCenario(r as Record<string, unknown>)),
  };
}

export async function criarBcaCondominioCenario(input: {
  cardId: string;
  processoId: string;
  prospectRowId: string;
  condominioNome: string;
  ordem: number;
  label: string;
}): Promise<{ ok: true; cenario: BcaCondominioCenario } | { ok: false; error: string }> {
  const auth = await supabaseAposAutorizarBca(input.processoId.trim());
  if (!auth.ok) return { ok: false, error: auth.error };
  const supabase = auth.supabase;

  const { data, error } = await supabase
    .from('bca_cenarios')
    .insert({
      card_id: input.cardId.trim(),
      processo_id: input.processoId.trim(),
      prospect_row_id: input.prospectRowId.trim(),
      condominio_nome: input.condominioNome.trim(),
      label: input.label.trim(),
      ordem: input.ordem,
      status: 'rascunho',
      itbi_percentual: 0.04,
      cet_am: 0.021,
      mes_venda_target: 8,
      mes_venda_liquidacao: 12,
    })
    .select('*')
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, cenario: rowToBcaCondominioCenario(data as Record<string, unknown>) };
}

export type BcaCondominioCenarioPatch = Partial<{
  catalogo_casa_id: string | null;
  casa_nome: string | null;
  casa_area_m2: number | null;
  casa_largura_m: number | null;
  casa_profundidade_m: number | null;
  casa_quartos: number | null;
  casa_suites: number | null;
  casa_banheiros: number | null;
  casa_vagas: number | null;
  custo_projetos: number | null;
  mes_inicio_obra: number | null;
  fluxo_obra_json: Record<string, unknown> | null;
  custo_casa: number | null;
  custo_terreno: number | null;
  itbi_percentual: number | null;
  cet_am: number | null;
  vgv_target: number | null;
  vgv_liquidacao: number | null;
  vgv_recompra: number | null;
  label: string;
}>;

export async function salvarBcaCondominioCenario(input: {
  cenarioId: string;
  processoId: string;
  patch: BcaCondominioCenarioPatch;
}): Promise<{ ok: true; cenario: BcaCondominioCenario } | { ok: false; error: string }> {
  const auth = await supabaseAposAutorizarBca(input.processoId.trim());
  if (!auth.ok) return { ok: false, error: auth.error };
  const supabase = auth.supabase;

  const updateRow: Record<string, unknown> = {
    ...input.patch,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('bca_cenarios')
    .update(updateRow)
    .eq('id', input.cenarioId.trim())
    .select('*')
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, cenario: rowToBcaCondominioCenario(data as Record<string, unknown>) };
}

export async function confirmarBcaCondominioCenario(
  cenarioId: string,
  processoId: string,
): Promise<{ ok: true; cenario: BcaCondominioCenario } | { ok: false; error: string }> {
  const auth = await supabaseAposAutorizarBca(processoId.trim());
  if (!auth.ok) return { ok: false, error: auth.error };
  const supabase = auth.supabase;

  const { data, error } = await supabase
    .from('bca_cenarios')
    .update({
      status: 'completo',
      confirmado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', cenarioId.trim())
    .select('*')
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, cenario: rowToBcaCondominioCenario(data as Record<string, unknown>) };
}
