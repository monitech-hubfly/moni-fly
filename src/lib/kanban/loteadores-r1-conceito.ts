/** Checklist da fase «R1 Executada — Conceito» — Funil Loteadores. */

export const LOTEADORES_R1_CONCEITO_FASE_SLUG = 'r1_conceito_moni_inc' as const;

export const LOTEADORES_R1_CONCEITO_CAMPOS = {
  interesse: 'interesse_loteador',
  preco: 'preco_atratividade',
  produto: 'produto_atratividade',
  showroom: 'showroom_interesse',
  showroomQual: 'showroom_descricao',
  linhasReceita: 'linhas_receita',
  casaQueVende: 'casa_que_vende',
} as const;

export const LOTEADORES_R1_CONCEITO_CAMPOS_VISIVEIS = Object.values(LOTEADORES_R1_CONCEITO_CAMPOS);

export function isLoteadoresR1ConceitoFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_R1_CONCEITO_FASE_SLUG;
}

export function formatInteresseLoteadorR1(score: number, classificacao: string): string {
  return `${score}/100 — ${classificacao}`;
}

export type ChecklistVisibleWhen = {
  campo_slug?: string;
  valor?: string;
};

export function isChecklistItemVisivelPorCondicao(
  item: { config_json?: Record<string, unknown> | null; campo_slug?: string | null },
  itens: { id: string; campo_slug?: string | null }[],
  respostas: Map<string, { valor?: string }>,
): boolean {
  const when = item.config_json?.visible_when as ChecklistVisibleWhen | undefined;
  if (!when?.campo_slug || when.valor === undefined) return true;

  const refItem = itens.find((i) => i.campo_slug === when.campo_slug);
  if (!refItem) return true;

  const atual = respostas.get(refItem.id)?.valor?.trim() ?? '';
  return atual === String(when.valor);
}
