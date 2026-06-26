import { KANBAN_IDS } from '@/lib/constants/kanban-ids';

/** Esteira principal contínua: Step One → Portfólio → Pré Obra e Obra. */
export const ESTEIRA_TRES_ETAPAS = [
  {
    id: 'step_one',
    label: 'Step One',
    kanbanIds: [KANBAN_IDS.STEP_ONE, KANBAN_IDS.LOTEADORES],
  },
  {
    id: 'portfolio',
    label: 'Portfólio',
    kanbanIds: [KANBAN_IDS.PORTFOLIO],
  },
  {
    id: 'pre_obra_obra',
    label: 'Pré Obra e Obra',
    kanbanIds: [KANBAN_IDS.OPERACOES],
  },
] as const;

/** Funis paralelos à esteira principal (barra secundária / indicador itálico). */
export const FUNIS_PARALELOS_ESTEIRA = [
  { id: 'acoplamento', label: 'Acoplamento', kanbanIds: [KANBAN_IDS.ACOPLAMENTO] },
  { id: 'contabilidade', label: 'Contabilidade', kanbanIds: [KANBAN_IDS.CONTABILIDADE] },
  { id: 'credito_obra', label: 'Cash Me', kanbanIds: [KANBAN_IDS.CREDITO_OBRA] },
  { id: 'juridico', label: 'Jurídico', kanbanIds: [KANBAN_IDS.JURIDICO] },
  { id: 'projeto_legal', label: 'Projeto Legal', kanbanIds: [KANBAN_IDS.PROJETO_LEGAL] },
  { id: 'projetos_locais', label: 'Projetos Locais', kanbanIds: [KANBAN_IDS.PROJETOS_LOCAIS] },
  { id: 'projetos_legais', label: 'Projetos Legais', kanbanIds: [KANBAN_IDS.PROJETOS_LEGAIS] },
  { id: 'hdm_modelo_virtual', label: 'Modelo Virtual', kanbanIds: [KANBAN_IDS.HDM_MODELO_VIRTUAL] },
  { id: 'hdm_homologacoes', label: 'Homologações', kanbanIds: [KANBAN_IDS.HDM_HOMOLOGACOES] },
  { id: 'hdm_produto', label: 'Produto HDM', kanbanIds: [KANBAN_IDS.HDM_PRODUTO] },
  { id: 'contratacoes', label: 'Contratações', kanbanIds: [KANBAN_IDS.CONTRATACOES] },
  { id: 'moni_capital', label: 'Divify', kanbanIds: [KANBAN_IDS.MONI_CAPITAL] },
] as const;

const KANBAN_PARA_INDICE_MAIN = new Map<string, number>();
for (let i = 0; i < ESTEIRA_TRES_ETAPAS.length; i++) {
  for (const kid of ESTEIRA_TRES_ETAPAS[i].kanbanIds) {
    KANBAN_PARA_INDICE_MAIN.set(kid, i);
  }
}

const KANBAN_PARALELO = new Map<string, (typeof FUNIS_PARALELOS_ESTEIRA)[number]>();
for (const funil of FUNIS_PARALELOS_ESTEIRA) {
  for (const kid of funil.kanbanIds) {
    KANBAN_PARALELO.set(kid, funil);
  }
}

/** Estágio da esteira principal em que o funil paralelo se ramifica. */
const PARALELO_RAMIFICACAO_MAIN: Record<string, number> = {
  credito_obra: 2,
  acoplamento: 1,
  contabilidade: 1,
  juridico: 1,
  projeto_legal: 2,
  projetos_locais: 2,
  projetos_legais: 2,
  hdm_modelo_virtual: 2,
  hdm_homologacoes: 2,
  hdm_produto: 2,
  contratacoes: 2,
  moni_capital: 1,
};

export function indiceEsteiraTresEtapas(kanbanId: string): number {
  const kid = String(kanbanId ?? '').trim();
  const main = KANBAN_PARA_INDICE_MAIN.get(kid);
  if (typeof main === 'number') return main;
  const paralelo = KANBAN_PARALELO.get(kid);
  if (paralelo) return PARALELO_RAMIFICACAO_MAIN[paralelo.id] ?? 1;
  return 0;
}

