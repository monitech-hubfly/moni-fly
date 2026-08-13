import type { KanbanFase } from '@/components/kanban-shared/types';
import { isRedeStaffRole } from '@/lib/authz';
import { FASE_SLUGS } from '@/lib/constants/kanban-ids';

/** Nome do kanban na tabela `kanbans` (ex.: Funil Loteadores). Rota do app: `/loteadores`. */
export const KANBAN_NOME_FUNIL_LOTEADORES = 'Funil Loteadores' as const;

export type LoteadoresFaseCanon = {
  ordem: number;
  slug: string;
  nome: string;
  /** SLA em dias (referência; fonte de verdade no banco). */
  slaDias: number | null;
  deprecated?: boolean;
};

/**
 * Esteira canônica v1 — 20 fases ativas (ordem 1–20).
 * Displays alinhados às migrations 513–517 + 521 (Novo Produto).
 */
export const LOTEADORES_FASES_CANONICAS: readonly LoteadoresFaseCanon[] = [
  { ordem: 1, slug: FASE_SLUGS.LOTEADORES_PRIMEIRO_CONTATO, nome: 'Novo Loteador', slaDias: 1 },
  { ordem: 2, slug: FASE_SLUGS.LOTEADORES_R1_CONCEITO, nome: 'R1 Conceito', slaDias: 5 },
  { ordem: 3, slug: FASE_SLUGS.NDA_MONI_INC, nome: 'NDA', slaDias: 3 },
  { ordem: 4, slug: FASE_SLUGS.OPCAO_MONI_INC, nome: 'Opção', slaDias: 3 },
  { ordem: 5, slug: FASE_SLUGS.AGUARDANDO_FICHA_MONI_INC, nome: 'Aguardando Ficha', slaDias: 3 },
  { ordem: 6, slug: FASE_SLUGS.LOTEADORES_NOVO_PRODUTO, nome: 'Novo Produto', slaDias: 20 },
  { ordem: 7, slug: FASE_SLUGS.LOTEADORES_VIABILIDADE, nome: 'Viabilidade / Premissas', slaDias: 1 },
  { ordem: 8, slug: FASE_SLUGS.LOTEADORES_ACOPLAMENTO, nome: 'Acoplamento', slaDias: 1 },
  { ordem: 9, slug: FASE_SLUGS.LOTEADORES_EXECUCAO_MATERIAL, nome: 'Executar Material', slaDias: 1 },
  { ordem: 10, slug: FASE_SLUGS.VALIDACAO_MONI_INC, nome: 'Validação', slaDias: 1 },
  { ordem: 11, slug: FASE_SLUGS.LOTEADORES_R2_PLANO_TEORICO, nome: 'R2 Apresentação', slaDias: 5 },
  { ordem: 12, slug: FASE_SLUGS.LOTEADORES_REVISOES, nome: 'Revisões + Forma Pgto', slaDias: 2 },
  { ordem: 13, slug: FASE_SLUGS.ACOPLAMENTO_GBOX_MONI_INC, nome: 'Acoplamento + Gbox', slaDias: 5 },
  { ordem: 14, slug: FASE_SLUGS.LOTEADORES_COMITE, nome: 'Comitê', slaDias: 3 },
  { ordem: 15, slug: FASE_SLUGS.REVISOES_POS_COMITE_MONI_INC, nome: 'Revisões', slaDias: 2 },
  { ordem: 16, slug: FASE_SLUGS.CTO_PRECEDENTES_MONI_INC, nome: 'Cto c/ Precedentes', slaDias: 3 },
  { ordem: 17, slug: FASE_SLUGS.LOTEADORES_DILIGENCIA, nome: 'Diligência', slaDias: 10 },
  { ordem: 18, slug: FASE_SLUGS.LOTEADORES_CTO_SHOWROOM, nome: 'Cto Showroom', slaDias: 3 },
  { ordem: 19, slug: FASE_SLUGS.PASSAGEM_WAYSERS_MONI_INC, nome: 'Passagem para Waysers', slaDias: 1 },
  { ordem: 20, slug: FASE_SLUGS.LOTEADORES_CONTRATO_PARCERIA, nome: 'Cto de Parceria', slaDias: 3 },
] as const;

