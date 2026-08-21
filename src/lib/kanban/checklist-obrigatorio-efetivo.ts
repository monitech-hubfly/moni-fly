import { obrigatorioEfetivoDadosCandidato } from '@/lib/kanban/dados-candidato-rede';
import { isDadosCandidatoFaseSlug } from '@/lib/kanban/stepone-fase-slugs';

function normalizarLabelChecklist(label: string): string {
  return String(label ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Mapa interativo é apenas visualização — não bloqueia avanço de fase. */
export function isMapaPracaChecklistItem(item: {
  tipo?: string | null;
  label?: string | null;
}): boolean {
  if (item.tipo === 'mapa_praca') return true;
  return normalizarLabelChecklist(String(item.label ?? '')) === 'mapa interativo da praca';
}

export function obrigatorioEfetivoChecklistItem(
  faseSlug: string,
  item: {
    tipo?: string | null;
    label?: string | null;
    ordem?: number | null;
    obrigatorio?: boolean | null;
  },
): boolean {
  if (isMapaPracaChecklistItem(item)) return false;
  if (isDadosCandidatoFaseSlug(faseSlug)) return obrigatorioEfetivoDadosCandidato(item);
  return Boolean(item.obrigatorio);
}
