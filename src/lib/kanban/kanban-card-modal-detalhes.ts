import type { SupabaseClient } from '@supabase/supabase-js';
import { aplicarDataEnvioCreditoObraNoPreObra } from '@/lib/pre-obra/credito-obra-envio-data';
import type { NegocioPrazoModo } from '@/lib/kanban/dados-negocio-prazo';
import { parseNegociacaoLinhasFromDb, type NegociacaoLinha, type NegociacaoLinhaDb } from '@/lib/kanban/negociacao-linhas';
import type { SlaTipo } from '@/lib/dias-uteis';

/** Linha `rede_franqueados` para o painel esquerdo do modal Kanban. */
export type RedeFranqueadoModalRow = {
  id: string;
  n_franquia: string | null;
  nome_completo: string | null;
  status_franquia: string | null;
  modalidade: string | null;
  classificacao_franqueado: string | null;
  area_atuacao: string | null;
  email_frank: string | null;
  telefone_frank: string | null;
  cpf_frank: string | null;
  data_nasc_frank: string | null;
  responsavel_comercial: string | null;
  tamanho_camisa_frank: string | null;
  data_ass_cof: string | null;
  data_ass_contrato: string | null;
  data_expiracao_franquia: string | null;
  endereco_casa_frank: string | null;
  endereco_casa_frank_numero: string | null;
  endereco_casa_frank_complemento: string | null;
  cep_casa_frank: string | null;
  cidade_casa_frank: string | null;
  estado_casa_frank: string | null;
  socios: string | null;
  processo_id: string | null;
  contrato_franquia_path: string | null;
};

/** Campos de negócio + pré-obra em `processo_step_one` para o modal. */
export type ProcessoModalNegocioPreObra = {
  id: string;
  tipo_aquisicao_terreno: string | null;
  valor_terreno: string | null;
  vgv_pretendido: string | null;
  produto_modelo_casa: string | null;
  link_pasta_drive: string | null;
  link_bca: string | null;
  link_gbox: string | null;
  link_mapa_competidores: string | null;
  link_acoplamento: string | null;
  link_apresentacao_comite: string | null;
  anexo_opcao_permuta_path: string | null;
  anexo_contrato_permuta_path: string | null;
  anexo_seguro_garantia_path: string | null;
  link_moni_capital_seguro_garantia: string | null;
  comentario_moni_capital_seguro_garantia: string | null;
  link_moni_capital_gastos_aporte_inicial: string | null;
  comentario_moni_capital_gastos_aporte_inicial: string | null;
  nome_condominio: string | null;
  condominio_id: string | null;
  quadra_lote: string | null;
  quadra: string | null;
  lote: string | null;
  previsao_aprovacao_condominio: string | null;
  previsao_aprovacao_prefeitura: string | null;
  previsao_emissao_alvara: string | null;
  previsao_liberacao_credito_obra: string | null;
  previsao_inicio_obra: string | null;
  data_aprovacao_condominio: string | null;
  data_aprovacao_prefeitura: string | null;
  data_emissao_alvara: string | null;
  data_aprovacao_credito: string | null;
  numero_franquia: string | null;
  origem_rede_franqueados_id: string | null;
  prazo_opcao_dias: number | null;
  prazo_opcao_sla_tipo: SlaTipo | null;
  prazo_opcao_modo: NegocioPrazoModo | null;
  prazo_opcao_fase_id: string | null;
  prazo_opcao_data: string | null;
  prazo_instrumento_garantidor_dias: number | null;
  prazo_instrumento_garantidor_sla_tipo: SlaTipo | null;
  prazo_instrumento_garantidor_modo: NegocioPrazoModo | null;
  prazo_instrumento_garantidor_fase_id: string | null;
  prazo_instrumento_garantidor_data: string | null;
  calculadora_ancora_fase_slug: string | null;
  calculadora_ancora_data_fim: string | null;
  negociacao_linhas: NegociacaoLinha[];
};

