import type { KanbanCardBrief, KanbanFase } from '@/components/kanban-shared/types';
import { FASE_SLUGS } from '@/lib/constants/kanban-ids';

/** Fase removida na migration 248 — não deve aparecer como coluna no board. */
export const STEPONE_REMOVED_FASE_SLUGS = ['lista_condominios', 'stepone_lista_cond'] as const;

/** Slugs canónicos PROD (ordem 1–11). */
export const STEPONE_FASE_SLUGS = {
  ONBOARDING: FASE_SLUGS.ONBOARDING,
  DADOS_CANDIDATO: FASE_SLUGS.DADOS_CANDIDATO,
  DADOS_CIDADE: FASE_SLUGS.DADOS_CIDADE,
  MAPA_COMPETIDORES: FASE_SLUGS.MAPA_COMPETIDORES,
  DADOS_CONDOMINIOS: FASE_SLUGS.DADOS_CONDOMINIOS,
  LOTES_DISPONIVEIS: FASE_SLUGS.LOTES_DISPONIVEIS,
  PRE_BATALHA: FASE_SLUGS.PRE_BATALHA,
  ESCOLHA: FASE_SLUGS.ESCOLHA,
  BCA: FASE_SLUGS.BCA,
  BATALHA: FASE_SLUGS.BATALHA,
  HIPOTESES: FASE_SLUGS.HIPOTESES,
} as const;

/** Ordem PROD da fase Hipóteses (chips Portfolio a partir desta fase). */
export const HIPOTESES_ORDEM_MIN_PROD = 11;

export const ONBOARDING_FASE_SLUGS = [FASE_SLUGS.ONBOARDING, 'stepone_onboarding'] as const;

export const DADOS_CIDADE_FASE_SLUGS = [
  FASE_SLUGS.DADOS_CIDADE,
  'stepone_dados_cidade',
] as const;

export const DADOS_CONDOMINIOS_FASE_SLUGS = [
  FASE_SLUGS.DADOS_CONDOMINIOS,
  'stepone_dados_cond',
] as const;

export const LOTES_DISPONIVEIS_FASE_SLUGS = [
  FASE_SLUGS.LOTES_DISPONIVEIS,
  'stepone_lotes',
] as const;

export const MAPA_COMPETIDORES_FASE_SLUGS = [
  FASE_SLUGS.MAPA_COMPETIDORES,
  'stepone_mapa',
] as const;

/** PROD + aliases DEV/legado para matching de fase. */
export const DADOS_CANDIDATO_FASE_SLUGS = [
  FASE_SLUGS.DADOS_CANDIDATO,
  'stepone_dados_candidato',
] as const;

export const HIPOTESES_FASE_SLUGS = [FASE_SLUGS.HIPOTESES, 'stepone_hipoteses'] as const;

export const PRE_BATALHA_FASE_SLUGS = [FASE_SLUGS.PRE_BATALHA, 'stepone_pre_batalha'] as const;

export const ESCOLHA_FASE_SLUGS = [FASE_SLUGS.ESCOLHA, 'stepone_escolha'] as const;

export const BCA_FASE_SLUGS = [
  FASE_SLUGS.BCA,
  FASE_SLUGS.BCA_BATALHA_CASAS,
  'bca_batalha_casas',
  'stepone_bca',
] as const;

export const BATALHA_FASE_SLUGS = [FASE_SLUGS.BATALHA, 'stepone_batalha'] as const;

/** Mapa slug legado/DEV → slug canônico PROD. */
export const STEPONE_SLUG_LEGACY_TO_CANONICAL: Record<string, string> = {
  stepone_onboarding: FASE_SLUGS.ONBOARDING,
  stepone_dados_candidato: FASE_SLUGS.DADOS_CANDIDATO,
  stepone_dados_cidade: FASE_SLUGS.DADOS_CIDADE,
  stepone_dados_cond: FASE_SLUGS.DADOS_CONDOMINIOS,
  /** Fase removida (248) — legado redireciona para Dados dos Condomínios. */
  stepone_lista_cond: FASE_SLUGS.DADOS_CONDOMINIOS,
  lista_condominios: FASE_SLUGS.DADOS_CONDOMINIOS,
  stepone_lotes: FASE_SLUGS.LOTES_DISPONIVEIS,
  stepone_mapa: FASE_SLUGS.MAPA_COMPETIDORES,
  stepone_pre_batalha: FASE_SLUGS.PRE_BATALHA,
  stepone_escolha: FASE_SLUGS.ESCOLHA,
  stepone_bca: FASE_SLUGS.BCA,
  bca_batalha_casas: FASE_SLUGS.BCA,
  stepone_batalha: FASE_SLUGS.BATALHA,
  stepone_hipoteses: FASE_SLUGS.HIPOTESES,
};

