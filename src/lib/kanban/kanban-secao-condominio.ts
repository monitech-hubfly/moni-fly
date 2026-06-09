import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { isStepOneFaseDesdeDadosCondominios } from '@/lib/kanban/stepone-fase-slugs';
import type { KanbanFase } from '@/components/kanban-shared/types';

const KANBANS_SECAO_CONDOMINIO_TODAS_FASES = new Set<string>([
  KANBAN_IDS.PORTFOLIO,
  KANBAN_IDS.ACOPLAMENTO,
  KANBAN_IDS.OPERACOES,
]);

/** Exibe «Dados do Condomínio» no painel esquerdo do modal do card. */
export function kanbanExibeSecaoCondominioSidebar(params: {
  isLegado: boolean;
  kanbanId: string | null | undefined;
  kanbanNome: string;
  faseAtual: { slug?: string | null; ordem?: number } | null | undefined;
  fases: KanbanFase[];
}): boolean {
  if (params.isLegado) return false;

  const kid = String(params.kanbanId ?? '').trim();
  if (KANBANS_SECAO_CONDOMINIO_TODAS_FASES.has(kid)) return true;

  if (params.kanbanNome === 'Funil Step One') {
    return isStepOneFaseDesdeDadosCondominios(params.faseAtual, params.fases);
  }

  return false;
}
