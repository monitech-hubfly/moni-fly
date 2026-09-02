import { parseMoneyText } from '@/lib/dashboard-novos-negocios/parseMoney';
import { moedaCampoValorInicial } from '@/lib/kanban/moeda-campo';

export const IMOB_SITUACOES = [
  { id: 'parcial', label: 'Parcialmente quitado' },
  { id: 'quitado', label: 'Quitado 100%' },
  { id: 'lote', label: 'Lote a adquirir' },
] as const;

export const IMOB_PRAZOS_BALAO = [8, 18, 24] as const;

export const IMOB_STATUS_IMOVEL = [
  { id: 'em_breve', label: 'Em breve' },
  { id: 'lancamento', label: 'Lançamento' },
  { id: 'em_construcao', label: 'Em construção' },
  { id: 'pronto_pra_morar', label: 'Pronto pra morar' },
] as const;

export const IMOB_PRODUTOS_MODELO = [
  'Moní Gal™',
  'Moní Cissa™',
  'Moní Eva™',
  'Moní Ivy™',
  'Moní Lena™',
  'Moní Liz™',
  'Moní Mia™',
  'Moní Sol™',
] as const;

export type ImobSituacaoId = (typeof IMOB_SITUACOES)[number]['id'];
export type ImobPrazoBalao = (typeof IMOB_PRAZOS_BALAO)[number];
export type ImobStatusImovelId = (typeof IMOB_STATUS_IMOVEL)[number]['id'];
export type ImobBlocoTipo = 'empreendimento' | 'showroom';

export type ImobCardModeloRow = {
  card_id: string;
  status_imovel: string | null;
  imagem_principal_path: string | null;
  imagem_principal_nome: string | null;
};

export type ImobCardModeloDraft = {
  status_imovel: string;
  imagem_principal_path: string;
  imagem_principal_nome: string;
};

export type ImobCardEmpreendimentoRow = {
  id: string;
  card_id: string;
  ordem: number;
  tipo: ImobBlocoTipo;
  nome: string | null;
  produto_modelo: string | null;
  titulo_oferta: string | null;
  ano_lancamento: number | null;
  quartos: number | null;
  banheiros: number | null;
  vagas: number | null;
  area_vendas_m2: number | null;
  link_modelo: string | null;
  descricao: string | null;
  link_imagens_planta: string | null;
  imagem_oferta_path: string | null;
  imagem_oferta_nome: string | null;
  valor_avista: number | null;
  entrada: number | null;
  parcelas_mensais: number | null;
  balao_parcial_8: number | null;
  balao_parcial_18: number | null;
  balao_parcial_24: number | null;
  balao_quitado_8: number | null;
  balao_quitado_18: number | null;
  balao_quitado_24: number | null;
  balao_lote_8: number | null;
  balao_lote_18: number | null;
  balao_lote_24: number | null;
  fin_parcial_valor: number | null;
  fin_parcial_p1: number | null;
  fin_parcial_ultima: number | null;
  fin_parcial_total: number | null;
  fin_quitado_valor: number | null;
  fin_quitado_p1: number | null;
  fin_quitado_ultima: number | null;
  fin_quitado_total: number | null;
  fin_lote_valor: number | null;
  fin_lote_p1: number | null;
  fin_lote_ultima: number | null;
  fin_lote_total: number | null;
};

export type ImobCardEmpreendimentoDraft = {
  id: string;
  ordem: number;
  tipo: ImobBlocoTipo;
  nome: string;
  produto_modelo: string;
  titulo_oferta: string;
  ano_lancamento: string;
  quartos: string;
  banheiros: string;
  vagas: string;
  area_vendas_m2: string;
  link_modelo: string;
  descricao: string;
  link_imagens_planta: string;
  imagem_oferta_path: string;
  imagem_oferta_nome: string;
  valor_avista: string;
  entrada: string;
  parcelas_mensais: string;
  balao_parcial_8: string;
  balao_parcial_18: string;
  balao_parcial_24: string;
  balao_quitado_8: string;
  balao_quitado_18: string;
  balao_quitado_24: string;
  balao_lote_8: string;
  balao_lote_18: string;
  balao_lote_24: string;
  fin_parcial_valor: string;
  fin_parcial_p1: string;
  fin_parcial_ultima: string;
  fin_parcial_total: string;
  fin_quitado_valor: string;
  fin_quitado_p1: string;
  fin_quitado_ultima: string;
  fin_quitado_total: string;
  fin_lote_valor: string;
  fin_lote_p1: string;
  fin_lote_ultima: string;
  fin_lote_total: string;
};

const MONEY_KEYS = [
  'valor_avista',
  'entrada',
  'parcelas_mensais',
  'balao_parcial_8',
  'balao_parcial_18',
  'balao_parcial_24',
  'balao_quitado_8',
  'balao_quitado_18',
  'balao_quitado_24',
  'balao_lote_8',
  'balao_lote_18',
  'balao_lote_24',
  'fin_parcial_valor',
  'fin_parcial_p1',
  'fin_parcial_ultima',
  'fin_parcial_total',
  'fin_quitado_valor',
  'fin_quitado_p1',
  'fin_quitado_ultima',
  'fin_quitado_total',
  'fin_lote_valor',
  'fin_lote_p1',
  'fin_lote_ultima',
  'fin_lote_total',
] as const;