/** Índice (0-based) da esteira principal em que o funil paralelo se ramifica. */
export function indiceRamificacaoFunilParalelo(kanbanId: string): number {
  const kid = String(kanbanId ?? '').trim();
  const paralelo = KANBAN_PARALELO.get(kid);
  if (paralelo) return PARALELO_RAMIFICACAO_MAIN[paralelo.id] ?? 1;
  return indiceEsteiraTresEtapas(kid);
}

/** `grid-column` CSS (1-based) para posicionar sub-esteira paralela sob a esteira principal. */
export function gridColumnSubesteiraParalela(kanbanIds: readonly string[]): string {
  const indices = kanbanIds.map((kid) => indiceRamificacaoFunilParalelo(kid));
  const minIdx = Math.min(...indices);
  const maxIdx = Math.max(...indices);
  return `${minIdx + 1} / ${maxIdx + 2}`;
}

export function isFunilParaleloEsteira(kanbanId: string): boolean {
  return KANBAN_PARALELO.has(String(kanbanId ?? '').trim());
}

export function configFunilParaleloEsteira(kanbanId: string): (typeof FUNIS_PARALELOS_ESTEIRA)[number] | null {
  return KANBAN_PARALELO.get(String(kanbanId ?? '').trim()) ?? null;
}

export function isFunilEsteiraPrincipal(kanbanId: string): boolean {
  return KANBAN_PARA_INDICE_MAIN.has(String(kanbanId ?? '').trim());
}

export function maxOrdemFaseKanban(
  kanbanId: string,
  maxOrdemPorKanban: Record<string, number> | undefined,
  fallbackOrdemCard: number,
): number {
  const fromMap = maxOrdemPorKanban?.[kanbanId];
  if (fromMap != null && fromMap > 0) return fromMap;
  return Math.max(1, fallbackOrdemCard);
}

export function ratioFaseNoKanban(
  card: { kanban_id: string; fase_ordem: number },
  maxOrdemPorKanban: Record<string, number> | undefined,
): number {
  const max = maxOrdemFaseKanban(card.kanban_id, maxOrdemPorKanban, card.fase_ordem);
  const ordem = Math.max(0, Number(card.fase_ordem ?? 0));
  if (ordem <= 0) return 0.08;
  return Math.max(0.08, Math.min(0.98, ordem / max));
}

type ProjetoNegocioRef = {
  projeto_id?: string | null;
  /** Alias eventual no row bruto — mesmo FK `projeto_negocio.id` que `projeto_id`. */
  projeto_negocio_id?: string | null;
};

/** ID do negócio (`projeto_negocio.id`) para correlacionar esteiras paralelas. */
export function idProjetoNegocioPipelineCard(card: ProjetoNegocioRef): string {
  return String(card.projeto_negocio_id ?? card.projeto_id ?? '').trim();
}

/** Card da esteira principal do mesmo projeto — progresso da barra principal para funis paralelos. */
export function resolverCardEsteiraPrincipalProjeto(
  card: ProjetoNegocioRef & { kanban_id: string },
  siblingCards: Array<ProjetoNegocioRef & { kanban_id: string; fase_ordem: number }> | undefined,
): { kanban_id: string; fase_ordem: number } | null {
  const pid = idProjetoNegocioPipelineCard(card);
  if (!pid || !siblingCards?.length) return null;
  const doProjeto = siblingCards.filter((c) => idProjetoNegocioPipelineCard(c) === pid);
  const principal = doProjeto.find((c) => isFunilEsteiraPrincipal(c.kanban_id));
  if (principal) return principal;
  let best: (typeof doProjeto)[number] | null = null;
  let bestIdx = -1;
  for (const c of doProjeto) {
    const idx = indiceEsteiraTresEtapas(c.kanban_id);
    if (idx > bestIdx) {
      bestIdx = idx;
      best = c;
    }
  }
  return best;
}
