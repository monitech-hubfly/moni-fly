import { FASE_SLUGS } from '@/lib/constants/kanban-ids';

/** Slugs canónicos PROD (ordem 1–11). */
export const STEPONE_FASE_SLUGS = {
  DADOS_CANDIDATO: FASE_SLUGS.DADOS_CANDIDATO,
  DADOS_CIDADE: FASE_SLUGS.DADOS_CIDADE,
  LISTA_CONDOMINIOS: FASE_SLUGS.LISTA_CONDOMINIOS,
  DADOS_CONDOMINIOS: FASE_SLUGS.DADOS_CONDOMINIOS,
  LOTES_DISPONIVEIS: FASE_SLUGS.LOTES_DISPONIVEIS,
  MAPA_COMPETIDORES: FASE_SLUGS.MAPA_COMPETIDORES,
  PRE_BATALHA: FASE_SLUGS.PRE_BATALHA,
  ESCOLHA: FASE_SLUGS.ESCOLHA,
  BCA: FASE_SLUGS.BCA,
  BATALHA: FASE_SLUGS.BATALHA,
  HIPOTESES: FASE_SLUGS.HIPOTESES,
} as const;

/** Ordem PROD da fase Hipóteses (chips Portfolio a partir desta fase). */
export const HIPOTESES_ORDEM_MIN_PROD = 11;

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
  stepone_dados_candidato: FASE_SLUGS.DADOS_CANDIDATO,
  stepone_dados_cidade: FASE_SLUGS.DADOS_CIDADE,
  stepone_lista_cond: FASE_SLUGS.LISTA_CONDOMINIOS,
  stepone_dados_cond: FASE_SLUGS.DADOS_CONDOMINIOS,
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

export function isBcaFaseSlug(slug: string | null | undefined): boolean {
  return slugMatchesStepOneFase(slug, BCA_FASE_SLUGS);
}

export function isPreBatalhaFaseSlug(slug: string | null | undefined): boolean {
  return slugMatchesStepOneFase(slug, PRE_BATALHA_FASE_SLUGS);
}

export function isEscolhaFaseSlug(slug: string | null | undefined): boolean {
  return slugMatchesStepOneFase(slug, ESCOLHA_FASE_SLUGS);
}

export function isBatalhaFaseSlug(slug: string | null | undefined): boolean {
  return slugMatchesStepOneFase(slug, BATALHA_FASE_SLUGS);
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