export type ImobMoneyKey = (typeof MONEY_KEYS)[number];

const NUM_KEYS = ['quartos', 'banheiros', 'vagas', 'area_vendas_m2'] as const;

function numToCampo(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '';
  return moedaCampoValorInicial(String(n));
}

function campoToNum(raw: string): number | null {
  const n = parseMoneyText(raw);
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function numToPlain(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '';
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : String(v);
}

function plainToNum(raw: string): number | null {
  const s = String(raw ?? '').trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function anoToCampo(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '';
  return String(Math.trunc(Number(n)));
}

function campoToAno(raw: string): number | null {
  const s = String(raw ?? '').trim();
  if (!/^\d{4}$/.test(s)) return null;
  const n = Number(s);
  if (n < 1900 || n > 2100) return null;
  return n;
}

export function emptyImobCardModeloDraft(): ImobCardModeloDraft {
  return {
    status_imovel: '',
    imagem_principal_path: '',
    imagem_principal_nome: '',
  };
}

export function rowToImobModeloDraft(row: ImobCardModeloRow | null | undefined): ImobCardModeloDraft {
  if (!row) return emptyImobCardModeloDraft();
  return {
    status_imovel: String(row.status_imovel ?? '').trim(),
    imagem_principal_path: String(row.imagem_principal_path ?? '').trim(),
    imagem_principal_nome: String(row.imagem_principal_nome ?? '').trim(),
  };
}

export function draftToImobModeloPatch(draft: ImobCardModeloDraft): Record<string, unknown> {
  return {
    status_imovel: draft.status_imovel.trim() || null,
    imagem_principal_path: draft.imagem_principal_path.trim() || null,
    imagem_principal_nome: draft.imagem_principal_nome.trim() || null,
    updated_at: new Date().toISOString(),
  };
}

export function mapImobCardModeloRow(raw: Record<string, unknown>): ImobCardModeloRow {
  return {
    card_id: String(raw.card_id),
    status_imovel: raw.status_imovel != null ? String(raw.status_imovel) : null,
    imagem_principal_path: raw.imagem_principal_path != null ? String(raw.imagem_principal_path) : null,
    imagem_principal_nome: raw.imagem_principal_nome != null ? String(raw.imagem_principal_nome) : null,
  };
}

export function normalizeImobBlocoTipo(raw: unknown): ImobBlocoTipo {
  return String(raw ?? '').trim() === 'showroom' ? 'showroom' : 'empreendimento';
}

export function rowToImobDraft(row: ImobCardEmpreendimentoRow): ImobCardEmpreendimentoDraft {
  return {
    id: row.id,
    ordem: row.ordem,
    tipo: normalizeImobBlocoTipo(row.tipo),
    nome: String(row.nome ?? '').trim(),
    produto_modelo: String(row.produto_modelo ?? '').trim(),
    titulo_oferta: String(row.titulo_oferta ?? '').trim(),
    ano_lancamento: anoToCampo(row.ano_lancamento),
    quartos: numToPlain(row.quartos),
    banheiros: numToPlain(row.banheiros),
    vagas: numToPlain(row.vagas),
    area_vendas_m2: numToPlain(row.area_vendas_m2),
    link_modelo: String(row.link_modelo ?? '').trim(),
    descricao: String(row.descricao ?? '').trim(),
    link_imagens_planta: String(row.link_imagens_planta ?? '').trim(),
    imagem_oferta_path: String(row.imagem_oferta_path ?? '').trim(),
    imagem_oferta_nome: String(row.imagem_oferta_nome ?? '').trim(),
    valor_avista: numToCampo(row.valor_avista),
    entrada: numToCampo(row.entrada),
    parcelas_mensais: numToCampo(row.parcelas_mensais),
    balao_parcial_8: numToCampo(row.balao_parcial_8),
    balao_parcial_18: numToCampo(row.balao_parcial_18),
    balao_parcial_24: numToCampo(row.balao_parcial_24),
    balao_quitado_8: numToCampo(row.balao_quitado_8),
    balao_quitado_18: numToCampo(row.balao_quitado_18),
    balao_quitado_24: numToCampo(row.balao_quitado_24),
    balao_lote_8: numToCampo(row.balao_lote_8),
    balao_lote_18: numToCampo(row.balao_lote_18),
    balao_lote_24: numToCampo(row.balao_lote_24),
    fin_parcial_valor: numToCampo(row.fin_parcial_valor),
    fin_parcial_p1: numToCampo(row.fin_parcial_p1),
    fin_parcial_ultima: numToCampo(row.fin_parcial_ultima),
    fin_parcial_total: numToCampo(row.fin_parcial_total),
    fin_quitado_valor: numToCampo(row.fin_quitado_valor),
    fin_quitado_p1: numToCampo(row.fin_quitado_p1),
    fin_quitado_ultima: numToCampo(row.fin_quitado_ultima),
    fin_quitado_total: numToCampo(row.fin_quitado_total),
    fin_lote_valor: numToCampo(row.fin_lote_valor),
    fin_lote_p1: numToCampo(row.fin_lote_p1),
    fin_lote_ultima: numToCampo(row.fin_lote_ultima),
    fin_lote_total: numToCampo(row.fin_lote_total),
  };
}

export function draftToImobPatch(draft: ImobCardEmpreendimentoDraft): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    tipo: normalizeImobBlocoTipo(draft.tipo),
    nome: draft.nome.trim() || null,
    produto_modelo: draft.produto_modelo.trim() || null,
    titulo_oferta: draft.titulo_oferta.trim() || null,
    ano_lancamento: campoToAno(draft.ano_lancamento),
    link_modelo: draft.link_modelo.trim() || null,
    descricao: draft.descricao.trim() || null,
    link_imagens_planta: draft.link_imagens_planta.trim() || null,
    imagem_oferta_path: draft.imagem_oferta_path.trim() || null,
    imagem_oferta_nome: draft.imagem_oferta_nome.trim() || null,
    updated_at: new Date().toISOString(),
  };
  for (const k of NUM_KEYS) {
    patch[k] = plainToNum(draft[k]);
  }
  // Só persiste os campos de simulação ativos na UI (legado balão/fin permanece no banco).
  for (const k of ['valor_avista', 'entrada', 'parcelas_mensais'] as const) {
    patch[k] = campoToNum(draft[k]);
  }
  return patch;
}