const REDE_SELECT = [
  'id',
  'n_franquia',
  'nome_completo',
  'status_franquia',
  'modalidade',
  'classificacao_franqueado',
  'area_atuacao',
  'email_frank',
  'telefone_frank',
  'cpf_frank',
  'data_nasc_frank',
  'responsavel_comercial',
  'tamanho_camisa_frank',
  'data_ass_cof',
  'data_ass_contrato',
  'data_expiracao_franquia',
  'endereco_casa_frank',
  'endereco_casa_frank_numero',
  'endereco_casa_frank_complemento',
  'cep_casa_frank',
  'cidade_casa_frank',
  'estado_casa_frank',
  'socios',
  'processo_id',
  'contrato_franquia_path',
].join(',');

/** Colunas existentes antes das migrations 185/186 (compatível com prod sem migrate). */
const PROCESSO_SELECT_LEGACY = [
  'id',
  'tipo_aquisicao_terreno',
  'valor_terreno',
  'vgv_pretendido',
  'produto_modelo_casa',
  'link_pasta_drive',
  'nome_condominio',
  'condominio_id',
  'quadra_lote',
  'quadra',
  'lote',
  'previsao_aprovacao_condominio',
  'previsao_aprovacao_prefeitura',
  'previsao_emissao_alvara',
  'previsao_liberacao_credito_obra',
  'previsao_inicio_obra',
  'data_aprovacao_condominio',
  'data_aprovacao_prefeitura',
  'data_emissao_alvara',
  'data_aprovacao_credito',
  'numero_franquia',
  'origem_rede_franqueados_id',
].join(',');

/** Links/anexos novos (185 + 186) — opcionais até rodar migration no Supabase. */
const PROCESSO_SELECT_EXTENDED = [
  'link_bca',
  'link_gbox',
  'link_mapa_competidores',
  'link_acoplamento',
  'link_apresentacao_comite',
  'anexo_opcao_permuta_path',
  'anexo_contrato_permuta_path',
  'anexo_seguro_garantia_path',
  'link_moni_capital_seguro_garantia',
  'comentario_moni_capital_seguro_garantia',
  'link_moni_capital_gastos_aporte_inicial',
  'comentario_moni_capital_gastos_aporte_inicial',
].join(',');

const PROCESSO_SELECT_PRAZO = [
  'prazo_opcao_dias',
  'prazo_opcao_sla_tipo',
  'prazo_opcao_modo',
  'prazo_opcao_fase_id',
  'prazo_opcao_data',
  'prazo_instrumento_garantidor_dias',
  'prazo_instrumento_garantidor_sla_tipo',
  'prazo_instrumento_garantidor_modo',
  'prazo_instrumento_garantidor_fase_id',
  'prazo_instrumento_garantidor_data',
].join(',');

const PROCESSO_SELECT_CALCULADORA_ANCORA = [
  'calculadora_ancora_fase_slug',
  'calculadora_ancora_data_fim',
].join(',');

const PROCESSO_SELECT_NEGOCIACAO = ['negociacao_linhas'].join(',');

const PROCESSO_SELECT = `${PROCESSO_SELECT_LEGACY},${PROCESSO_SELECT_EXTENDED},${PROCESSO_SELECT_PRAZO},${PROCESSO_SELECT_CALCULADORA_ANCORA},${PROCESSO_SELECT_NEGOCIACAO}`;

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = String(error.message ?? '').toLowerCase();
  return (
    error.code === 'PGRST204' ||
    error.code === '42703' ||
    (msg.includes('column') && (msg.includes('does not exist') || msg.includes('schema cache')))
  );
}

