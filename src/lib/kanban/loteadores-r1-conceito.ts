/** Checklist da fase «R1 Conceito» — Funil Loteadores. */

import { isLoteadoresChecklistCampoVisivel } from '@/lib/kanban/loteadores-checklist-visibilidade';

export const LOTEADORES_R1_CONCEITO_FASE_SLUG = 'r1_conceito_moni_inc' as const;

export const LOTEADORES_R1_CONCEITO_CAMPOS = {
  dataReuniao: 'r1_data_reuniao',
  loteShowroom: 'r1_lote_showroom',
  materialEnviado: 'r1_material_enviado',
  proximosPassos: 'r1_proximos_passos',
} as const;

export const LOTEADORES_R1_CONCEITO_CAMPOS_VISIVEIS = Object.values(LOTEADORES_R1_CONCEITO_CAMPOS);

export function isLoteadoresR1ConceitoFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_R1_CONCEITO_FASE_SLUG;
}

export function isLoteadoresR1ConceitoCampoVisivel(item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  return isLoteadoresChecklistCampoVisivel(item, LOTEADORES_R1_CONCEITO_CAMPOS_VISIVEIS);
}

export function formatInteresseLoteadorR1(score: number, classificacao: string): string {
  return `${score}/100 — ${classificacao}`;
}

export type ChecklistVisibleWhen = {
  campo_slug?: string;
  valor?: string;
  valores?: string[];
};

export function isChecklistItemVisivelPorCondicao(
  item: { config_json?: Record<string, unknown> | null; campo_slug?: string | null },
  itens: { id: string; campo_slug?: string | null }[],
  respostas: Map<string, { valor?: string }>,
): boolean {
  const when = item.config_json?.visible_when as ChecklistVisibleWhen | undefined;
  const valores = Array.isArray(when?.valores)
    ? when.valores.map((v) => String(v))
    : when?.valor !== undefined
      ? [String(when.valor)]
      : null;
  if (!when?.campo_slug || !valores || valores.length === 0) return true;

  const refItem = itens.find((i) => i.campo_slug === when.campo_slug);
  if (!refItem) return true;

  const atual = respostas.get(refItem.id)?.valor?.trim() ?? '';
  return valores.includes(atual);
}
