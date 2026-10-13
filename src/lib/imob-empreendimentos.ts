/** Cadastro de empreendimentos IMOB (`imob_empreendimentos`). */

import type { createClient } from '@/lib/supabase/server';
import { isCadastroValorVazio } from '@/lib/cadastro-linha-em-branco';
import { formatIsoDateOnlyPtBr } from '@/lib/dias-uteis';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import {
  NEGOCIO_PRAZO_DRAFT_VAZIO,
  formatNegocioPrazoDisplay,
  negocioPrazoValoresFromDraft,
  type NegocioPrazoDraft,
} from '@/lib/kanban/dados-negocio-prazo';

export type ImobEmpreendimentoRow = {
  id: string;
  nome: string;
  slug: string | null;
  specs: string | null;
  ativo: boolean;
  imagem_url: string | null;
  share_token: string | null;
  card_id: string | null;
  condominio_id: string | null;
  created_at: string | null;
  // joined via supabase
  condominio_nome: string | null;
  /** Nome do condomínio na coluna (cadastro ou card), sem alterar o grupo. */
  nome_condominio: string | null;
  condominio_cidade: string | null;
  condominio_estado: string | null;
  card_titulo: string | null;
  card_status: string | null;
  /** FK do card (ex.: FK0005). */
  codigo: string | null;
  quadra: string | null;
  lote: string | null;
  /** Fase mais avançada entre Step One, Portfólio e Pré Obra e Obra. */
  fase_atual: string | null;
  // computed counts (loaded separately or via rpc)
  corretores_count?: number;
  unidades_count?: number;
  // linked corretor ids (loaded on demand)
  corretor_ids?: string[];
  tipo_negocio: string | null;
  pasta_drive: string | null;
  valor_terreno: string | null;
  pct_compra_parcial_terreno: number | null;
  pct_vgv_terrenista: number | null;
  divida_terreno: string | null;
  m2_terreno: number | null;
  contratos: string | null;
  prazo_opcao: NegocioPrazoDraft;
  produto_modelo: string | null;
  extrato_modelo_configurado: string | null;
  m2_casa: number | null;
  custo_obra: string | null;
  divida_obra: string | null;
  link_bca: string | null;
  link_mapa_competidores: string | null;
  vgv_pretendido: string | null;
  valor_recompra: string | null;
  link_acoplamento: string | null;
  link_gbox: string | null;
  link_apresentacao_comite: string | null;
  data_aprovacao_comite: string | null;
  prazo_instrumento_garantidor: NegocioPrazoDraft;
  link_projeto_legal: string | null;
  link_docs_condominio: string | null;
  data_aprovacao_condominio: string | null;
  data_aprovacao_prefeitura: string | null;
  data_emissao_alvara: string | null;
  data_envio_credito_obra: string | null;
  data_aprovacao_credito_obra: string | null;
  data_inicio_obra: string | null;
};

export type EmpreendimentoNegocioKey = keyof Pick<
  ImobEmpreendimentoRow,
  | 'tipo_negocio'
  | 'pasta_drive'
  | 'valor_terreno'
  | 'pct_compra_parcial_terreno'
  | 'pct_vgv_terrenista'
  | 'divida_terreno'
  | 'm2_terreno'
  | 'contratos'
  | 'prazo_opcao'
  | 'produto_modelo'
  | 'extrato_modelo_configurado'
  | 'm2_casa'
  | 'custo_obra'
  | 'divida_obra'
  | 'link_bca'
  | 'link_mapa_competidores'
  | 'vgv_pretendido'
  | 'valor_recompra'
  | 'link_acoplamento'
  | 'link_gbox'
  | 'link_apresentacao_comite'
  | 'data_aprovacao_comite'
  | 'prazo_instrumento_garantidor'
  | 'link_projeto_legal'
  | 'link_docs_condominio'
  | 'data_aprovacao_condominio'
  | 'data_aprovacao_prefeitura'
  | 'data_emissao_alvara'
  | 'data_envio_credito_obra'
  | 'data_aprovacao_credito_obra'
  | 'data_inicio_obra'
>;

export type EmpreendimentoNegocioCampoKind =
  | 'select-tipo'
  | 'url'
  | 'moeda'
  | 'percent'
  | 'm2'
  | 'prazo'
  | 'select-produto'
  | 'data';