export type ProcessoNegocioUpdatePayload = {
  tipo_aquisicao_terreno: string | null;
  valor_terreno: string | null;
  vgv_pretendido: string | null;
  produto_modelo_casa: string | null;
  link_pasta_drive: string | null;
  link_bca: string | null;
  link_gbox: string | null;
  link_mapa_competidores: string | null;
  link_acoplamento: string | null;
  link_apresentacao_comite: string | null;
  link_moni_capital_seguro_garantia: string | null;
  comentario_moni_capital_seguro_garantia: string | null;
  link_moni_capital_gastos_aporte_inicial: string | null;
  comentario_moni_capital_gastos_aporte_inicial: string | null;
  prazo_opcao_dias?: number | null;
  prazo_opcao_sla_tipo?: SlaTipo | null;
  prazo_opcao_modo?: NegocioPrazoModo | null;
  prazo_opcao_fase_id?: string | null;
  prazo_opcao_data?: string | null;
  prazo_instrumento_garantidor_dias?: number | null;
  prazo_instrumento_garantidor_sla_tipo?: SlaTipo | null;
  prazo_instrumento_garantidor_modo?: NegocioPrazoModo | null;
  prazo_instrumento_garantidor_fase_id?: string | null;
  prazo_instrumento_garantidor_data?: string | null;
  negociacao_linhas?: NegociacaoLinhaDb[] | null;
  /** Gerenciados pela seção Dados do Condomínio — omitir ao salvar negócio. */
  nome_condominio?: string | null;
  quadra?: string | null;
  lote?: string | null;
};

const PROCESSO_UPDATE_LEGACY_KEYS = [
  'tipo_aquisicao_terreno',
  'valor_terreno',
  'vgv_pretendido',
  'produto_modelo_casa',
  'link_pasta_drive',
] as const;

const PROCESSO_UPDATE_EXTENDED_KEYS = [
  'link_bca',
  'link_gbox',
  'link_mapa_competidores',
  'link_acoplamento',
  'link_apresentacao_comite',
  'link_moni_capital_seguro_garantia',
  'comentario_moni_capital_seguro_garantia',
  'link_moni_capital_gastos_aporte_inicial',
  'comentario_moni_capital_gastos_aporte_inicial',
] as const;

const PROCESSO_UPDATE_PRAZO_KEYS = [
  'prazo_opcao_dias',
  'prazo_opcao_sla_tipo',
  'prazo_opcao_modo',
  'prazo_opcao_fase_id',
  'prazo_opcao_data',
  'prazo_instrumento_garantidor_dias',
  'prazo_instrumento_garantidor_sla_tipo',
  'prazo_instrumento_garantidor_modo',
  'prazo_instrumento_garantidor_fase_id',
  'prazo_instrumento_garantidor_data',
] as const;

function pickPayload(
  payload: ProcessoNegocioUpdatePayload,
  keys: readonly string[],
): Record<string, string | number | null> {
  const out: Record<string, string | number | null> = {};
  for (const k of keys) {
    const v = payload[k as keyof ProcessoNegocioUpdatePayload];
    if (v !== undefined) out[k] = v as string | number | null;
  }
  return out;
}

function pickNegociacaoLinhas(
  payload: ProcessoNegocioUpdatePayload,
): Record<string, unknown> | null {
  if (payload.negociacao_linhas === undefined) return null;
  return { negociacao_linhas: payload.negociacao_linhas };
}

/** Atualiza dados do negócio; faz fallback se colunas novas ainda não existirem no banco. */
export async function updateProcessoNegocioCampos(
  supabase: SupabaseClient,
  processoId: string,
  payload: ProcessoNegocioUpdatePayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const full = {
    ...pickPayload(payload, PROCESSO_UPDATE_LEGACY_KEYS),
    ...pickPayload(payload, PROCESSO_UPDATE_EXTENDED_KEYS),
    ...pickPayload(payload, PROCESSO_UPDATE_PRAZO_KEYS),
    ...pickNegociacaoLinhas(payload),
  };
  const { error } = await supabase.from('processo_step_one').update(full as never).eq('id', processoId);
  if (!error) return { ok: true };
  if (!isMissingColumnError(error)) return { ok: false, error: error.message };

  const semPrazo = {
    ...pickPayload(payload, PROCESSO_UPDATE_LEGACY_KEYS),
    ...pickPayload(payload, PROCESSO_UPDATE_EXTENDED_KEYS),
  };
  const { error: errSemPrazo } = await supabase.from('processo_step_one').update(semPrazo as never).eq('id', processoId);
  if (!errSemPrazo) return { ok: true };
  if (!isMissingColumnError(errSemPrazo)) return { ok: false, error: errSemPrazo.message };

  const legacyOnly = pickPayload(payload, PROCESSO_UPDATE_LEGACY_KEYS);
  const { error: errLegacy } = await supabase.from('processo_step_one').update(legacyOnly as never).eq('id', processoId);
  if (errLegacy) return { ok: false, error: errLegacy.message };
  return { ok: true };
}