/** Fases inativas no banco — mantidas no código para compat / histórico. */
export const LOTEADORES_FASES_DEPRECATED: readonly LoteadoresFaseCanon[] = [
  {
    ordem: 90,
    slug: FASE_SLUGS.LOTEADORES_BATALHA_CASAS,
    nome: 'Batalha de Casas',
    slaDias: null,
    deprecated: true,
  },
  {
    ordem: 91,
    slug: FASE_SLUGS.LOTEADORES_R3_AJUSTES_FINAIS,
    nome: 'R3 Ajustes Finais',
    slaDias: null,
    deprecated: true,
  },
  {
    ordem: 92,
    slug: FASE_SLUGS.LOTEADORES_MONI_CAPITAL,
    nome: 'Moní Capital',
    slaDias: null,
    deprecated: true,
  },
  {
    ordem: 93,
    slug: FASE_SLUGS.LOTEADORES_ABERTURA_SPE,
    nome: 'Abertura da SPE',
    slaDias: null,
    deprecated: true,
  },
  {
    ordem: 94,
    slug: FASE_SLUGS.LOTEADORES_FECHAR_CONTRATO,
    nome: 'Contrato (legado)',
    slaDias: null,
    deprecated: true,
  },
] as const;

/** Slugs na ordem canônica das 20 fases ativas. */
export const LOTEADORES_FASES_ORDEM_SLUGS: readonly string[] = LOTEADORES_FASES_CANONICAS.map(
  (f) => f.slug,
);

export const LOTEADORES_FASE_NOME_POR_SLUG: Readonly<Record<string, string>> = {
  ...Object.fromEntries(
    [...LOTEADORES_FASES_CANONICAS, ...LOTEADORES_FASES_DEPRECATED].map((f) => [f.slug, f.nome]),
  ),
  /** DEV/legado: primeira fase ainda usa este slug. */
  loteador_cadastro: 'Novo Loteador',
};

export function isLoteadoresFaseDeprecated(slug: string | null | undefined): boolean {
  const s = String(slug ?? '').trim();
  return LOTEADORES_FASES_DEPRECATED.some((f) => f.slug === s);
}

/** Display preferido (TS) — fallback ao nome vindo do banco. */
export function nomeDisplayFaseLoteadores(
  slug: string | null | undefined,
  nomeBanco?: string | null,
): string {
  const s = String(slug ?? '').trim();
  if (s && LOTEADORES_FASE_NOME_POR_SLUG[s]) return LOTEADORES_FASE_NOME_POR_SLUG[s];
  return String(nomeBanco ?? '').trim() || s || 'Fase';
}

/** Ordena fases do board pela sequência canônica (ativas primeiro). */
export function ordenarFasesLoteadoresCanonicas<T extends { slug?: string | null; ordem: number }>(
  fases: T[],
): T[] {
  const idx = new Map(LOTEADORES_FASES_ORDEM_SLUGS.map((slug, i) => [slug, i]));
  return [...fases].sort((a, b) => {
    const sa = String(a.slug ?? '').trim();
    const sb = String(b.slug ?? '').trim();
    const ia = idx.has(sa) ? (idx.get(sa) as number) : 1000 + a.ordem;
    const ib = idx.has(sb) ? (idx.get(sb) as number) : 1000 + b.ordem;
    if (ia !== ib) return ia - ib;
    return a.ordem - b.ordem;
  });
}

/**
 * Fases elegíveis para KPIs / funil do Painel de Performance (Loteadores).
 * Exclui `ativo === false` e slugs deprecated (Batalha, R3, Moní Capital, SPE, fechar_contrato).
 * Ordena pela esteira canônica de 20 fases.
 */
export function fasesAtivasPainelLoteadores<
  T extends { slug?: string | null; ordem: number; ativo?: boolean },
>(fases: T[]): T[] {
  const filtradas = fases.filter((f) => {
    if (f.ativo === false) return false;
    if (isLoteadoresFaseDeprecated(f.slug)) return false;
    return true;
  });
  return ordenarFasesLoteadoresCanonicas(filtradas);
}

/** Fase inicial para «+ Novo card» e modal de criação. */
export function resolverPrimeiraFaseContatoLoteadores(fases: KanbanFase[]): string | null {
  if (!fases.length) return null;
  const slugsIniciais = new Set([
    FASE_SLUGS.LOTEADORES_PRIMEIRO_CONTATO,
    'loteador_cadastro',
  ]);
  const bySlug = fases.find((f) => slugsIniciais.has((f.slug ?? '').trim()));
  if (bySlug) return bySlug.id;
  const nomesIniciais = new Set(['novo loteador', 'primeiro contato']);
  const byNome = fases.find((f) => nomesIniciais.has(f.nome.trim().toLowerCase()));
  if (byNome) return byNome.id;
  const byOrdem = fases.find((f) => f.ordem === 1);
  if (byOrdem) return byOrdem.id;
  return fases[0]?.id ?? null;
}

/** Admin + team (+ legados consultor/supervisor via `normalizeAccessRole`). */
export function isStaffKanbanLoteadores(role: string | null | undefined): boolean {
  if (isRedeStaffRole(role)) return true;
  const r = String(role ?? '').trim().toLowerCase();
  return r === 'consultor' || r === 'supervisor';
}