export function normalizeStepOneFaseSlug(slug: string | null | undefined): string {
  const s = String(slug ?? '').trim();
  if (!s) return s;
  return STEPONE_SLUG_LEGACY_TO_CANONICAL[s] ?? s;
}

export function slugMatchesStepOneFase(
  slug: string | null | undefined,
  candidates: readonly string[],
): boolean {
  const s = String(slug ?? '').trim();
  if (!s) return false;
  const normalized = normalizeStepOneFaseSlug(s);
  return candidates.some((c) => {
    const t = String(c ?? '').trim();
    return t === s || t === normalized || normalizeStepOneFaseSlug(t) === normalized;
  });
}

export function isHipotesesFaseSlug(slug: string | null | undefined): boolean {
  return slugMatchesStepOneFase(slug, HIPOTESES_FASE_SLUGS);
}

export function isDadosCidadeFaseSlug(slug: string | null | undefined): boolean {
  return slugMatchesStepOneFase(slug, DADOS_CIDADE_FASE_SLUGS);
}

export function isOnboardingFaseSlug(slug: string | null | undefined): boolean {
  return slugMatchesStepOneFase(slug, ONBOARDING_FASE_SLUGS);
}

export function isDadosCandidatoFaseSlug(slug: string | null | undefined): boolean {
  return slugMatchesStepOneFase(slug, DADOS_CANDIDATO_FASE_SLUGS);
}

export function isDadosCondominiosFaseSlug(slug: string | null | undefined): boolean {
  return slugMatchesStepOneFase(slug, DADOS_CONDOMINIOS_FASE_SLUGS);
}

/** Funil Step One: fases Onboarding → Dados da Cidade (inclusive) — sem condomínio selecionado ainda. */
export function isStepOneFaseAntesOuDadosCidade(
  faseAtual: { slug?: string | null; ordem?: number } | null | undefined,
  fases: KanbanFase[],
): boolean {
  if (!faseAtual) return false;
  const dadosCidade = fases.find((f) => isDadosCidadeFaseSlug(f.slug));
  if (!dadosCidade) return false;
  if (typeof faseAtual.ordem === 'number' && typeof dadosCidade.ordem === 'number') {
    return faseAtual.ordem <= dadosCidade.ordem;
  }
  return (
    isOnboardingFaseSlug(faseAtual.slug) ||
    isDadosCandidatoFaseSlug(faseAtual.slug) ||
    isDadosCidadeFaseSlug(faseAtual.slug)
  );
}

export function isLotesDisponiveisFaseSlug(slug: string | null | undefined): boolean {
  return slugMatchesStepOneFase(slug, LOTES_DISPONIVEIS_FASE_SLUGS);
}

export function isMapaCompetidoresFaseSlug(slug: string | null | undefined): boolean {
  return slugMatchesStepOneFase(slug, MAPA_COMPETIDORES_FASE_SLUGS);
}

export function isBcaFaseSlug(slug: string | null | undefined): boolean {
  return slugMatchesStepOneFase(slug, BCA_FASE_SLUGS);
}

export function isPreBatalhaFaseSlug(slug: string | null | undefined): boolean {
  return slugMatchesStepOneFase(slug, PRE_BATALHA_FASE_SLUGS);
}

export function stepOneEtapa5PreBatalhaHref(processoId: string): string {
  return `/step-one/${encodeURIComponent(processoId)}/etapa/5?modo=pre-batalha`;
}

export function isEscolhaFaseSlug(slug: string | null | undefined): boolean {
  return slugMatchesStepOneFase(slug, ESCOLHA_FASE_SLUGS);
}

export function isBatalhaFaseSlug(slug: string | null | undefined): boolean {
  return slugMatchesStepOneFase(slug, BATALHA_FASE_SLUGS);
}