function tituloParaNumeroFranquia(titulo: string): string {
  const t = titulo.trim();
  if (!t) return '';
  const i = t.indexOf(' - ');
  return i >= 0 ? t.slice(0, i).trim() : t;
}

function mapRede(r: Record<string, unknown> | null): RedeFranqueadoModalRow | null {
  if (!r) return null;
  const g = (k: string) => (r[k] != null ? String(r[k]) : null);
  return {
    id: String(r.id),
    n_franquia: g('n_franquia'),
    nome_completo: g('nome_completo'),
    status_franquia: g('status_franquia'),
    modalidade: g('modalidade'),
    classificacao_franqueado: g('classificacao_franqueado'),
    area_atuacao: g('area_atuacao'),
    email_frank: g('email_frank'),
    telefone_frank: g('telefone_frank'),
    cpf_frank: g('cpf_frank'),
    data_nasc_frank: g('data_nasc_frank'),
    responsavel_comercial: g('responsavel_comercial'),
    tamanho_camisa_frank: g('tamanho_camisa_frank'),
    data_ass_cof: g('data_ass_cof'),
    data_ass_contrato: g('data_ass_contrato'),
    data_expiracao_franquia: g('data_expiracao_franquia'),
    endereco_casa_frank: g('endereco_casa_frank'),
    endereco_casa_frank_numero: g('endereco_casa_frank_numero'),
    endereco_casa_frank_complemento: g('endereco_casa_frank_complemento'),
    cep_casa_frank: g('cep_casa_frank'),
    cidade_casa_frank: g('cidade_casa_frank'),
    estado_casa_frank: g('estado_casa_frank'),
    socios: g('socios'),
    processo_id: g('processo_id'),
    contrato_franquia_path: g('contrato_franquia_path'),
  };
}

