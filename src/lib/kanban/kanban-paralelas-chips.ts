import { FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import type { KanbanCardBrief } from '@/components/kanban-shared/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PORTFOLIO_PARALELAS,
  type PortfolioParalelasFlags,
  listarEsteirasParalelasPendentes,
} from '@/lib/kanban/portfolio-paralelas';
import { labelChipAcoplamentoPai, FASE_EXIBICAO_CARD_ARQUIVADO } from '@/lib/kanban/acoplamento-tag-pai';

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
  acoplamento_filho_fase_slug?: string | null;
  acoplamento_filho_fase_nome?: string | null;
  credito_terreno_ok?: boolean;
  contabilidade_ok?: boolean;
  capital_ok?: boolean;
  juridico_ok?: boolean;
  credito_obra_ok?: boolean;
};

export type MontarChipsParalelasInput = {
  kanbanId: string;
  faseSlug: string;
  /** Nome da fase atual (ex.: chip no Funil Acoplamento). */
  faseNome?: string | null;
  faseOrdem?: number;
  /** Ordem mínima da fase Hipóteses no Step One (para “a partir de hipóteses”). */
  hipotesesOrdemMin?: number | null;
  origem?: KanbanCardBrief['origem'];
  flags: CardParalelasFlags;
  portfolioVinculoRotulo?: string | null;
  temFilhoJuridico?: boolean;
  /** Portfolio: existe card filho no Funil Acoplamento (`origem_card_id`). */
  temFilhoAcoplamento?: boolean;
  /** Portfolio: filho Acoplamento existe mas está arquivado (sem filho ativo). */
  filhoAcoplamentoArquivado?: boolean;
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

function portfolioFaseStep4OuAcoplamento(slug: string): boolean {
  const s = String(slug ?? '').trim();
  return s === 'step_4' || s === 'acoplamento';
}

function pushChipAcoplamentoPortfolio(
  chips: ParalelaChip[],
  flags: CardParalelasFlags,
  opts?: MontarChipsParalelasOptions & {
    temFilhoAtivo?: boolean;
    filhoArquivado?: boolean;
  },
): void {
  const filhoArquivado = Boolean(opts?.filhoArquivado) && !opts?.temFilhoAtivo;
  const faseNomeChip = filhoArquivado
    ? null
    : flags.acoplamento_filho_fase_nome;
  chips.push({
    label: labelChipAcoplamentoPai(faseNomeChip, {
      labelsCompletos: opts?.labelsCompletos,
      arquivado: filhoArquivado,
    }),
    concluido: filhoArquivado ? false : boolFlag(flags.acoplamento_concluido),
    variant: 'esteira',
  });
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
    const emStep4OuAcoplamento = portfolioFaseStep4OuAcoplamento(slug);
    const chipAcoplamentoOpts = {
      ...opts,
      temFilhoAtivo: input.temFilhoAcoplamento,
      filhoArquivado: input.filhoAcoplamentoArquivado,
    };
    if (emStep4OuAcoplamento) {
      for (const p of PORTFOLIO_PARALELAS) {
        if (p.flag === 'acoplamento_concluido') {
          pushChipAcoplamentoPortfolio(chips, f, chipAcoplamentoOpts);
          continue;
        }
        chips.push(chipEsteira(p.label, p.labelCurto, boolFlag(f[p.flag]), opts));
      }
    }
    if (slug === FASE_SLUGS.CAPTACAO_CAPITAL) {
      chips.push(chipEsteira('Moní Capital', 'Capital', boolFlag(f.capital_ok), opts));
    }
    if (
      !emStep4OuAcoplamento &&
      (input.temFilhoAcoplamento ||
        input.filhoAcoplamentoArquivado ||
        boolFlag(f.acoplamento_concluido))
    ) {
      pushChipAcoplamentoPortfolio(chips, f, chipAcoplamentoOpts);
    }
    if (input.temFilhoJuridico || boolFlag(f.juridico_ok)) {
      chips.push(chipEsteira('Jurídico', 'Jurídico', boolFlag(f.juridico_ok), opts));
    }
    return chips;
  }

  if (kid === KANBAN_IDS.OPERACOES && slug === FASE_SLUGS.AGUARDANDO_CREDITO) {
    chips.push(chipEsteira('Crédito Obra', 'Créd. Obra', boolFlag(f.credito_obra_ok), opts));
  }

  if (kid === KANBAN_IDS.ACOPLAMENTO) {
    const concluido =
      slug === FASE_SLUGS.ACOPLAMENTO_APROVADO || slug === FASE_SLUGS.ACOPLAMENTO_REPROVADO;
    pushChipAcoplamentoPortfolio(
      chips,
      {
        acoplamento_filho_fase_nome:
          String(input.faseNome ?? '').trim() ||
          String(f.acoplamento_filho_fase_nome ?? '').trim() ||
          null,
        acoplamento_concluido: concluido || boolFlag(f.acoplamento_concluido),
      },
      opts,
    );
    return chips;
  }

  return chips;
}

