import {
  adicionarDiasCorridos,
  adicionarDiasUteis,
  parseIsoDateOnlyLocal,
} from '@/lib/dias-uteis';
import type { SlaTipo } from '@/lib/dias-uteis';

export type EsteiraColuna = {
  slug: string;
  label: string;
  sla: number | null;
  tipo: SlaTipo;
  ordemGlobal: number;
  /** UUID canônico PROD — fallback quando slug não bate. */
  faseId: string;
};

/** 14 fases-chave da esteira principal (Step One → Portfólio → Operações). */
export const ESTEIRA_COLUNAS: readonly EsteiraColuna[] = [
  { slug: 'mapa_competidores', label: 'Mapa Comp.', sla: 3, tipo: 'uteis', ordemGlobal: 1, faseId: 'ba79c1e4-d65a-4cef-9ee2-a8aaf0c614e0' },
  { slug: 'bca', label: 'BCA', sla: 1, tipo: 'uteis', ordemGlobal: 2, faseId: '8fda525c-720d-4db7-821d-52625867a000' },
  { slug: 'hipoteses', label: 'Hipóteses', sla: 1, tipo: 'uteis', ordemGlobal: 3, faseId: 'bf21d44c-e1d3-49cc-861d-7b39356e0bb8' },
  { slug: 'step_2', label: 'Novo Neg.', sla: 2, tipo: 'uteis', ordemGlobal: 4, faseId: '66815477-092e-433b-a6e7-e0ea59c8cb5e' },
  { slug: 'step_4', label: 'Check Legal', sla: 3, tipo: 'uteis', ordemGlobal: 5, faseId: 'fd05dc4a-b44a-470e-993f-5df79c223488' },
  { slug: 'step_5', label: 'Comitê', sla: 5, tipo: 'uteis', ordemGlobal: 6, faseId: '9e1c76ba-ce84-4dbd-ae40-e434dc068a81' },
  { slug: 'cto_condicoes_precedentes', label: 'CTO CP', sla: 7, tipo: 'uteis', ordemGlobal: 7, faseId: '' },
  { slug: 'step_6', label: 'Diligência', sla: 10, tipo: 'uteis', ordemGlobal: 8, faseId: '3a66243f-1d11-42e2-a159-60a857057fbc' },
  { slug: 'step_7', label: 'Contrato', sla: 3, tipo: 'uteis', ordemGlobal: 9, faseId: 'd78771cb-f79d-4650-a056-f3e2dbc3f3a6' },
  { slug: 'captacao_moni_capital', label: 'Captação', sla: 30, tipo: 'uteis', ordemGlobal: 10, faseId: 'd7e79cd4-a8ba-4239-b7b4-b82ad07acb11' },
  { slug: 'passagem_wayser', label: 'Passagem', sla: 2, tipo: 'uteis', ordemGlobal: 11, faseId: '5f48a367-699b-4dc4-a310-377fc7d0ff88' },
  { slug: 'aprovacao_condominio', label: 'Aprov. Cond.', sla: null, tipo: 'uteis', ordemGlobal: 12, faseId: 'be88bdd6-a4f1-43f6-b138-5b52031f0c96' },
  { slug: 'aprovacao_prefeitura', label: 'Aprov. Pref.', sla: null, tipo: 'uteis', ordemGlobal: 13, faseId: '8ce359ce-a3cd-436e-a902-b34c7a9b1348' },
  { slug: 'aguardando_credito', label: 'Ag. Crédito', sla: 30, tipo: 'corridos', ordemGlobal: 14, faseId: '8b83e671-ef0c-4028-8b52-8f56579e8df0' },
  { slug: 'em_obra', label: 'Em Obra', sla: 180, tipo: 'corridos', ordemGlobal: 15, faseId: '60ef0129-4180-4089-8975-f64c4f736181' },
] as const;

export type CelulaEsteira = {
  tipo: 'real' | 'est' | 'at' | null;
  date: Date | null;
  isCurrent: boolean;
};

import type { PipelineEsteiraHistoricoEvento } from '@/lib/kanban/pipeline-cards-types';
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDiasPorTipo(base: Date, dias: number, tipo: SlaTipo): Date {
  const normalized = startOfDay(base);
  if (dias <= 0) return normalized;
  if (tipo === 'corridos') return adicionarDiasCorridos(normalized, dias);
  return adicionarDiasUteis(normalized, dias);
}