function mapProcesso(r: Record<string, unknown> | null): ProcessoModalNegocioPreObra | null {
  if (!r) return null;
  const g = (k: string) => (r[k] != null ? String(r[k]) : null);
  const gi = (k: string) => {
    const v = r[k];
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const sla = (k: string): SlaTipo | null => {
    const v = r[k];
    return v === 'corridos' ? 'corridos' : v === 'uteis' ? 'uteis' : null;
  };
  const modo = (k: string): NegocioPrazoModo | null => {
    const v = r[k];
    return v === 'fase' || v === 'data' ? v : null;
  };
  return {
    id: String(r.id),
    tipo_aquisicao_terreno: g('tipo_aquisicao_terreno'),
    valor_terreno: g('valor_terreno'),
    vgv_pretendido: g('vgv_pretendido'),
    produto_modelo_casa: g('produto_modelo_casa'),
    link_pasta_drive: g('link_pasta_drive'),
    link_bca: g('link_bca'),
    link_gbox: g('link_gbox'),
    link_mapa_competidores: g('link_mapa_competidores'),
    link_acoplamento: g('link_acoplamento'),
    link_apresentacao_comite: g('link_apresentacao_comite'),
    anexo_opcao_permuta_path: g('anexo_opcao_permuta_path'),
    anexo_contrato_permuta_path: g('anexo_contrato_permuta_path'),
    anexo_seguro_garantia_path: g('anexo_seguro_garantia_path'),
    link_moni_capital_seguro_garantia: g('link_moni_capital_seguro_garantia'),
    comentario_moni_capital_seguro_garantia: g('comentario_moni_capital_seguro_garantia'),
    link_moni_capital_gastos_aporte_inicial: g('link_moni_capital_gastos_aporte_inicial'),
    comentario_moni_capital_gastos_aporte_inicial: g('comentario_moni_capital_gastos_aporte_inicial'),
    nome_condominio: g('nome_condominio'),
    condominio_id: g('condominio_id'),
    quadra_lote: g('quadra_lote'),
    quadra: g('quadra'),
    lote: g('lote'),
    previsao_aprovacao_condominio: g('previsao_aprovacao_condominio'),
    previsao_aprovacao_prefeitura: g('previsao_aprovacao_prefeitura'),
    previsao_emissao_alvara: g('previsao_emissao_alvara'),
    previsao_liberacao_credito_obra: g('previsao_liberacao_credito_obra'),
    previsao_inicio_obra: g('previsao_inicio_obra'),
    data_aprovacao_condominio: g('data_aprovacao_condominio')?.slice(0, 10) ?? null,
    data_aprovacao_prefeitura: g('data_aprovacao_prefeitura')?.slice(0, 10) ?? null,
    data_emissao_alvara: g('data_emissao_alvara')?.slice(0, 10) ?? null,
    data_aprovacao_credito: g('data_aprovacao_credito')?.slice(0, 10) ?? null,
    numero_franquia: g('numero_franquia'),
    origem_rede_franqueados_id: g('origem_rede_franqueados_id'),
    prazo_opcao_dias: gi('prazo_opcao_dias'),
    prazo_opcao_sla_tipo: sla('prazo_opcao_sla_tipo'),
    prazo_opcao_modo: modo('prazo_opcao_modo'),
    prazo_opcao_fase_id: g('prazo_opcao_fase_id'),
    prazo_opcao_data: g('prazo_opcao_data')?.slice(0, 10) ?? null,
    prazo_instrumento_garantidor_dias: gi('prazo_instrumento_garantidor_dias'),
    prazo_instrumento_garantidor_sla_tipo: sla('prazo_instrumento_garantidor_sla_tipo'),
    prazo_instrumento_garantidor_modo: modo('prazo_instrumento_garantidor_modo'),
    prazo_instrumento_garantidor_fase_id: g('prazo_instrumento_garantidor_fase_id'),
    prazo_instrumento_garantidor_data: g('prazo_instrumento_garantidor_data')?.slice(0, 10) ?? null,
    calculadora_ancora_fase_slug: g('calculadora_ancora_fase_slug'),
    calculadora_ancora_data_fim: g('calculadora_ancora_data_fim')?.slice(0, 10) ?? null,
    negociacao_linhas: parseNegociacaoLinhasFromDb(r.negociacao_linhas),
  };
}

async function fetchProcessoById(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from('processo_step_one').select(PROCESSO_SELECT).eq('id', id).maybeSingle();
  if (!error) return mapProcesso((data as Record<string, unknown> | null) ?? null);

  if (isMissingColumnError(error)) {
    const { data: legacy, error: errLegacy } = await supabase
      .from('processo_step_one')
      .select(PROCESSO_SELECT_LEGACY)
      .eq('id', id)
      .maybeSingle();
    if (errLegacy || !legacy) return null;

    const { data: extended, error: errExt } = await supabase
      .from('processo_step_one')
      .select(PROCESSO_SELECT_EXTENDED)
      .eq('id', id)
      .maybeSingle();

    const merged = {
      ...(legacy as unknown as Record<string, unknown>),
      ...(errExt || !extended ? {} : (extended as unknown as Record<string, unknown>)),
    };
    return mapProcesso(merged);
  }

  console.error('[KanbanCardModal] Erro ao carregar processo:', error.message);
  return null;
}

/**
 * Resolve `processo_step_one` para card nativo: FK em rede, origem na rede, ou número de franquia.
 */
async function resolveProcessoNativo(
  supabase: SupabaseClient,
  cardTitulo: string,
  cardProjetoId?: string | null,
  redeFranqueadoId?: string | null,
  cardProcessoStepOneId?: string | null,
): Promise<ProcessoModalNegocioPreObra | null> {
  const { resolverProcessoStepOneIdDoCard } = await import('@/lib/kanban/card-sync-group');
  const processoId = await resolverProcessoStepOneIdDoCard(supabase, {
    cardProcessoStepOneId,
    cardProjetoId,
    redeFranqueadoId,
    cardTitulo,
  });
  if (!processoId) return null;
  return fetchProcessoById(supabase, processoId);
}

export type CardEmpresasModalDetalhe = {
  incorporadora: import('@/lib/franqueado-empresas').FranqueadoEmpresaRow | null;
  gestora: import('@/lib/franqueado-empresas').FranqueadoEmpresaRow | null;
  spe: import('@/lib/franqueado-spe').FranqueadoSpeRow | null;
};

export type KanbanCardModalDetalhes = {
  rede: RedeFranqueadoModalRow | null;
  processo: ProcessoModalNegocioPreObra | null;
  redeIdContrato: string | null;
  empresas: CardEmpresasModalDetalhe | null;
};

/** Formulário pré-obra (texto livre + datas ISO yyyy-mm-dd). */
export type PreObraDraftKanban = {
  previsao_aprovacao_condominio: string;
  previsao_aprovacao_prefeitura: string;
  previsao_emissao_alvara: string;
  previsao_liberacao_credito_obra: string;
  previsao_inicio_obra: string;
  data_aprovacao_condominio: string;
  data_aprovacao_prefeitura: string;
  data_emissao_alvara: string;
  data_aprovacao_credito: string;
};

export const PRE_OBRA_DRAFT_EMPTY: PreObraDraftKanban = {
  previsao_aprovacao_condominio: '',
  previsao_aprovacao_prefeitura: '',
  previsao_emissao_alvara: '',
  previsao_liberacao_credito_obra: '',
  previsao_inicio_obra: '',
  data_aprovacao_condominio: '',
  data_aprovacao_prefeitura: '',
  data_emissao_alvara: '',
  data_aprovacao_credito: '',
};

export function preObraDraftFromProcesso(p: ProcessoModalNegocioPreObra | null): PreObraDraftKanban {
  if (!p) return { ...PRE_OBRA_DRAFT_EMPTY };
  const t = (x: string | null | undefined) => (x != null ? String(x) : '');
  const draft: PreObraDraftKanban = {
    previsao_aprovacao_condominio: t(p.previsao_aprovacao_condominio),
    previsao_aprovacao_prefeitura: t(p.previsao_aprovacao_prefeitura),
    previsao_emissao_alvara: t(p.previsao_emissao_alvara),
    previsao_liberacao_credito_obra: t(p.previsao_liberacao_credito_obra),
    previsao_inicio_obra: t(p.previsao_inicio_obra),
    data_aprovacao_condominio: t(p.data_aprovacao_condominio),
    data_aprovacao_prefeitura: t(p.data_aprovacao_prefeitura),
    data_emissao_alvara: t(p.data_emissao_alvara),
    data_aprovacao_credito: t(p.data_aprovacao_credito),
  };
  return aplicarDataEnvioCreditoObraNoPreObra(draft);
}

export function fmtMoedaKanban(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim();
  if (!s) return '—';
  const normalized = s.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  if (!Number.isNaN(n) && Number.isFinite(n)) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
  }
  return s;
}