export type EmpreendimentoNegocioCampo = {
  key: EmpreendimentoNegocioKey;
  label: string;
  kind: EmpreendimentoNegocioCampoKind;
};

/** Ordem do Cadastro de Empreendimentos (Rede Casa Moní). */
export const CAMPOS_NEGOCIO_EMPREENDIMENTO: EmpreendimentoNegocioCampo[] = [
  { key: 'tipo_negocio', label: 'Tipo de negócio', kind: 'select-tipo' },
  { key: 'pasta_drive', label: 'Pasta do Drive', kind: 'url' },
  { key: 'valor_terreno', label: 'Valor do Terreno', kind: 'moeda' },
  { key: 'pct_compra_parcial_terreno', label: '% Compra Parcial Terreno', kind: 'percent' },
  { key: 'pct_vgv_terrenista', label: '% VGV Terrenista', kind: 'percent' },
  { key: 'divida_terreno', label: 'Dívida Terreno', kind: 'moeda' },
  { key: 'm2_terreno', label: 'M² Terreno', kind: 'm2' },
  { key: 'contratos', label: 'Contratos', kind: 'url' },
  { key: 'prazo_opcao', label: 'Prazo Opção', kind: 'prazo' },
  { key: 'produto_modelo', label: 'Produto / Modelo', kind: 'select-produto' },
  { key: 'extrato_modelo_configurado', label: 'Extrato Modelo Configurado', kind: 'url' },
  { key: 'm2_casa', label: 'M² Casa', kind: 'm2' },
  { key: 'custo_obra', label: 'Custo da Obra', kind: 'moeda' },
  { key: 'divida_obra', label: 'Dívida Obra', kind: 'moeda' },
  { key: 'link_bca', label: 'BCA', kind: 'url' },
  { key: 'link_mapa_competidores', label: 'Mapa de Competidores', kind: 'url' },
  { key: 'vgv_pretendido', label: 'VGV pretendido', kind: 'moeda' },
  { key: 'valor_recompra', label: 'Valor Recompra', kind: 'moeda' },
  { key: 'link_acoplamento', label: 'Acoplamento', kind: 'url' },
  { key: 'link_gbox', label: 'GBOX', kind: 'url' },
  { key: 'link_apresentacao_comite', label: 'Apresentação Comitê', kind: 'url' },
  { key: 'data_aprovacao_comite', label: 'Data Aprovação Comitê', kind: 'data' },
  { key: 'prazo_instrumento_garantidor', label: 'Prazo Instrumento Garantidor', kind: 'prazo' },
  { key: 'link_projeto_legal', label: 'Projeto Legal', kind: 'url' },
  { key: 'link_docs_condominio', label: 'Docs Condomínio', kind: 'url' },
  { key: 'data_aprovacao_condominio', label: 'Data Aprovação no Condomínio', kind: 'data' },
  { key: 'data_aprovacao_prefeitura', label: 'Data Aprovação na Prefeitura', kind: 'data' },
  { key: 'data_emissao_alvara', label: 'Data Emissão do Alvará', kind: 'data' },
  { key: 'data_envio_credito_obra', label: 'Data Envio p/ Crédito Obra', kind: 'data' },
  { key: 'data_aprovacao_credito_obra', label: 'Data Aprovação Crédito Obra', kind: 'data' },
  { key: 'data_inicio_obra', label: 'Data Início de Obra', kind: 'data' },
];

const NEGOCIO_SELECT = CAMPOS_NEGOCIO_EMPREENDIMENTO.map((c) => c.key).join(', ');

