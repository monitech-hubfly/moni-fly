import type { KanbanCardBrief, KanbanFase } from '@/components/kanban-shared/types';
import { FASE_SLUGS } from '@/lib/constants/kanban-ids';

/** Fases removidas do board — cards são realocados (ver remapCardsFromRemovedStepOneFases). */
export const STEPONE_REMOVED_FASE_SLUGS = [
  'lista_condominios',
  'stepone_lista_cond',
  'pre_batalha',
  'stepone_pre_batalha',
] as const;

/** Slugs canónicos PROD (ordem 1–13). */
export const STEPONE_FASE_SLUGS = {
  ONBOARDING: FASE_SLUGS.ONBOARDING,
  DADOS_CANDIDATO: FASE_SLUGS.DADOS_CANDIDATO,
  DADOS_CIDADE: FASE_SLUGS.DADOS_CIDADE,
  MAPA_COMPETIDORES: FASE_SLUGS.MAPA_COMPETIDORES,
  DADOS_CONDOMINIOS: FASE_SLUGS.DADOS_CONDOMINIOS,
  LOTES_DISPONIVEIS: FASE_SLUGS.LOTES_DISPONIVEIS,
  /** Slug `batalha` — coluna «Pré Batalha». */
  PRE_BATALHA: FASE_SLUGS.BATALHA,
  CONFIGURADOR_CASAS: FASE_SLUGS.CONFIGURADOR_CASAS,
  BCA: FASE_SLUGS.BCA,
  BATALHA_CASAS: FASE_SLUGS.BATALHA_CASAS,
  ESCOLHA: FASE_SLUGS.ESCOLHA,
  HIPOTESES: FASE_SLUGS.HIPOTESES,
} as const;

/** Ordem PROD da fase Nova Hipótese (slug `hipoteses`; chips Portfolio a partir desta fase). */
export const HIPOTESES_ORDEM_MIN_PROD = 13;

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

export const PRE_BATALHA_FASE_SLUGS = [
  FASE_SLUGS.BATALHA,
  'stepone_batalha',
  /** Legado — fase absorvida por `batalha`. */
  FASE_SLUGS.PRE_BATALHA,
  'stepone_pre_batalha',
] as const;

export const CONFIGURADOR_CASAS_FASE_SLUGS = [
  FASE_SLUGS.CONFIGURADOR_CASAS,
  'stepone_configurador_casas',
] as const;

export const ESCOLHA_FASE_SLUGS = [FASE_SLUGS.ESCOLHA, 'stepone_escolha'] as const;

export const BCA_FASE_SLUGS = [
  FASE_SLUGS.BCA,
  FASE_SLUGS.BCA_BATALHA_CASAS,
  'bca_batalha_casas',
  'stepone_bca',
] as const;

export const BATALHA_CASAS_FASE_SLUGS = [
  FASE_SLUGS.BATALHA_CASAS,
  'stepone_batalha_casas',
] as const;

/** @deprecated Alias de PRE_BATALHA_FASE_SLUGS — slug canônico Pré Batalha: `batalha`. */
export const BATALHA_FASE_SLUGS = PRE_BATALHA_FASE_SLUGS;

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
  pre_batalha: FASE_SLUGS.BATALHA,
  stepone_pre_batalha: FASE_SLUGS.BATALHA,
  stepone_escolha: FASE_SLUGS.ESCOLHA,
  stepone_bca: FASE_SLUGS.BCA,
  bca_batalha_casas: FASE_SLUGS.BCA,
  stepone_batalha_casas: FASE_SLUGS.BATALHA_CASAS,
  stepone_batalha: FASE_SLUGS.BATALHA,
  stepone_configurador_casas: FASE_SLUGS.CONFIGURADOR_CASAS,
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

/** Fases Step One omitidas da calculadora global (franquia / candidato). */
export function isCalculadoraExcludedStepOneFaseSlug(slug: string | null | undefined): boolean {
  return isOnboardingFaseSlug(slug) || isDadosCandidatoFaseSlug(slug);
}