export function displayOrDash(v: string | null | undefined): string {
  const s = String(v ?? '').trim();
  return s.length > 0 ? s : '—';
}

/**
 * Oculta `tipo_aquisicao_terreno` quando veio do processo raiz da franquia ou de resolução indireta
 * (sem `kanban_cards.processo_step_one_id` dedicado ao card).
 */
export function ocultarTipoNegociacaoHerdadoDoProcesso(
  processo: ProcessoModalNegocioPreObra | null,
  ctx: {
    cardProcessoStepOneId?: string | null;
    redeProcessoId?: string | null;
  },
): ProcessoModalNegocioPreObra | null {
  if (!processo) return null;

  const cardPid = String(ctx.cardProcessoStepOneId ?? '').trim();
  const redePid = String(ctx.redeProcessoId ?? '').trim();
  const procId = processo.id;

  const vinculoDiretoAoCard = cardPid !== '' && cardPid === procId;
  const processoRaizFranquia = redePid !== '' && procId === redePid;

  if (vinculoDiretoAoCard && !processoRaizFranquia) {
    return processo;
  }

  return { ...processo, tipo_aquisicao_terreno: null };
}

function mapFranqueadoEmpresaRow(r: Record<string, unknown>): import('@/lib/franqueado-empresas').FranqueadoEmpresaRow {
  const statusRaw = String(r.status ?? 'ativa').trim();
  const status =
    statusRaw === 'inativa' || statusRaw === 'em_abertura'
      ? statusRaw
      : ('ativa' as const);
  const tipo = String(r.tipo ?? '').trim() === 'gestora' ? ('gestora' as const) : ('incorporadora' as const);
  return {
    id: String(r.id),
    rede_franqueado_id: String(r.rede_franqueado_id),
    tipo,
    razao_social: (r.razao_social as string | null) ?? null,
    cnpj: (r.cnpj as string | null) ?? null,
    inscricao_municipal: (r.inscricao_municipal as string | null) ?? null,
    inscricao_estadual: (r.inscricao_estadual as string | null) ?? null,
    data_abertura: (r.data_abertura as string | null) ?? null,
    status,
    conta_banco: (r.conta_banco as string | null) ?? null,
    conta_agencia: (r.conta_agencia as string | null) ?? null,
    conta_numero: (r.conta_numero as string | null) ?? null,
    conta_tipo: (r.conta_tipo as string | null) ?? null,
    conta_pix_tipo: (r.conta_pix_tipo as string | null) ?? null,
    conta_pix_chave: (r.conta_pix_chave as string | null) ?? null,
    observacoes: (r.observacoes as string | null) ?? null,
  };
}