export function negocioInicialEmpreendimento(
  row: ImobEmpreendimentoRow | null,
): Pick<ImobEmpreendimentoRow, EmpreendimentoNegocioKey> {
  const prazo = () => ({ ...NEGOCIO_PRAZO_DRAFT_VAZIO });
  const blank: Pick<ImobEmpreendimentoRow, EmpreendimentoNegocioKey> = {
    tipo_negocio: null,
    pasta_drive: null,
    valor_terreno: null,
    pct_compra_parcial_terreno: null,
    pct_vgv_terrenista: null,
    divida_terreno: null,
    m2_terreno: null,
    contratos: null,
    prazo_opcao: prazo(),
    produto_modelo: null,
    extrato_modelo_configurado: null,
    m2_casa: null,
    custo_obra: null,
    divida_obra: null,
    link_bca: null,
    link_mapa_competidores: null,
    vgv_pretendido: null,
    valor_recompra: null,
    link_acoplamento: null,
    link_gbox: null,
    link_apresentacao_comite: null,
    data_aprovacao_comite: null,
    prazo_instrumento_garantidor: prazo(),
    link_projeto_legal: null,
    link_docs_condominio: null,
    data_aprovacao_condominio: null,
    data_aprovacao_prefeitura: null,
    data_emissao_alvara: null,
    data_envio_credito_obra: null,
    data_aprovacao_credito_obra: null,
    data_inicio_obra: null,
  };
  if (!row) return blank;
  for (const campo of CAMPOS_NEGOCIO_EMPREENDIMENTO) {
    (blank as Record<string, unknown>)[campo.key] = row[campo.key];
  }
  return blank;
}

export type ImobEmpreendimentoPatch = Partial<{
  nome: string;
  slug: string | null;
  specs: string | null;
  ativo: boolean;
  imagem_url: string | null;
  card_id: string | null;
  condominio_id: string | null;
  tipo_negocio?: string | null;
  pasta_drive?: string | null;
  valor_terreno?: string | null;
  pct_compra_parcial_terreno?: number | null;
  pct_vgv_terrenista?: number | null;
  divida_terreno?: string | null;
  m2_terreno?: number | null;
  contratos?: string | null;
  prazo_opcao?: NegocioPrazoDraft | null;
  produto_modelo?: string | null;
  extrato_modelo_configurado?: string | null;
  m2_casa?: number | null;
  custo_obra?: string | null;
  divida_obra?: string | null;
  link_bca?: string | null;
  link_mapa_competidores?: string | null;
  vgv_pretendido?: string | null;
  valor_recompra?: string | null;
  link_acoplamento?: string | null;
  link_gbox?: string | null;
  link_apresentacao_comite?: string | null;
  data_aprovacao_comite?: string | null;
  prazo_instrumento_garantidor?: NegocioPrazoDraft | null;
  link_projeto_legal?: string | null;
  link_docs_condominio?: string | null;
  data_aprovacao_condominio?: string | null;
  data_aprovacao_prefeitura?: string | null;
  data_emissao_alvara?: string | null;
  data_envio_credito_obra?: string | null;
  data_aprovacao_credito_obra?: string | null;
  data_inicio_obra?: string | null;
}>;

const CHAVES_TEXTO_NEGOCIO = [
  'tipo_negocio',
  'pasta_drive',
  'valor_terreno',
  'divida_terreno',
  'contratos',
  'produto_modelo',
  'extrato_modelo_configurado',
  'custo_obra',
  'divida_obra',
  'link_bca',
  'link_mapa_competidores',
  'vgv_pretendido',
  'valor_recompra',
  'link_acoplamento',
  'link_gbox',
  'link_apresentacao_comite',
  'link_projeto_legal',
  'link_docs_condominio',
] as const;

const CHAVES_NUMERO_NEGOCIO = [
  'pct_compra_parcial_terreno',
  'pct_vgv_terrenista',
  'm2_terreno',
  'm2_casa',
] as const;

const CHAVES_DATA_NEGOCIO = [
  'data_aprovacao_comite',
  'data_aprovacao_condominio',
  'data_aprovacao_prefeitura',
  'data_emissao_alvara',
  'data_envio_credito_obra',
  'data_aprovacao_credito_obra',
  'data_inicio_obra',
] as const;

const CHAVES_PRAZO_NEGOCIO = ['prazo_opcao', 'prazo_instrumento_garantidor'] as const;

function prazoParaDb(draft: NegocioPrazoDraft | null | undefined): NegocioPrazoDraft | null {
  if (!draft?.modo) return null;
  return {
    modo: draft.modo,
    dias: String(draft.dias ?? ''),
    slaTipo: draft.slaTipo === 'corridos' ? 'corridos' : 'uteis',
    faseId: String(draft.faseId ?? ''),
    data: String(draft.data ?? '').slice(0, 10),
  };
}