/** Funil Step One: fases com condomínio no card (a partir da primeira entre Mapa e Dados dos Condomínios). */
export function isStepOneFaseDesdeDadosCondominios(
  faseAtual: { slug?: string | null; ordem?: number } | null | undefined,
  fases: KanbanFase[],
): boolean {
  if (!faseAtual) return false;
  const dadosCond = fases.find((f) => isDadosCondominiosFaseSlug(f.slug));
  const mapa = fases.find((f) => isMapaCompetidoresFaseSlug(f.slug));
  const ordensGate = [dadosCond?.ordem, mapa?.ordem].filter(
    (o): o is number => typeof o === 'number',
  );
  const ordemGate = ordensGate.length > 0 ? Math.min(...ordensGate) : undefined;
  if (!dadosCond && !mapa) {
    return (
      isDadosCondominiosFaseSlug(faseAtual.slug) || isMapaCompetidoresFaseSlug(faseAtual.slug)
    );
  }
  if (typeof faseAtual.ordem === 'number' && typeof ordemGate === 'number') {
    return faseAtual.ordem >= ordemGate;
  }
  return (
    isDadosCondominiosFaseSlug(faseAtual.slug) ||
    isLotesDisponiveisFaseSlug(faseAtual.slug) ||
    isMapaCompetidoresFaseSlug(faseAtual.slug) ||
    isPreBatalhaFaseSlug(faseAtual.slug) ||
    isEscolhaFaseSlug(faseAtual.slug) ||
    isBcaFaseSlug(faseAtual.slug) ||
    isBatalhaFaseSlug(faseAtual.slug) ||
    isHipotesesFaseSlug(faseAtual.slug)
  );
}

/** Aliases legados que devem resolver para o mesmo `fase_id` no board. */
export function stepOneSlugAliasesForFase(slug: string | null | undefined): string[] {
  const canonical = normalizeStepOneFaseSlug(slug);
  if (!canonical) return [];
  const out = new Set<string>([canonical]);
  for (const [legacy, canon] of Object.entries(STEPONE_SLUG_LEGACY_TO_CANONICAL)) {
    if (canon === canonical) out.add(legacy);
  }
  return [...out];
}

export function isRemovedStepOneFaseSlug(slug: string | null | undefined): boolean {
  const s = String(slug ?? '').trim();
  return (STEPONE_REMOVED_FASE_SLUGS as readonly string[]).includes(s);
}

/** Remove colunas da fase Condomínios (lista_condominios) do board Step One. */
export function filterStepOneBoardFases(fases: KanbanFase[]): KanbanFase[] {
  return fases.filter((f) => !isRemovedStepOneFaseSlug(f.slug));
}

/** Cards na fase removida passam para Dados dos Condomínios (evita órfãos). */
export function remapCardsFromRemovedStepOneFases(
  cards: KanbanCardBrief[],
  fases: KanbanFase[],
): KanbanCardBrief[] {
  const removedIds = new Set(
    fases.filter((f) => isRemovedStepOneFaseSlug(f.slug)).map((f) => f.id),
  );
  if (removedIds.size === 0) return cards;

  const dadosCondFase = fases.find((f) => isDadosCondominiosFaseSlug(f.slug));
  const targetFaseId = dadosCondFase?.id;
  if (!targetFaseId) return cards;

  return cards.map((c) =>
    removedIds.has(c.fase_id) ? { ...c, fase_id: targetFaseId } : c,
  );
}

/** Filtra fases removidas e realoca cards órfãos (board Funil Step One). */
export function prepareStepOneBoardSnapshot(input: {
  fases: KanbanFase[];
  cards: KanbanCardBrief[];
  cardsConcluidos?: KanbanCardBrief[];
}): { fases: KanbanFase[]; cards: KanbanCardBrief[]; cardsConcluidos: KanbanCardBrief[] } {
  const cards = remapCardsFromRemovedStepOneFases(input.cards, input.fases);
  const cardsConcluidos = remapCardsFromRemovedStepOneFases(
    input.cardsConcluidos ?? [],
    input.fases,
  );
  const fases = filterStepOneBoardFases(input.fases);
  return { fases, cards, cardsConcluidos };
}