function mapFranqueadoSpeRow(r: Record<string, unknown>): import('@/lib/franqueado-spe').FranqueadoSpeRow {
  const statusRaw = String(r.status ?? 'em_abertura').trim();
  const status =
    statusRaw === 'ativa' || statusRaw === 'inativa'
      ? statusRaw
      : ('em_abertura' as const);
  return {
    id: String(r.id),
    rede_franqueado_id: String(r.rede_franqueado_id),
    kanban_card_id: (r.kanban_card_id as string | null) ?? null,
    nome_projeto: (r.nome_projeto as string | null) ?? null,
    razao_social: (r.razao_social as string | null) ?? null,
    cnpj: (r.cnpj as string | null) ?? null,
    inscricao_municipal: (r.inscricao_municipal as string | null) ?? null,
    inscricao_estadual: (r.inscricao_estadual as string | null) ?? null,
    status,
    conta_banco: (r.conta_banco as string | null) ?? null,
    conta_agencia: (r.conta_agencia as string | null) ?? null,
    conta_numero: (r.conta_numero as string | null) ?? null,
    conta_tipo: (r.conta_tipo as string | null) ?? null,
    conta_pix_tipo: (r.conta_pix_tipo as string | null) ?? null,
    conta_pix_chave: (r.conta_pix_chave as string | null) ?? null,
    observacoes: (r.observacoes as string | null) ?? null,
    anexo_contrato_social_path: (r.anexo_contrato_social_path as string | null) ?? null,
    anexo_contrato_social_justificativa: (r.anexo_contrato_social_justificativa as string | null) ?? null,
    anexo_cnpj_path: (r.anexo_cnpj_path as string | null) ?? null,
    anexo_cnpj_justificativa: (r.anexo_cnpj_justificativa as string | null) ?? null,
    anexo_inscricao_municipal_path: (r.anexo_inscricao_municipal_path as string | null) ?? null,
    anexo_inscricao_municipal_justificativa:
      (r.anexo_inscricao_municipal_justificativa as string | null) ?? null,
    anexo_certidao_junta_path: (r.anexo_certidao_junta_path as string | null) ?? null,
    anexo_certidao_junta_justificativa: (r.anexo_certidao_junta_justificativa as string | null) ?? null,
    anexo_conta_bancaria_path: (r.anexo_conta_bancaria_path as string | null) ?? null,
    anexo_conta_bancaria_justificativa: (r.anexo_conta_bancaria_justificativa as string | null) ?? null,
    anexo_inscricao_estadual_path: (r.anexo_inscricao_estadual_path as string | null) ?? null,
  };
}