/** Campos de negócio prontos para insert/update. Vazio vira null. */
export function negocioDbFromPatch(patch: ImobEmpreendimentoPatch): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const key of CHAVES_TEXTO_NEGOCIO) {
    if (patch[key] === undefined) continue;
    row[key] = txt(patch[key]);
  }
  for (const key of CHAVES_NUMERO_NEGOCIO) {
    if (patch[key] === undefined) continue;
    row[key] = num(patch[key]);
  }
  for (const key of CHAVES_DATA_NEGOCIO) {
    if (patch[key] === undefined) continue;
    row[key] = ymd(patch[key]);
  }
  for (const key of CHAVES_PRAZO_NEGOCIO) {
    if (patch[key] === undefined) continue;
    row[key] = prazoParaDb(patch[key]);
  }
  return row;
}

export function isImobEmpreendimentoLinhaEmBranco(row: { nome?: string | null }): boolean {
  return isCadastroValorVazio(row.nome);
}

export function normalizarParaBuscaImob(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function imobEmpreendimentoRowMatchesBusca(
  row: ImobEmpreendimentoRow,
  busca: string,
): boolean {
  const q = normalizarParaBuscaImob(busca);
  if (!q) return true;
  const parts = [
    row.nome,
    row.slug,
    row.specs,
    row.condominio_nome,
    row.nome_condominio,
    row.condominio_cidade,
    row.condominio_estado,
    row.codigo,
    row.quadra,
    row.lote,
    row.fase_atual,
    row.card_titulo,
    row.tipo_negocio,
    row.produto_modelo,
    row.pasta_drive,
  ];
  return parts.some((p) => normalizarParaBuscaImob(String(p ?? '')).includes(q));
}

export function ordenarImobEmpreendimentosPorNome(
  rows: ImobEmpreendimentoRow[],
): ImobEmpreendimentoRow[] {
  return [...rows].sort((a, b) =>
    (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR', { sensitivity: 'base' }),
  );
}

/** Agrupa empreendimentos por condomínio. */
export function agruparPorCondominio(
  rows: ImobEmpreendimentoRow[],
): Array<{ condominio_id: string | null; condominio_nome: string; rows: ImobEmpreendimentoRow[] }> {
  const map = new Map<string, { condominio_id: string | null; condominio_nome: string; rows: ImobEmpreendimentoRow[] }>();
  for (const row of rows) {
    const key = row.condominio_id ?? '__sem_condominio__';
    if (!map.has(key)) {
      map.set(key, {
        condominio_id: row.condominio_id,
        condominio_nome: row.condominio_nome ?? 'Sem condomínio',
        rows: [],
      });
    }
    map.get(key)!.rows.push(row);
  }
  return [...map.values()].sort((a, b) =>
    a.condominio_nome.localeCompare(b.condominio_nome, 'pt-BR', { sensitivity: 'base' }),
  );
}

type RawImobEmp = Record<string, unknown> & {
  condominios?: { id?: string; nome?: string; cidade?: string; estado?: string } | null;
  kanban_cards?: { id?: string; titulo?: string; status?: string } | null;
};

function txt(v: unknown): string | null {
  const s = String(v ?? '').trim();
  return s || null;
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function ymd(v: unknown): string | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  return s.slice(0, 10);
}

function prazoFromDb(raw: unknown): NegocioPrazoDraft {
  if (!raw || typeof raw !== 'object') return { ...NEGOCIO_PRAZO_DRAFT_VAZIO };
  const o = raw as Partial<NegocioPrazoDraft>;
  const modo = o.modo === 'fase' || o.modo === 'data' ? o.modo : '';
  return {
    modo,
    dias: String(o.dias ?? ''),
    slaTipo: o.slaTipo === 'corridos' ? 'corridos' : 'uteis',
    faseId: String(o.faseId ?? ''),
    data: String(o.data ?? '').slice(0, 10),
  };
}

function moedaTexto(raw: string | null): string {
  const s = String(raw ?? '').trim();
  if (!s) return '—';
  const normalized = s.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  if (!Number.isNaN(n) && Number.isFinite(n)) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
  }
  return s;
}

export function textoColunaNegocioEmpreendimento(
  row: ImobEmpreendimentoRow,
  campo: EmpreendimentoNegocioCampo,
): string {
  const value = row[campo.key];
  if (campo.kind === 'prazo') {
    return formatNegocioPrazoDisplay(negocioPrazoValoresFromDraft(value as NegocioPrazoDraft));
  }
  if (campo.kind === 'moeda') return moedaTexto(value as string | null);
  if (campo.kind === 'percent') return value == null ? '—' : `${value}%`;
  if (campo.kind === 'm2') return value == null ? '—' : `${value} m²`;
  if (campo.kind === 'data') {
    const iso = String(value ?? '').trim();
    if (!iso) return '—';
    return formatIsoDateOnlyPtBr(iso) ?? iso;
  }
  const s = String(value ?? '').trim();
  return s || '—';
}

export function hrefColunaNegocio(raw: string | null | undefined): string | null {
  const t = String(raw ?? '').trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function mapRow(r: RawImobEmp): ImobEmpreendimentoRow {
  const cond = r.condominios ?? null;
  const card = r.kanban_cards ?? null;
  return {
    id: String(r.id),
    nome: String(r.nome ?? '').trim(),
    slug: (r.slug as string | null) ?? null,
    specs: ((r.specs as string | null) ?? null)?.trim() || null,
    ativo: Boolean(r.ativo ?? true),
    imagem_url: (r.imagem_url as string | null) ?? null,
    share_token: (r.share_token as string | null) ?? null,
    card_id: (r.card_id as string | null) ?? null,
    condominio_id: (r.condominio_id as string | null) ?? null,
    created_at: (r.created_at as string | null) ?? null,
    condominio_nome: cond?.nome ?? null,
    nome_condominio: cond?.nome ?? null,
    condominio_cidade: cond?.cidade ?? null,
    condominio_estado: cond?.estado ?? null,
    card_titulo: card?.titulo ?? null,
    card_status: card?.status ?? null,
    codigo: null,
    quadra: null,
    lote: null,
    fase_atual: null,
    tipo_negocio: txt(r.tipo_negocio),
    pasta_drive: txt(r.pasta_drive),
    valor_terreno: txt(r.valor_terreno),
    pct_compra_parcial_terreno: num(r.pct_compra_parcial_terreno),
    pct_vgv_terrenista: num(r.pct_vgv_terrenista),
    divida_terreno: txt(r.divida_terreno),
    m2_terreno: num(r.m2_terreno),
    contratos: txt(r.contratos),
    prazo_opcao: prazoFromDb(r.prazo_opcao),
    produto_modelo: txt(r.produto_modelo),
    extrato_modelo_configurado: txt(r.extrato_modelo_configurado),
    m2_casa: num(r.m2_casa),
    custo_obra: txt(r.custo_obra),
    divida_obra: txt(r.divida_obra),
    link_bca: txt(r.link_bca),
    link_mapa_competidores: txt(r.link_mapa_competidores),
    vgv_pretendido: txt(r.vgv_pretendido),
    valor_recompra: txt(r.valor_recompra),
    link_acoplamento: txt(r.link_acoplamento),
    link_gbox: txt(r.link_gbox),
    link_apresentacao_comite: txt(r.link_apresentacao_comite),
    data_aprovacao_comite: ymd(r.data_aprovacao_comite),
    prazo_instrumento_garantidor: prazoFromDb(r.prazo_instrumento_garantidor),
    link_projeto_legal: txt(r.link_projeto_legal),
    link_docs_condominio: txt(r.link_docs_condominio),
    data_aprovacao_condominio: ymd(r.data_aprovacao_condominio),
    data_aprovacao_prefeitura: ymd(r.data_aprovacao_prefeitura),
    data_emissao_alvara: ymd(r.data_emissao_alvara),
    data_envio_credito_obra: ymd(r.data_envio_credito_obra),
    data_aprovacao_credito_obra: ymd(r.data_aprovacao_credito_obra),
    data_inicio_obra: ymd(r.data_inicio_obra),
  };
}

/** Step One, depois Portfólio, depois Pré Obra e Obra (Operações). */
const FUNIL_AVANCO_FASE: Record<string, number> = {
  [KANBAN_IDS.STEP_ONE]: 1,
  [KANBAN_IDS.PORTFOLIO]: 2,
  [KANBAN_IDS.OPERACOES]: 3,
};

const CARD_FASE_SELECT =
  'id, titulo, kanban_id, condominio_id, nome_condominio, quadra, lote, processo_step_one_id, projeto_id, origem_card_id, arquivado, kanban_fases!kanban_cards_fase_id_fkey(nome, ordem)';

type CardFaseLite = {
  id: string;
  titulo: string;
  kanban_id: string;
  condominio_id: string | null;
  nome_condominio: string | null;
  quadra: string | null;
  lote: string | null;
  processo_id: string | null;
  projeto_id: string | null;
  origem_card_id: string | null;
  arquivado: boolean;
  fase_nome: string | null;
  fase_ordem: number;
};

function codigoFranquiaDoTitulo(titulo: string): string | null {
  const t = titulo.trim();
  if (!t) return null;
  const i = t.indexOf(' - ');
  const head = (i >= 0 ? t.slice(0, i) : t).trim().toUpperCase();
  return /^FK\d+$/.test(head) ? head : null;
}

function camposDoTituloCard(titulo: string): { nomeCondominio: string | null; quadra: string | null; lote: string | null } {
  const parts = titulo
    .split(' - ')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2 || !/^FK\d+$/i.test(parts[0] ?? '')) {
    return { nomeCondominio: null, quadra: null, lote: null };
  }
  let quadra: string | null = null;
  let lote: string | null = null;
  for (let i = 2; i < parts.length; i++) {
    const seg = parts[i]!;
    const q = /^Q:\s*(.+)$/i.exec(seg);
    const l = /^L:\s*(.+)$/i.exec(seg);
    if (q) quadra = q[1]!.trim() || null;
    else if (l) lote = l[1]!.trim() || null;
    else if (!quadra) quadra = seg;
    else if (!lote) lote = seg;
  }
  return { nomeCondominio: parts[1] ?? null, quadra, lote };
}

function chaveLoteEmpreendimento(condominioId: string | null, quadra: string | null, lote: string | null): string {
  const c = String(condominioId ?? '').trim();
  const q = String(quadra ?? '').trim().toLowerCase();
  const l = String(lote ?? '').trim().toLowerCase();
  if (!c || !q || !l) return '';
  return `${c}|${q}|${l}`;
}

function mapCardFase(raw: Record<string, unknown>): CardFaseLite | null {
  const id = String(raw.id ?? '').trim();
  if (!id) return null;
  const faseRaw = raw.kanban_fases;
  const fase = Array.isArray(faseRaw) ? faseRaw[0] : faseRaw;
  const faseObj = fase && typeof fase === 'object' ? (fase as { nome?: string | null; ordem?: number | null }) : null;
  const titulo = String(raw.titulo ?? '');
  const doTitulo = camposDoTituloCard(titulo);
  return {
    id,
    titulo,
    kanban_id: String(raw.kanban_id ?? ''),
    condominio_id: txt(raw.condominio_id),
    nome_condominio: txt(raw.nome_condominio) ?? doTitulo.nomeCondominio,
    quadra: txt(raw.quadra) ?? doTitulo.quadra,
    lote: txt(raw.lote) ?? doTitulo.lote,
    processo_id: txt(raw.processo_step_one_id),
    projeto_id: txt(raw.projeto_id),
    origem_card_id: txt(raw.origem_card_id),
    arquivado: Boolean(raw.arquivado),
    fase_nome: txt(faseObj?.nome),
    fase_ordem: Number(faseObj?.ordem ?? 0) || 0,
  };
}

function pontuacaoFase(card: CardFaseLite): number {
  const funil = FUNIL_AVANCO_FASE[card.kanban_id] ?? 0;
  if (!funil || !card.fase_nome) return -1;
  return funil * 1_000_000 + card.fase_ordem;
}

function primeiroPreenchido(valores: Array<string | null | undefined>): string | null {
  for (const v of valores) {
    const s = String(v ?? '').trim();
    if (s) return s;
  }
  return null;
}

async function enriquecerLocalizacaoFaseEmpreendimentos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: ImobEmpreendimentoRow[],
): Promise<void> {
  const cardIds = [...new Set(rows.map((r) => String(r.card_id ?? '').trim()).filter(Boolean))];
  const kanbanIds = [KANBAN_IDS.STEP_ONE, KANBAN_IDS.PORTFOLIO, KANBAN_IDS.OPERACOES];

  const { data: funilData, error: funilError } = await supabase
    .from('kanban_cards')
    .select(CARD_FASE_SELECT)
    .in('kanban_id', kanbanIds);

  if (funilError) {
    console.error('[imob_empreendimentos] fase atual:', funilError.message);
    return;
  }

  const funilCards: CardFaseLite[] = [];
  for (const raw of (funilData ?? []) as unknown as Record<string, unknown>[]) {
    const card = mapCardFase(raw);
    if (card) funilCards.push(card);
  }

  const porId = new Map<string, CardFaseLite>();
  const filhos = new Map<string, string[]>();
  const porProcesso = new Map<string, CardFaseLite[]>();
  const porProjeto = new Map<string, CardFaseLite[]>();
  const porLote = new Map<string, CardFaseLite[]>();
  for (const card of funilCards) {
    porId.set(card.id, card);
    if (card.origem_card_id) {
      const lista = filhos.get(card.origem_card_id) ?? [];
      lista.push(card.id);
      filhos.set(card.origem_card_id, lista);
    }
    if (card.processo_id) {
      const lista = porProcesso.get(card.processo_id) ?? [];
      lista.push(card);
      porProcesso.set(card.processo_id, lista);
    }
    if (card.projeto_id) {
      const lista = porProjeto.get(card.projeto_id) ?? [];
      lista.push(card);
      porProjeto.set(card.projeto_id, lista);
    }
    const loteKey = chaveLoteEmpreendimento(card.condominio_id, card.quadra, card.lote);
    if (loteKey) {
      const lista = porLote.get(loteKey) ?? [];
      lista.push(card);
      porLote.set(loteKey, lista);
    }
  }

  const sementes = new Map<string, CardFaseLite>();
  const faltantes = cardIds.filter((id) => !porId.has(id));
  for (let i = 0; i < faltantes.length; i += 150) {
    const slice = faltantes.slice(i, i + 150);
    const { data, error } = await supabase.from('kanban_cards').select(CARD_FASE_SELECT).in('id', slice);
    if (error) {
      console.error('[imob_empreendimentos] card vinculado:', error.message);
      continue;
    }
    for (const raw of (data ?? []) as unknown as Record<string, unknown>[]) {
      const card = mapCardFase(raw);
      if (card) sementes.set(card.id, card);
    }
  }
  for (const id of cardIds) {
    const noFunil = porId.get(id);
    if (noFunil) sementes.set(id, noFunil);
  }

  const condPorId = new Map<string, { nome: string | null; cidade: string | null; estado: string | null }>();
  const condIdsExtra = new Set<string>();
  for (const row of rows) {
    if (row.condominio_estado && row.condominio_cidade) continue;
    const seed = row.card_id ? sementes.get(row.card_id) : undefined;
    const cid = String(seed?.condominio_id || row.condominio_id || '').trim();
    if (cid) condIdsExtra.add(cid);
  }
  const condIds = [...condIdsExtra];
  for (let i = 0; i < condIds.length; i += 150) {
    const slice = condIds.slice(i, i + 150);
    const { data, error } = await supabase.from('condominios').select('id, nome, cidade, estado').in('id', slice);
    if (error) {
      console.error('[imob_empreendimentos] condominio:', error.message);
      continue;
    }
    for (const raw of data ?? []) {
      const id = String((raw as { id?: string }).id ?? '').trim();
      if (!id) continue;
      condPorId.set(id, {
        nome: txt((raw as { nome?: string | null }).nome),
        cidade: txt((raw as { cidade?: string | null }).cidade),
        estado: txt((raw as { estado?: string | null }).estado),
      });
    }
  }

  for (const row of rows) {
    const seedId = String(row.card_id ?? '').trim();
    const seed = seedId ? sementes.get(seedId) ?? null : null;
    const relacionados = new Map<string, CardFaseLite>();
    const incluir = (card: CardFaseLite | null | undefined) => {
      if (!card || !FUNIL_AVANCO_FASE[card.kanban_id]) return;
      relacionados.set(card.id, card);
    };

    if (seed) {
      let cursorId: string | null = seed.id;
      const vistosUp = new Set<string>();
      for (let passo = 0; passo < 8 && cursorId; passo++) {
        if (vistosUp.has(cursorId)) break;
        vistosUp.add(cursorId);
        const card: CardFaseLite | null =
          cursorId === seed.id ? seed : porId.get(cursorId) ?? null;
        if (!card) break;
        incluir(card);
        cursorId = card.origem_card_id;
      }

      const fila = [seed.id];
      const vistosDown = new Set<string>();
      while (fila.length > 0) {
        const id = fila.pop()!;
        if (vistosDown.has(id)) continue;
        vistosDown.add(id);
        incluir(porId.get(id) ?? (id === seed.id ? seed : null));
        for (const filho of filhos.get(id) ?? []) fila.push(filho);
      }

      if (seed.processo_id) {
        for (const card of porProcesso.get(seed.processo_id) ?? []) incluir(card);
      }
      if (seed.projeto_id) {
        for (const card of porProjeto.get(seed.projeto_id) ?? []) incluir(card);
      }
      const loteKey = chaveLoteEmpreendimento(
        seed.condominio_id ?? row.condominio_id,
        seed.quadra,
        seed.lote,
      );
      if (loteKey) {
        for (const card of porLote.get(loteKey) ?? []) incluir(card);
      }
    }

    const cards = [...relacionados.values()];
    let melhor: CardFaseLite | null = null;
    let melhorScore = -1;
    const ativos = cards.filter((c) => !c.arquivado && pontuacaoFase(c) >= 0);
    const pool = ativos.length > 0 ? ativos : cards;
    for (const card of pool) {
      const score = pontuacaoFase(card);
      if (score > melhorScore) {
        melhorScore = score;
        melhor = card;
      }
    }

    const fontes = [seed, melhor, ...cards].filter((c): c is CardFaseLite => Boolean(c));
    row.codigo = primeiroPreenchido(fontes.map((c) => codigoFranquiaDoTitulo(c.titulo)));
    row.quadra = primeiroPreenchido(fontes.map((c) => c.quadra));
    row.lote = primeiroPreenchido(fontes.map((c) => c.lote));
    const nomeCondominioCard = primeiroPreenchido(fontes.map((c) => c.nome_condominio));
    if (row.condominio_id && !row.condominio_nome) row.condominio_nome = nomeCondominioCard;
    row.nome_condominio = row.condominio_nome ?? nomeCondominioCard;
    const condId = String(seed?.condominio_id || row.condominio_id || '').trim();
    const cond = condId ? condPorId.get(condId) : undefined;
    if (cond) {
      if (!row.condominio_estado) row.condominio_estado = cond.estado;
      if (!row.condominio_cidade) row.condominio_cidade = cond.cidade;
      if (!row.nome_condominio) row.nome_condominio = cond.nome;
    }
    row.fase_atual = melhor?.fase_nome ?? null;
  }
}

export async function fetchImobEmpreendimentosRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<ImobEmpreendimentoRow[] | null> {
  const { data, error } = await supabase
    .from('imob_empreendimentos')
    .select(
      `id, nome, slug, specs, ativo, imagem_url, share_token, card_id, condominio_id, created_at, ${NEGOCIO_SELECT},
       condominios(id, nome, cidade, estado),
       kanban_cards(id, titulo, status)`,
    )
    .order('nome', { ascending: true });

  if (error) {
    console.error('[imob_empreendimentos] fetch:', error.message);
    return null;
  }

  const rows = ((data ?? []) as unknown as RawImobEmp[]).map((r) => mapRow(r));
  await enriquecerLocalizacaoFaseEmpreendimentos(supabase, rows);

  // Enrich with counts
  const { data: corretoresLinks } = await supabase
    .from('imob_corretor_empreendimentos')
    .select('empreendimento_id, corretor_id');

  if (corretoresLinks) {
    const countMap = new Map<string, Set<string>>();
    for (const link of corretoresLinks) {
      const empId = String((link as { empreendimento_id?: string }).empreendimento_id ?? '');
      const corrId = String((link as { corretor_id?: string }).corretor_id ?? '');
      if (!countMap.has(empId)) countMap.set(empId, new Set());
      countMap.get(empId)!.add(corrId);
    }
    for (const row of rows) {
      const set = countMap.get(row.id);
      row.corretores_count = set?.size ?? 0;
      row.corretor_ids = set ? [...set] : [];
    }
  }

  const { data: unidades } = await supabase
    .from('imob_card_empreendimentos')
    .select('card_id');

  if (unidades) {
    const unitMap = new Map<string, number>();
    for (const u of unidades) {
      const cardId = String((u as { card_id?: string }).card_id ?? '');
      unitMap.set(cardId, (unitMap.get(cardId) ?? 0) + 1);
    }
    for (const row of rows) {
      row.unidades_count = row.card_id ? (unitMap.get(row.card_id) ?? 0) : 0;
    }
  }

  return rows;
}
