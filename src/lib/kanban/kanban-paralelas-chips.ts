import { FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import type { KanbanCardBrief } from '@/components/kanban-shared/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PORTFOLIO_PARALELAS,
  type PortfolioParalelasFlags,
  listarEsteirasParalelasPendentes,
} from '@/lib/kanban/portfolio-paralelas';

export type { PortfolioParalelasFlags };
export { listarEsteirasParalelasPendentes };

/** Slugs da fase Hipóteses (PROD/DEV). */
export const HIPOTESES_FASE_SLUGS = ['hipoteses', 'stepone_hipoteses'] as const;

export type ParalelaChip = {
  label: string;
  concluido: boolean;
  icone?: string;
  /** `vinculo` = chip informativo (ex.: Portfolio no Step One). */
  variant?: 'esteira' | 'vinculo';
};

export type CardParalelasFlags = {
  acoplamento_concluido?: boolean;
  credito_terreno_ok?: boolean;
  contabilidade_ok?: boolean;
  capital_ok?: boolean;
  juridico_ok?: boolean;
  credito_obra_ok?: boolean;
};

export type MontarChipsParalelasInput = {
  kanbanId: string;
  faseSlug: string;
  faseOrdem?: number;
  /** Ordem mínima da fase Hipóteses no Step One (para “a partir de hipóteses”). */
  hipotesesOrdemMin?: number | null;
  origem?: KanbanCardBrief['origem'];
  flags: CardParalelasFlags;
  portfolioVinculoRotulo?: string | null;
  temFilhoJuridico?: boolean;
};

export type MontarChipsParalelasOptions = {
  /** Modal: labels completos; board: abreviações onde existem. */
  labelsCompletos?: boolean;
};

function boolFlag(v: boolean | null | undefined): boolean {
  return Boolean(v);
}

function chipEsteira(label: string, labelCurto: string, concluido: boolean, opts?: MontarChipsParalelasOptions): ParalelaChip {
  return {
    label: opts?.labelsCompletos ? label : labelCurto,
    concluido,
    variant: 'esteira',
  };
}

function rotuloFasePortfolio(nome: string, slug: string): string {
  const s = String(slug ?? '').trim();
  const m = /^step_(\d+)$/i.exec(s);
  if (m) return `Step ${m[1]}`;
  const n = String(nome ?? '').trim();
  if (n) return n;
  return s || '—';
}

export function stepOneExibeChipsVinculo(
  faseSlug: string,
  faseOrdem: number,
  hipotesesOrdemMin: number | null | undefined,
): boolean {
  const s = String(faseSlug ?? '').trim();
  if ((HIPOTESES_FASE_SLUGS as readonly string[]).includes(s)) return true;
  const min = hipotesesOrdemMin;
  if (min != null && Number.isFinite(min) && faseOrdem >= min) return true;
  return false;
}

/** Monta chips conforme kanban + fase; vazio = não renderizar linha. */
export function montarChipsParalelas(
  input: MontarChipsParalelasInput,
  opts?: MontarChipsParalelasOptions,
): ParalelaChip[] {
  if (input.origem === 'legado') return [];

  const kid = String(input.kanbanId ?? '').trim();
  const slug = String(input.faseSlug ?? '').trim();
  const f = input.flags;
  const chips: ParalelaChip[] = [];

  if (kid === KANBAN_IDS.STEP_ONE) {
    const ordem = input.faseOrdem ?? 0;
    if (!stepOneExibeChipsVinculo(slug, ordem, input.hipotesesOrdemMin)) return [];
    const rot = String(input.portfolioVinculoRotulo ?? '').trim();
    if (!rot) return [];
    chips.push({
      label: `Portfolio: ${rot}`,
      concluido: true,
      icone: '📋',
      variant: 'vinculo',
    });
    return chips;
  }

  if (kid === KANBAN_IDS.PORTFOLIO) {
    if (slug === 'step_4' || slug === 'acoplamento') {
      for (const p of PORTFOLIO_PARALELAS) {
        chips.push(
          chipEsteira(p.label, p.labelCurto, boolFlag(f[p.flag]), opts),
        );
      }
    }
    if (slug === FASE_SLUGS.CAPTACAO_CAPITAL) {
      chips.push(chipEsteira('Moní Capital', 'Capital', boolFlag(f.capital_ok), opts));
    }
    if (input.temFilhoJuridico || boolFlag(f.juridico_ok)) {
      chips.push(chipEsteira('Jurídico', 'Jurídico', boolFlag(f.juridico_ok), opts));
    }
    return chips;
  }

  if (kid === KANBAN_IDS.OPERACOES && slug === FASE_SLUGS.AGUARDANDO_CREDITO) {
    chips.push(chipEsteira('Crédito Obra', 'Créd. Obra', boolFlag(f.credito_obra_ok), opts));
  }

  return chips;
}