async function fetchEmpresasForCard(
  supabase: SupabaseClient,
  redeFranqueadoId: string | null,
  cardId: string,
): Promise<CardEmpresasModalDetalhe | null> {
  const redeId = redeFranqueadoId?.trim();
  if (!redeId) return null;

  const [{ data: empresas }, { data: speByCard }, { data: cardRow }] = await Promise.all([
    supabase.from('franqueado_empresas').select('*').eq('rede_franqueado_id', redeId),
    supabase.from('franqueado_spe').select('*').eq('kanban_card_id', cardId).maybeSingle(),
    supabase.from('kanban_cards').select('franqueado_spe_id').eq('id', cardId).maybeSingle(),
  ]);

  let incorporadora: import('@/lib/franqueado-empresas').FranqueadoEmpresaRow | null = null;
  let gestora: import('@/lib/franqueado-empresas').FranqueadoEmpresaRow | null = null;
  for (const row of empresas ?? []) {
    const e = mapFranqueadoEmpresaRow(row as Record<string, unknown>);
    if (e.tipo === 'incorporadora') incorporadora = e;
    else gestora = e;
  }

  let spe: import('@/lib/franqueado-spe').FranqueadoSpeRow | null = null;
  if (speByCard) {
    spe = mapFranqueadoSpeRow(speByCard as Record<string, unknown>);
  } else {
    const speId = (cardRow as { franqueado_spe_id?: string | null } | null)?.franqueado_spe_id;
    if (speId) {
      const { data: speRow } = await supabase.from('franqueado_spe').select('*').eq('id', speId).maybeSingle();
      if (speRow) spe = mapFranqueadoSpeRow(speRow as Record<string, unknown>);
    }
  }

  return { incorporadora, gestora, spe };
}

/**
 * Carrega rede + processo para o painel esquerdo do `KanbanCardModal`.
 */
export async function fetchKanbanCardModalDetalhes(
  supabase: SupabaseClient,
  params: {
    origem: 'nativo' | 'legado';
    cardId: string;
    cardTitulo: string;
    redeFranqueadoId: string | null;
    /** `kanban_cards.projeto_id` — Portfolio; Step One usa `processo_step_one_id`. */
    cardProjetoId?: string | null;
    cardProcessoStepOneId?: string | null;
  },
): Promise<KanbanCardModalDetalhes> {
  const { origem, cardId, cardTitulo, redeFranqueadoId, cardProjetoId, cardProcessoStepOneId } = params;

  if (origem === 'legado') {
    const processo = await fetchProcessoById(supabase, cardId);
    let rede: RedeFranqueadoModalRow | null = null;
    if (processo?.origem_rede_franqueados_id) {
      const { data } = await supabase
        .from('rede_franqueados')
        .select(REDE_SELECT)
        .eq('id', processo.origem_rede_franqueados_id)
        .maybeSingle();
      rede = mapRede((data as Record<string, unknown> | null) ?? null);
    } else if (processo?.numero_franquia?.trim()) {
      const { data } = await supabase
        .from('rede_franqueados')
        .select(REDE_SELECT)
        .eq('n_franquia', processo.numero_franquia.trim())
        .order('ordem', { ascending: false })
        .limit(1)
        .maybeSingle();
      rede = mapRede((data as Record<string, unknown> | null) ?? null);
    }
    const redeIdContrato = rede?.id ?? null;
    const empresas = await fetchEmpresasForCard(supabase, redeIdContrato, cardId);
    return { rede, processo, redeIdContrato, empresas };
  }

  let rede: RedeFranqueadoModalRow | null = null;
  if (redeFranqueadoId) {
    const { data } = await supabase.from('rede_franqueados').select(REDE_SELECT).eq('id', redeFranqueadoId).maybeSingle();
    rede = mapRede((data as Record<string, unknown> | null) ?? null);
  }
  const processoRaw = await resolveProcessoNativo(
    supabase,
    cardTitulo,
    cardProjetoId,
    redeFranqueadoId,
    cardProcessoStepOneId,
  );
  const processo = ocultarTipoNegociacaoHerdadoDoProcesso(processoRaw, {
    cardProcessoStepOneId,
    redeProcessoId: rede?.processo_id,
  });
  const redeIdContrato = rede?.id ?? redeFranqueadoId;
  const empresas = await fetchEmpresasForCard(supabase, redeIdContrato, cardId);
  return { rede, processo, redeIdContrato, empresas };
}