export function flagsParalelasFromCard(card: Pick<
  KanbanCardBrief,
  | 'acoplamento_concluido'
  | 'acoplamento_filho_fase_slug'
  | 'acoplamento_filho_fase_nome'
  | 'credito_terreno_ok'
  | 'contabilidade_ok'
  | 'capital_ok'
  | 'juridico_ok'
  | 'credito_obra_ok'
>): CardParalelasFlags {
  return {
    acoplamento_concluido: card.acoplamento_concluido,
    acoplamento_filho_fase_slug: card.acoplamento_filho_fase_slug ?? null,
    acoplamento_filho_fase_nome: card.acoplamento_filho_fase_nome ?? null,
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

function registrarFilhoAcoplamentoPai(
  map: Map<string, { nome: string; slug: string }>,
  paiId: string,
  fase: FaseJoin,
): void {
  if (!paiId || map.has(paiId)) return;
  map.set(paiId, {
    nome: String(fase?.nome ?? '').trim(),
    slug: String(fase?.slug ?? '').trim(),
  });
}

/** Cards do Funil Acoplamento ligados por `kanban_card_vinculos` (sem `origem_card_id`). */
async function enrichFilhosAcoplamentoPorVinculos(
  supabase: SupabaseClient,
  cardIds: string[],
  filhoAcoplamentoPorPai: Map<string, { nome: string; slug: string }>,
): Promise<void> {
  if (cardIds.length === 0) return;

  const idsFilter = cardIds.join(',');
  const { data: vinculos } = await supabase
    .from('kanban_card_vinculos')
    .select('card_origem_id, card_destino_id')
    .or(`card_origem_id.in.(${idsFilter}),card_destino_id.in.(${idsFilter})`);

  const cardIdSet = new Set(cardIds);
  const peerToPortfolio = new Map<string, string>();
  const peerIds = new Set<string>();

  for (const row of vinculos ?? []) {
    const orig = String((row as { card_origem_id?: string | null }).card_origem_id ?? '').trim();
    const dest = String((row as { card_destino_id?: string | null }).card_destino_id ?? '').trim();
    if (cardIdSet.has(orig) && !cardIdSet.has(dest)) {
      peerToPortfolio.set(dest, orig);
      peerIds.add(dest);
    } else if (cardIdSet.has(dest) && !cardIdSet.has(orig)) {
      peerToPortfolio.set(orig, dest);
      peerIds.add(orig);
    }
  }

  if (peerIds.size === 0) return;

  const { data: peers } = await supabase
    .from('kanban_cards')
    .select('id, arquivado, kanban_fases ( nome, slug )')
    .in('id', [...peerIds])
    .eq('kanban_id', KANBAN_IDS.ACOPLAMENTO);

  for (const row of peers ?? []) {
    const peerId = String((row as { id?: string | null }).id ?? '').trim();
    const paiId = peerToPortfolio.get(peerId);
    if (!paiId) continue;
    if (Boolean((row as { arquivado?: boolean | null }).arquivado)) continue;
    const fase = unwrapFase(
      (row as { kanban_fases?: FaseJoin | FaseJoin[] | null }).kanban_fases ?? null,
    );
    registrarFilhoAcoplamentoPai(filhoAcoplamentoPorPai, paiId, fase);
  }
}

async function enrichFilhosAcoplamentoArquivadosPorVinculos(
  supabase: SupabaseClient,
  cardIds: string[],
  paisComFilhoArquivado: Set<string>,
): Promise<void> {
  if (cardIds.length === 0) return;

  const idsFilter = cardIds.join(',');
  const { data: vinculos } = await supabase
    .from('kanban_card_vinculos')
    .select('card_origem_id, card_destino_id')
    .or(`card_origem_id.in.(${idsFilter}),card_destino_id.in.(${idsFilter})`);

  const cardIdSet = new Set(cardIds);
  const peerIds = new Set<string>();

  for (const row of vinculos ?? []) {
    const orig = String((row as { card_origem_id?: string | null }).card_origem_id ?? '').trim();
    const dest = String((row as { card_destino_id?: string | null }).card_destino_id ?? '').trim();
    if (cardIdSet.has(orig) && !cardIdSet.has(dest)) peerIds.add(dest);
    else if (cardIdSet.has(dest) && !cardIdSet.has(orig)) peerIds.add(orig);
  }

  if (peerIds.size === 0) return;

  const { data: peers } = await supabase
    .from('kanban_cards')
    .select('id, arquivado')
    .in('id', [...peerIds])
    .eq('kanban_id', KANBAN_IDS.ACOPLAMENTO)
    .eq('arquivado', true);

  const peerToPortfolio = new Map<string, string>();
  for (const row of vinculos ?? []) {
    const orig = String((row as { card_origem_id?: string | null }).card_origem_id ?? '').trim();
    const dest = String((row as { card_destino_id?: string | null }).card_destino_id ?? '').trim();
    if (cardIdSet.has(orig) && !cardIdSet.has(dest)) peerToPortfolio.set(dest, orig);
    else if (cardIdSet.has(dest) && !cardIdSet.has(orig)) peerToPortfolio.set(orig, dest);
  }

  for (const row of peers ?? []) {
    const peerId = String((row as { id?: string | null }).id ?? '').trim();
    const paiId = peerToPortfolio.get(peerId);
    if (paiId) paisComFilhoArquivado.add(paiId);
  }
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

    const [{ data: filhosJuridico }, { data: filhosAcoplamento }, { data: filhosAcoplamentoArq }] =
      await Promise.all([
      supabase
        .from('kanban_cards')
        .select('origem_card_id')
        .eq('kanban_id', KANBAN_IDS.JURIDICO)
        .in('origem_card_id', cardIds),
      supabase
        .from('kanban_cards')
        .select('origem_card_id, kanban_fases ( nome, slug )')
        .eq('kanban_id', KANBAN_IDS.ACOPLAMENTO)
        .eq('arquivado', false)
        .in('origem_card_id', cardIds),
      supabase
        .from('kanban_cards')
        .select('origem_card_id')
        .eq('kanban_id', KANBAN_IDS.ACOPLAMENTO)
        .eq('arquivado', true)
        .in('origem_card_id', cardIds),
    ]);

    const comFilhoJuridico = new Set<string>();
    for (const row of filhosJuridico ?? []) {
      const oid = String((row as { origem_card_id?: string | null }).origem_card_id ?? '').trim();
      if (oid) comFilhoJuridico.add(oid);
    }

    const filhoAcoplamentoPorPai = new Map<
      string,
      { nome: string; slug: string }
    >();
    for (const row of filhosAcoplamento ?? []) {
      const oid = String((row as { origem_card_id?: string | null }).origem_card_id ?? '').trim();
      if (!oid) continue;
      const fase = unwrapFase(
        (row as { kanban_fases?: FaseJoin | FaseJoin[] | null }).kanban_fases ?? null,
      );
      registrarFilhoAcoplamentoPai(filhoAcoplamentoPorPai, oid, fase);
    }

    const paisComFilhoArquivado = new Set<string>();
    for (const row of filhosAcoplamentoArq ?? []) {
      const oid = String((row as { origem_card_id?: string | null }).origem_card_id ?? '').trim();
      if (oid) paisComFilhoArquivado.add(oid);
    }

    await enrichFilhosAcoplamentoPorVinculos(supabase, cardIds, filhoAcoplamentoPorPai);
    await enrichFilhosAcoplamentoArquivadosPorVinculos(supabase, cardIds, paisComFilhoArquivado);

    return cards.map((c) => {
      const filhoAcop = filhoAcoplamentoPorPai.get(c.id);
      const temFilhoAcoplamento = Boolean(filhoAcop);
      const filhoArquivado = paisComFilhoArquivado.has(c.id) && !temFilhoAcoplamento;
      const temJuridico = comFilhoJuridico.has(c.id);
      if (!temFilhoAcoplamento && !temJuridico && !filhoArquivado) return c;

      const patch: Partial<KanbanCardBrief> = {};
      if (temJuridico) patch.tem_filho_juridico = true;
      if (temFilhoAcoplamento) patch.tem_filho_acoplamento = true;
      if (filhoArquivado) patch.filho_acoplamento_arquivado = true;
      if (filhoAcop) {
        if (!String(c.acoplamento_filho_fase_slug ?? '').trim() && filhoAcop.slug) {
          patch.acoplamento_filho_fase_slug = filhoAcop.slug;
        }
        if (!String(c.acoplamento_filho_fase_nome ?? '').trim() && filhoAcop.nome) {
          patch.acoplamento_filho_fase_nome = filhoAcop.nome;
        }
      } else if (filhoArquivado) {
        patch.acoplamento_filho_fase_slug = null;
        patch.acoplamento_filho_fase_nome = FASE_EXIBICAO_CARD_ARQUIVADO;
      }
      return { ...c, ...patch };
    });
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