export function flagsParalelasFromCard(card: Pick<
  KanbanCardBrief,
  | 'acoplamento_concluido'
  | 'credito_terreno_ok'
  | 'contabilidade_ok'
  | 'capital_ok'
  | 'juridico_ok'
  | 'credito_obra_ok'
>): CardParalelasFlags {
  return {
    acoplamento_concluido: card.acoplamento_concluido,
    credito_terreno_ok: card.credito_terreno_ok,
    contabilidade_ok: card.contabilidade_ok,
    capital_ok: card.capital_ok,
    juridico_ok: card.juridico_ok,
    credito_obra_ok: card.credito_obra_ok,
  };
}

type FaseJoin = { nome?: string | null; slug?: string | null } | null;

function unwrapFase(v: FaseJoin | FaseJoin[]): FaseJoin {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/** Enriquece cards do board com vínculo Portfolio (Step One) e filho Jurídico (Portfolio). */
export async function enrichCardsParalelasContext(
  supabase: SupabaseClient,
  kanbanId: string,
  cards: KanbanCardBrief[],
): Promise<KanbanCardBrief[]> {
  if (cards.length === 0) return cards;

  const kid = String(kanbanId ?? '').trim();

  if (kid === KANBAN_IDS.STEP_ONE) {
    const projetoIds = [
      ...new Set(
        cards
          .map((c) => String(c.projeto_id ?? '').trim())
          .filter(Boolean),
      ),
    ];
    if (projetoIds.length === 0) return cards;

    const { data: portfolioRows } = await supabase
      .from('kanban_cards')
      .select('projeto_id, created_at, kanban_fases ( nome, slug )')
      .eq('kanban_id', KANBAN_IDS.PORTFOLIO)
      .in('projeto_id', projetoIds)
      .eq('arquivado', false)
      .eq('concluido', false)
      .order('created_at', { ascending: false });

    const rotuloPorProjeto = new Map<string, string>();
    for (const row of portfolioRows ?? []) {
      const pid = String((row as { projeto_id?: string | null }).projeto_id ?? '').trim();
      if (!pid || rotuloPorProjeto.has(pid)) continue;
      const fase = unwrapFase((row as { kanban_fases?: FaseJoin | FaseJoin[] | null }).kanban_fases ?? null);
      rotuloPorProjeto.set(
        pid,
        rotuloFasePortfolio(String(fase?.nome ?? ''), String(fase?.slug ?? '')),
      );
    }

    return cards.map((c) => {
      const pid = String(c.projeto_id ?? '').trim();
      const rot = pid ? rotuloPorProjeto.get(pid) ?? null : null;
      return rot ? { ...c, portfolio_vinculo_rotulo: rot } : c;
    });
  }

  if (kid === KANBAN_IDS.PORTFOLIO) {
    const cardIds = cards.map((c) => c.id).filter(Boolean);
    if (cardIds.length === 0) return cards;

    const { data: filhos } = await supabase
      .from('kanban_cards')
      .select('origem_card_id')
      .eq('kanban_id', KANBAN_IDS.JURIDICO)
      .in('origem_card_id', cardIds);

    const comFilho = new Set<string>();
    for (const row of filhos ?? []) {
      const oid = String((row as { origem_card_id?: string | null }).origem_card_id ?? '').trim();
      if (oid) comFilho.add(oid);
    }

    return cards.map((c) => ({
      ...c,
      tem_filho_juridico: comFilho.has(c.id),
    }));
  }

  return cards;
}

export function hipotesesOrdemMinima(fases: { slug?: string | null; ordem: number }[]): number | null {
  let min: number | null = null;
  for (const f of fases) {
    const s = String(f.slug ?? '').trim();
    if (!(HIPOTESES_FASE_SLUGS as readonly string[]).includes(s)) continue;
    if (min == null || f.ordem < min) min = f.ordem;
  }
  return min;
}