export function balaoKey(sit: ImobSituacaoId, prazo: ImobPrazoBalao): ImobMoneyKey {
  return `balao_${sit}_${prazo}` as ImobMoneyKey;
}

export function finKey(sit: ImobSituacaoId, campo: 'valor' | 'p1' | 'ultima' | 'total'): ImobMoneyKey {
  return `fin_${sit}_${campo}` as ImobMoneyKey;
}

export function formatImobMoedaExibicao(raw: string): string {
  const n = parseMoneyText(raw);
  if (n == null) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function labelStatusImovel(id: string | null | undefined): string {
  const s = String(id ?? '').trim();
  const hit = IMOB_STATUS_IMOVEL.find((x) => x.id === s || x.label.toLowerCase() === s.toLowerCase());
  return hit?.label ?? (s || '—');
}

export function opcoesProdutoModeloComValorAtual(valorAtual: string): string[] {
  const v = valorAtual.trim();
  const base: string[] = [...IMOB_PRODUTOS_MODELO];
  if (v && !base.some((x) => x === v)) base.unshift(v);
  return base;
}

export function mapImobCardEmpreendimentoRow(raw: Record<string, unknown>): ImobCardEmpreendimentoRow {
  const n = (k: string) => {
    const v = raw[k];
    if (v == null || v === '') return null;
    const num = Number(v);
    return Number.isFinite(num) ? num : null;
  };
  const t = (k: string) => (raw[k] != null ? String(raw[k]) : null);
  return {
    id: String(raw.id),
    card_id: String(raw.card_id),
    ordem: Number(raw.ordem ?? 0),
    tipo: normalizeImobBlocoTipo(raw.tipo),
    nome: t('nome'),
    produto_modelo: t('produto_modelo'),
    titulo_oferta: t('titulo_oferta'),
    ano_lancamento: n('ano_lancamento') != null ? Math.trunc(n('ano_lancamento')!) : null,
    quartos: n('quartos'),
    banheiros: n('banheiros'),
    vagas: n('vagas'),
    area_vendas_m2: n('area_vendas_m2'),
    link_modelo: t('link_modelo'),
    descricao: t('descricao'),
    link_imagens_planta: t('link_imagens_planta'),
    imagem_oferta_path: t('imagem_oferta_path'),
    imagem_oferta_nome: t('imagem_oferta_nome'),
    valor_avista: n('valor_avista'),
    entrada: n('entrada'),
    parcelas_mensais: n('parcelas_mensais'),
    balao_parcial_8: n('balao_parcial_8'),
    balao_parcial_18: n('balao_parcial_18'),
    balao_parcial_24: n('balao_parcial_24'),
    balao_quitado_8: n('balao_quitado_8'),
    balao_quitado_18: n('balao_quitado_18'),
    balao_quitado_24: n('balao_quitado_24'),
    balao_lote_8: n('balao_lote_8'),
    balao_lote_18: n('balao_lote_18'),
    balao_lote_24: n('balao_lote_24'),
    fin_parcial_valor: n('fin_parcial_valor'),
    fin_parcial_p1: n('fin_parcial_p1'),
    fin_parcial_ultima: n('fin_parcial_ultima'),
    fin_parcial_total: n('fin_parcial_total'),
    fin_quitado_valor: n('fin_quitado_valor'),
    fin_quitado_p1: n('fin_quitado_p1'),
    fin_quitado_ultima: n('fin_quitado_ultima'),
    fin_quitado_total: n('fin_quitado_total'),
    fin_lote_valor: n('fin_lote_valor'),
    fin_lote_p1: n('fin_lote_p1'),
    fin_lote_ultima: n('fin_lote_ultima'),
    fin_lote_total: n('fin_lote_total'),
  };
}
