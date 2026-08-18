import { parseMoneyText } from '@/lib/dashboard-novos-negocios/parseMoney';
import { moedaCampoValorInicial } from '@/lib/kanban/moeda-campo';

export const IMOB_SITUACOES = [
  { id: 'parcial', label: 'Parcialmente quitado' },
  { id: 'quitado', label: 'Quitado 100%' },
  { id: 'lote', label: 'Lote a adquirir' },
] as const;

export const IMOB_PRAZOS_BALAO = [8, 18, 24] as const;

export type ImobSituacaoId = (typeof IMOB_SITUACOES)[number]['id'];
export type ImobPrazoBalao = (typeof IMOB_PRAZOS_BALAO)[number];

export type ImobCardEmpreendimentoRow = {
  id: string;
  card_id: string;
  ordem: number;
  nome: string | null;
  valor_avista: number | null;
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
  nome: string;
  valor_avista: string;
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

function numToCampo(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '';
  return moedaCampoValorInicial(String(n));
}

function campoToNum(raw: string): number | null {
  const n = parseMoneyText(raw);
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

export function rowToImobDraft(row: ImobCardEmpreendimentoRow): ImobCardEmpreendimentoDraft {
  return {
    id: row.id,
    ordem: row.ordem,
    nome: String(row.nome ?? '').trim(),
    valor_avista: numToCampo(row.valor_avista),
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
    nome: draft.nome.trim() || null,
    updated_at: new Date().toISOString(),
  };
  for (const k of MONEY_KEYS) {
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
