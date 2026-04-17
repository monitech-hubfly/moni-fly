import type { SupabaseClient } from '@supabase/supabase-js';

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
  nome_condominio: string | null;
  quadra_lote: string | null;
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

const PROCESSO_SELECT = [
  'id',
  'tipo_aquisicao_terreno',
  'valor_terreno',
  'vgv_pretendido',
  'produto_modelo_casa',
  'link_pasta_drive',
  'nome_condominio',
  'quadra_lote',
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
  return {
    id: String(r.id),
    tipo_aquisicao_terreno: g('tipo_aquisicao_terreno'),
    valor_terreno: g('valor_terreno'),
    vgv_pretendido: g('vgv_pretendido'),
    produto_modelo_casa: g('produto_modelo_casa'),
    link_pasta_drive: g('link_pasta_drive'),
    nome_condominio: g('nome_condominio'),
    quadra_lote: g('quadra_lote'),
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
  };
}

async function fetchProcessoById(supabase: SupabaseClient, id: string) {
  const { data } = await supabase.from('processo_step_one').select(PROCESSO_SELECT).eq('id', id).maybeSingle();
  return mapProcesso((data as Record<string, unknown> | null) ?? null);
}

/**
 * Resolve `processo_step_one` para card nativo: FK em rede, origem na rede, ou número de franquia.
 */
async function resolveProcessoNativo(
  supabase: SupabaseClient,
  rede: RedeFranqueadoModalRow | null,
  cardTitulo: string,
): Promise<ProcessoModalNegocioPreObra | null> {
  if (rede?.processo_id) {
    const p = await fetchProcessoById(supabase, rede.processo_id);
    if (p) return p;
  }
  if (rede?.id) {
    const { data: byOrigem } = await supabase
      .from('processo_step_one')
      .select(PROCESSO_SELECT)
      .eq('origem_rede_franqueados_id', rede.id)
      .maybeSingle();
    const m = mapProcesso((byOrigem as Record<string, unknown> | null) ?? null);
    if (m) return m;
  }
  const num = rede?.n_franquia?.trim() || tituloParaNumeroFranquia(cardTitulo);
  if (num) {
    const { data: byNum } = await supabase
      .from('processo_step_one')
      .select(PROCESSO_SELECT)
      .eq('numero_franquia', num)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const m2 = mapProcesso((byNum as Record<string, unknown> | null) ?? null);
    if (m2) return m2;
  }
  return null;
}

export type KanbanCardModalDetalhes = {
  rede: RedeFranqueadoModalRow | null;
  processo: ProcessoModalNegocioPreObra | null;
  redeIdContrato: string | null;
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
  return {
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
 * Carrega rede + processo para o painel esquerdo do `KanbanCardModal`.
 */
export async function fetchKanbanCardModalDetalhes(
  supabase: SupabaseClient,
  params: {
    origem: 'nativo' | 'legado';
    cardId: string;
    cardTitulo: string;
    redeFranqueadoId: string | null;
  },
): Promise<KanbanCardModalDetalhes> {
  const { origem, cardId, cardTitulo, redeFranqueadoId } = params;

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
    return { rede, processo, redeIdContrato: rede?.id ?? null };
  }

  let rede: RedeFranqueadoModalRow | null = null;
  if (redeFranqueadoId) {
    const { data } = await supabase.from('rede_franqueados').select(REDE_SELECT).eq('id', redeFranqueadoId).maybeSingle();
    rede = mapRede((data as Record<string, unknown> | null) ?? null);
  }
  const processo = await resolveProcessoNativo(supabase, rede, cardTitulo);
  return { rede, processo, redeIdContrato: rede?.id ?? null };
}