function parseEntradaFase(iso: string | null | undefined, fallbackIso?: string | null): Date {
  const parsed = parseIsoDateOnlyLocal(iso ?? fallbackIso ?? null);
  if (parsed) return startOfDay(parsed);
  return startOfDay(new Date());
}

function colunaCorrespondeFase(
  col: EsteiraColuna,
  faseId: string,
  faseSlug: string | null | undefined,
): boolean {
  const slug = String(faseSlug ?? '').trim();
  if (slug && col.slug === slug) return true;
  return col.faseId === faseId;
}

/** Resolve coluna da esteira pelo slug (preferido) ou faseId PROD. */
export function resolverColunaEsteira(card: {
  fase_id: string;
  fase_slug: string | null;
}): EsteiraColuna | null {
  const slug = String(card.fase_slug ?? '').trim();
  if (slug) {
    const bySlug = ESTEIRA_COLUNAS.find((c) => c.slug === slug);
    if (bySlug) return bySlug;
  }
  return ESTEIRA_COLUNAS.find((c) => c.faseId === card.fase_id) ?? null;
}

function dataSaidaColuna(
  col: EsteiraColuna,
  historicoDeSaida: Record<string, Date>,
): Date | undefined {
  return historicoDeSaida[col.slug] ?? historicoDeSaida[col.faseId];
}

/**
 * Última data de saída por fase (slug canônico + faseId).
 * Ignora eventos com `is_retrocesso = true`.
 */
export function extrairHistoricoDeSaida(
  eventos: PipelineEsteiraHistoricoEvento[],
): Record<string, Date> {
  const result: Record<string, Date> = {};
  for (const ev of eventos) {
    if (ev.is_retrocesso) continue;
    const date = new Date(ev.criado_em);
    if (Number.isNaN(date.getTime())) continue;
    result[ev.fase_anterior_id] = date;
    const slug = String(ev.fase_anterior_slug ?? '').trim();
    if (slug) result[slug] = date;
  }
  return result;
}

export function computarDatasEsteira(
  card: {
    faseId: string;
    faseSlug: string | null;
    enteredFaseAt: Date;
    slaAtual: number | null;
    slaAtualTipo: SlaTipo;
  },
  historicoDeSaida: Record<string, Date>,
  ordemGlobalAtual: number,
): Record<string, CelulaEsteira> {
  const result: Record<string, CelulaEsteira> = {};
  const now = startOfDay(new Date());
  let cursor: Date | null = null;

  for (const col of ESTEIRA_COLUNAS) {
    const isPast = col.ordemGlobal < ordemGlobalAtual;
    const isCurrent = colunaCorrespondeFase(col, card.faseId, card.faseSlug);
    const isFuture = col.ordemGlobal > ordemGlobalAtual;

    if (isPast) {
      const saida = dataSaidaColuna(col, historicoDeSaida);
      if (saida) {
        const date = startOfDay(saida);
        result[col.slug] = { tipo: 'real', date, isCurrent: false };
        cursor = date;
      } else if (cursor && col.sla) {
        const date = addDiasPorTipo(cursor, col.sla, col.tipo);
        result[col.slug] = { tipo: 'est', date, isCurrent: false };
        cursor = date;
      } else {
        result[col.slug] = { tipo: null, date: null, isCurrent: false };
      }
    } else if (isCurrent) {
      const entrada = startOfDay(card.enteredFaseAt);
      const fimEst = card.slaAtual ? addDiasPorTipo(entrada, card.slaAtual, card.slaAtualTipo) : null;
      const atrasado = fimEst ? now > fimEst : false;
      result[col.slug] = {
        tipo: atrasado ? 'at' : 'est',
        date: fimEst,
        isCurrent: true,
      };
      cursor = fimEst ?? now;
    } else if (isFuture) {
      if (cursor && col.sla) {
        const date = addDiasPorTipo(cursor, col.sla, col.tipo);
        result[col.slug] = { tipo: 'est', date, isCurrent: false };
        cursor = date;
      } else {
        result[col.slug] = { tipo: 'est', date: null, isCurrent: false };
      }
    }
  }

  return result;
}

export function parseEnteredFaseAtEsteira(
  enteredFaseAt: string | null | undefined,
  createdAt?: string | null,
): Date {
  return parseEntradaFase(enteredFaseAt, createdAt);
}