/** Fases ativas do Step One exibidas na calculadora de fases. */
export function filterStepOneCalculadoraFases(fases: KanbanFase[]): KanbanFase[] {
  return fases.filter(
    (f) => !isRemovedStepOneFaseSlug(f.slug) && !isCalculadoraExcludedStepOneFaseSlug(f.slug),
  );
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

export function isConfiguradorCasasFaseSlug(slug: string | null | undefined): boolean {
  return slugMatchesStepOneFase(slug, CONFIGURADOR_CASAS_FASE_SLUGS);
}

export function stepOneEtapa5PreBatalhaHref(processoId: string): string {
  return `/step-one/${encodeURIComponent(processoId)}/etapa/5?modo=pre-batalha`;
}

export const STEPONE_CONFIGURADOR_CASAS_URL = 'https://moni-configurador.vercel.app';

export function stepOneConfiguradorCasasHref(): string {
  return STEPONE_CONFIGURADOR_CASAS_URL;
}

export function isBatalhaCasasFaseSlug(slug: string | null | undefined): boolean {
  return slugMatchesStepOneFase(slug, BATALHA_CASAS_FASE_SLUGS);
}

export function stepOneEtapa6BatalhaCasasHref(processoId: string): string {
  return `/step-one/${encodeURIComponent(processoId)}/etapa/6`;
}

export function isEscolhaFaseSlug(slug: string | null | undefined): boolean {
  return slugMatchesStepOneFase(slug, ESCOLHA_FASE_SLUGS);
}

/** @deprecated Preferir `isPreBatalhaFaseSlug` (Pré Batalha) ou `isBatalhaCasasFaseSlug` (Batalha de Casas). */
export function isBatalhaFaseSlug(slug: string | null | undefined): boolean {
  return isPreBatalhaFaseSlug(slug) || isBatalhaCasasFaseSlug(slug);
}

function targetFaseIdForRemovedSlug(
  slug: string | null | undefined,
  fases: KanbanFase[],
): string | undefined {
  const s = String(slug ?? '').trim();
  if (s === 'lista_condominios' || s === 'stepone_lista_cond') {
    return fases.find((f) => isDadosCondominiosFaseSlug(f.slug))?.id;
  }
  if (s === 'pre_batalha' || s === 'stepone_pre_batalha') {
    return fases.find((f) => isPreBatalhaFaseSlug(f.slug))?.id;
  }
  return undefined;
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
    isConfiguradorCasasFaseSlug(faseAtual.slug) ||
    isBcaFaseSlug(faseAtual.slug) ||
    isBatalhaCasasFaseSlug(faseAtual.slug) ||
    isEscolhaFaseSlug(faseAtual.slug) ||
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

/** Remove colunas de fases absorvidas/desativadas do board Step One. */
export function filterStepOneBoardFases(fases: KanbanFase[]): KanbanFase[] {
  return fases.filter((f) => !isRemovedStepOneFaseSlug(f.slug));
}

/** Cards em fases removidas passam para a fase alvo correspondente. */
export function remapCardsFromRemovedStepOneFases(
  cards: KanbanCardBrief[],
  fases: KanbanFase[],
): KanbanCardBrief[] {
  const removedFases = fases.filter((f) => isRemovedStepOneFaseSlug(f.slug));
  if (removedFases.length === 0) return cards;

  const removedIds = new Set(removedFases.map((f) => f.id));
  const targetByRemovedId = new Map<string, string>();
  for (const f of removedFases) {
    const targetId = targetFaseIdForRemovedSlug(f.slug, fases);
    if (targetId) targetByRemovedId.set(f.id, targetId);
  }
  if (targetByRemovedId.size === 0) return cards;

  return cards.map((c) => {
    const targetId = targetByRemovedId.get(c.fase_id);
    return targetId ? { ...c, fase_id: targetId } : c;
  });
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
