import { FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import type { KanbanCardBrief } from '@/components/kanban-shared/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PORTFOLIO_PARALELAS,
  type PortfolioParalelasFlags,
  type PortfolioParalelaFlag,
} from '@/lib/kanban/portfolio-paralelas';
import { PARALELA_KANBAN_CREDITO_TERRENO, nomeFunilParalela } from '@/lib/kanban/kanban-paralelas-cores';
import { labelChipAcoplamentoPai, FASE_EXIBICAO_CARD_ARQUIVADO } from '@/lib/kanban/acoplamento-tag-pai';
import {
  HIPOTESES_FASE_SLUGS,
  HIPOTESES_ORDEM_MIN_PROD,
  isHipotesesFaseSlug,
} from '@/lib/kanban/stepone-fase-slugs';
import { extrairNumeroFranquiaDoTitulo } from '@/lib/kanban/card-sync-group';
import { listarKanbanCardIdsSyncGroup } from '@/lib/kanban/card-sync-group';

export type { PortfolioParalelasFlags };
export { HIPOTESES_FASE_SLUGS };

export type ParalelaChip = {
  label: string;
  concluido: boolean;
  icone?: string;
  /** `vinculo` = chip informativo (ex.: Portfolio no Step One). */
  variant?: 'esteira' | 'vinculo';
  /** Funil filho — cor e tooltip no board. */
  kanbanId?: string;
  funilNome?: string;
  faseNome?: string;
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
  projetos_legais_ok?: boolean | null;
  projetos_locais_ok?: boolean | null;
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
  /** Portfolio: existe card filho no Funil Pré Obra e Obra (`origem_card_id`). */
  temFilhoOperacoes?: boolean;
  /** Portfolio: filho Pré Obra e Obra arquivado (sem filho ativo). */
  filhoOperacoesArquivado?: boolean;
  /** Portfolio: filho Pré Obra e Obra concluído (`kanban_cards.concluido`). */
  operacoesFilhoConcluido?: boolean;
  /** Portfolio: fase atual do filho em Pré Obra e Obra (tag de vínculo). */
  operacoesFilhoFaseRotulo?: string | null;
  /** Portfolio: fase atual do filho Jurídico. */
  juridicoFilhoFaseRotulo?: string | null;
  /** Operações: existe card filho no Funil Projeto Legal (`origem_card_id`). */
  temFilhoProjetoLegal?: boolean;
  /** Operações: filho Projeto Legal arquivado (sem filho ativo). */
  filhoProjetoLegalArquivado?: boolean;
  /** Operações: filho Projeto Legal concluído. */
  projetoLegalFilhoConcluido?: boolean;
  /** Operações: fase atual do filho Projeto Legal. */
  projetoLegalFilhoFase?: string | null;
  /** Operações: existe card filho no Funil Cash Me (`origem_card_id`). */
  temFilhoCreditoObra?: boolean;
  /** Operações: filho Cash Me arquivado (sem filho ativo). */
  filhoCreditoObraArquivado?: boolean;
  /** Operações: fase atual do filho Cash Me. */
  creditoObraFilhoFase?: string | null;
  /** Operações: existe card filho no Funil Projetos Locais. */
  temFilhoProjetosLocais?: boolean;
  /** Operações: filho Projetos Locais arquivado (sem filho ativo). */
  filhoProjetosLocaisArquivado?: boolean;
  /** Operações: fase atual do filho Projetos Locais. */
  projetosLocaisFilhoFase?: string | null;
};

export type MontarChipsParalelasOptions = {
  /** Modal: labels completos; board: abreviações onde existem. */
  labelsCompletos?: boolean;
};

function boolFlag(v: boolean | null | undefined): boolean {
  return Boolean(v);
}

function flagParalelaDefinida(v: boolean | null | undefined): boolean {
  return v !== null && v !== undefined;
}

/** Ordem fixa das bolinhas no card fechado do Funil Operações. */
export const OPERACOES_CHIPS_ORDEM: readonly string[] = [
  KANBAN_IDS.ACOPLAMENTO,
  KANBAN_IDS.PROJETO_LEGAL,
  KANBAN_IDS.PROJETOS_LOCAIS,
  KANBAN_IDS.CREDITO_OBRA,
];

function ordenarChipsOperacoesParalelas(chips: ParalelaChip[]): ParalelaChip[] {
  const ordem = new Map(OPERACOES_CHIPS_ORDEM.map((id, i) => [id, i]));
  return [...chips].sort((a, b) => {
    const ia = ordem.get(String(a.kanbanId ?? '')) ?? 999;
    const ib = ordem.get(String(b.kanbanId ?? '')) ?? 999;
    return ia - ib;
  });
}

function filtroOrTituloFranquia(numeros: string[]): string {
  return numeros.map((n) => `titulo.ilike.${n}%`).join(',');
}

function faseParalelaFallback(concluido: boolean, fase?: string | null): string {
  const f = String(fase ?? '').trim();
  if (f) return f;
  return concluido ? 'Concluído' : 'Em andamento';
}

const FLAG_KANBAN_ID: Record<PortfolioParalelaFlag, string> = {
  acoplamento_concluido: KANBAN_IDS.ACOPLAMENTO,
  credito_terreno_ok: PARALELA_KANBAN_CREDITO_TERRENO,
  contabilidade_ok: KANBAN_IDS.CONTABILIDADE,
  juridico_ok: KANBAN_IDS.JURIDICO,
  capital_ok: KANBAN_IDS.MONI_CAPITAL,
};

function chipEsteira(
  kanbanId: string,
  funilNome: string,
  faseNome: string | null | undefined,
  label: string,
  labelCurto: string,
  concluido: boolean,
  opts?: MontarChipsParalelasOptions,
): ParalelaChip {
  return {
    label: opts?.labelsCompletos ? label : labelCurto,
    concluido,
    variant: 'esteira',
    kanbanId,
    funilNome,
    faseNome: faseParalelaFallback(concluido, faseNome),
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
  const concluido = filhoArquivado ? false : boolFlag(flags.acoplamento_concluido);
  const faseExib = filhoArquivado
    ? FASE_EXIBICAO_CARD_ARQUIVADO
    : faseParalelaFallback(concluido, faseNomeChip);
  chips.push({
    label: labelChipAcoplamentoPai(faseNomeChip, {
      labelsCompletos: opts?.labelsCompletos,
      arquivado: filhoArquivado,
    }),
    concluido,
    variant: 'esteira',
    kanbanId: KANBAN_IDS.ACOPLAMENTO,
    funilNome: nomeFunilParalela(KANBAN_IDS.ACOPLAMENTO),
    faseNome: faseExib,
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

function rotuloFaseOperacoesVinculo(nome: string, slug: string): string {
  const n = String(nome ?? '').trim();
  if (n) return n;
  const s = String(slug ?? '').trim();
  if (s === 'planialtimetrico') return 'Planialtimétrico';
  return s || '—';
}

export function stepOneExibeChipsVinculo(
  faseSlug: string,
  faseOrdem: number,
  hipotesesOrdemMin: number | null | undefined,
): boolean {
  const s = String(faseSlug ?? '').trim();
  if (isHipotesesFaseSlug(s)) return true;
  const min = hipotesesOrdemMin;
  if (min != null && Number.isFinite(min) && faseOrdem >= min) return true;
  return false;
}

/** Monta chips conforme kanban + fase; vazio = não renderizar linha. */
export function montarChipsParalelas(
  input: MontarChipsParalelasInput,
  opts?: MontarChipsParalelasOptions,
): ParalelaChip[] {
  const kid = String(input.kanbanId ?? '').trim();
  /** Cards legado do hybrid view ainda exibem bolinhas quando o enrich populou flags. */
  const origemLegadoSemChips =
    input.origem === 'legado' &&
    kid !== KANBAN_IDS.OPERACOES &&
    kid !== KANBAN_IDS.PORTFOLIO &&
    kid !== KANBAN_IDS.STEP_ONE &&
    kid !== KANBAN_IDS.LOTEADORES;
  if (origemLegadoSemChips) return [];
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
      kanbanId: KANBAN_IDS.PORTFOLIO,
      funilNome: nomeFunilParalela(KANBAN_IDS.PORTFOLIO),
      faseNome: rot,
    });
    return chips;
  }

  if (kid === KANBAN_IDS.LOTEADORES) {
    const chipAcoplamentoOpts = {
      ...opts,
      temFilhoAtivo: input.temFilhoAcoplamento,
      filhoArquivado: input.filhoAcoplamentoArquivado,
    };
    const emAcoplamento =
      slug === FASE_SLUGS.LOTEADORES_ACOPLAMENTO ||
      input.temFilhoAcoplamento ||
      input.filhoAcoplamentoArquivado ||
      boolFlag(f.acoplamento_concluido);
    if (emAcoplamento) {
      pushChipAcoplamentoPortfolio(chips, f, chipAcoplamentoOpts);
    }
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
        const kanbanId = FLAG_KANBAN_ID[p.flag];
        chips.push(
          chipEsteira(
            kanbanId,
            nomeFunilParalela(kanbanId, p.label),
            null,
            p.label,
            p.labelCurto,
            boolFlag(f[p.flag]),
            opts,
          ),
        );
      }
    }
    if (slug === FASE_SLUGS.CAPTACAO_CAPITAL) {
      chips.push(
        chipEsteira(
          KANBAN_IDS.MONI_CAPITAL,
          nomeFunilParalela(KANBAN_IDS.MONI_CAPITAL),
          null,
          'Divify',
          'Divify',
          boolFlag(f.capital_ok),
          opts,
        ),
      );
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
      chips.push(
        chipEsteira(
          KANBAN_IDS.JURIDICO,
          nomeFunilParalela(KANBAN_IDS.JURIDICO),
          input.juridicoFilhoFaseRotulo,
          'Jurídico',
          'Jurídico',
          boolFlag(f.juridico_ok),
          opts,
        ),
      );
    }
    const emPassagemWayser = slug === FASE_SLUGS.PASSAGEM_WAYSER;
    const temFilhoOperacoes = Boolean(input.temFilhoOperacoes);
    const filhoOperacoesArquivado = Boolean(input.filhoOperacoesArquivado) && !temFilhoOperacoes;
    if (emPassagemWayser || temFilhoOperacoes || filhoOperacoesArquivado) {
      const rotuloFase = filhoOperacoesArquivado
        ? FASE_EXIBICAO_CARD_ARQUIVADO
        : String(input.operacoesFilhoFaseRotulo ?? '').trim() || 'Planialtimétrico';
      chips.push({
        label: opts?.labelsCompletos
          ? `Funil Pré Obra e Obra: ${rotuloFase}`
          : `Pré Obra: ${rotuloFase}`,
        concluido: temFilhoOperacoes && Boolean(input.operacoesFilhoConcluido),
        icone: '🔗',
        variant: 'vinculo',
        kanbanId: KANBAN_IDS.OPERACOES,
        funilNome: nomeFunilParalela(KANBAN_IDS.OPERACOES),
        faseNome: rotuloFase,
      });
    }
    return chips;
  }

  if (kid === KANBAN_IDS.OPERACOES) {
    const chipMap = new Map<string, ParalelaChip>();

    const temFilhoAcoplamento = Boolean(input.temFilhoAcoplamento);
    const filhoAcoplamentoArquivado =
      Boolean(input.filhoAcoplamentoArquivado) && !temFilhoAcoplamento;
    if (temFilhoAcoplamento || filhoAcoplamentoArquivado || boolFlag(f.acoplamento_concluido)) {
      const acoplChips: ParalelaChip[] = [];
      pushChipAcoplamentoPortfolio(acoplChips, f, {
        ...opts,
        temFilhoAtivo: temFilhoAcoplamento,
        filhoArquivado: filhoAcoplamentoArquivado,
      });
      const acopl = acoplChips[0];
      if (acopl) chipMap.set(KANBAN_IDS.ACOPLAMENTO, acopl);
    }

    const temFilhoProjetoLegal = Boolean(input.temFilhoProjetoLegal);
    const filhoProjetoLegalArquivado =
      Boolean(input.filhoProjetoLegalArquivado) && !temFilhoProjetoLegal;
    if (temFilhoProjetoLegal || filhoProjetoLegalArquivado) {
      const faseNomeChip = filhoProjetoLegalArquivado
        ? null
        : String(input.projetoLegalFilhoFase ?? '').trim() || null;
      chipMap.set(
        KANBAN_IDS.PROJETO_LEGAL,
        chipEsteira(
          KANBAN_IDS.PROJETO_LEGAL,
          nomeFunilParalela(KANBAN_IDS.PROJETO_LEGAL),
          filhoProjetoLegalArquivado ? FASE_EXIBICAO_CARD_ARQUIVADO : faseNomeChip,
          'Projeto Legal',
          'Projeto Legal',
          temFilhoProjetoLegal && Boolean(input.projetoLegalFilhoConcluido ?? temFilhoProjetoLegal),
          opts,
        ),
      );
    }

    const temFilhoProjetosLocais = Boolean(input.temFilhoProjetosLocais);
    const filhoProjetosLocaisArquivado =
      Boolean(input.filhoProjetosLocaisArquivado) && !temFilhoProjetosLocais;
    if (
      temFilhoProjetosLocais ||
      filhoProjetosLocaisArquivado ||
      flagParalelaDefinida(f.projetos_locais_ok)
    ) {
      const faseNomeChip = filhoProjetosLocaisArquivado
        ? FASE_EXIBICAO_CARD_ARQUIVADO
        : String(input.projetosLocaisFilhoFase ?? '').trim() || null;
      chipMap.set(
        KANBAN_IDS.PROJETOS_LOCAIS,
        chipEsteira(
          KANBAN_IDS.PROJETOS_LOCAIS,
          nomeFunilParalela(KANBAN_IDS.PROJETOS_LOCAIS),
          faseNomeChip,
          'Projetos Locais',
          'Projetos Locais',
          boolFlag(f.projetos_locais_ok) || temFilhoProjetosLocais,
          opts,
        ),
      );
    }

    const temFilhoCreditoObra = Boolean(input.temFilhoCreditoObra);
    const filhoCreditoObraArquivado =
      Boolean(input.filhoCreditoObraArquivado) && !temFilhoCreditoObra;
    if (temFilhoCreditoObra || filhoCreditoObraArquivado || boolFlag(f.credito_obra_ok)) {
      const faseNomeChip = filhoCreditoObraArquivado
        ? FASE_EXIBICAO_CARD_ARQUIVADO
        : String(input.creditoObraFilhoFase ?? '').trim() || null;
      chipMap.set(
        KANBAN_IDS.CREDITO_OBRA,
        chipEsteira(
          KANBAN_IDS.CREDITO_OBRA,
          nomeFunilParalela(KANBAN_IDS.CREDITO_OBRA),
          faseNomeChip,
          'Cash Me',
          'Cash Me',
          boolFlag(f.credito_obra_ok),
          opts,
        ),
      );
    }

    return ordenarChipsOperacoesParalelas(
      OPERACOES_CHIPS_ORDEM.map((id) => chipMap.get(id)).filter(Boolean) as ParalelaChip[],
    );
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
  | 'projetos_legais_ok'
  | 'projetos_locais_ok'
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
    projetos_legais_ok: card.projetos_legais_ok ?? null,
    projetos_locais_ok: card.projetos_locais_ok ?? null,
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

type CadeiaOrigemBatch = {
  /** cardId do board → ids de todos os ancestrais (`origem_card_id`). */
  ancestraisPorBoardCard: Map<string, Set<string>>;
  /** Todos os ids usados como `origem_card_id` na busca de filhos (board + ancestrais). */
  origemIdsConsulta: string[];
};

/** Sobe `origem_card_id` em lote para incluir filhos ligados a ancestrais (ex.: stub Portfolio). */
async function coletarCadeiaOrigemAncestraisBatch(
  supabase: SupabaseClient,
  boardCardIds: string[],
): Promise<CadeiaOrigemBatch> {
  const boardSet = new Set(boardCardIds.filter(Boolean));
  const paiPorFilho = new Map<string, string>();
  const allIds = new Set(boardSet);
  let frontier = [...boardSet];

  while (frontier.length > 0) {
    const { data } = await supabase
      .from('kanban_cards')
      .select('id, origem_card_id')
      .in('id', frontier);
    const next: string[] = [];
    for (const row of data ?? []) {
      const id = String((row as { id?: string | null }).id ?? '').trim();
      const pai = String((row as { origem_card_id?: string | null }).origem_card_id ?? '').trim();
      if (!id || !pai) continue;
      paiPorFilho.set(id, pai);
      if (!allIds.has(pai)) {
        allIds.add(pai);
        next.push(pai);
      }
    }
    frontier = next;
  }

  const ancestraisPorBoardCard = new Map<string, Set<string>>();
  for (const boardId of boardSet) {
    const anc = new Set<string>();
    let cur = boardId;
    for (let depth = 0; depth < 32; depth++) {
      const pai = paiPorFilho.get(cur);
      if (!pai) break;
      anc.add(pai);
      cur = pai;
    }
    ancestraisPorBoardCard.set(boardId, anc);
  }

  return { ancestraisPorBoardCard, origemIdsConsulta: [...allIds] };
}

function registrarPeerOrigemConsulta(
  boardCards: KanbanCardBrief[],
  boardId: string,
  peerId: string,
  ancestraisPorBoardCard: Map<string, Set<string>>,
  allIds: Set<string>,
): void {
  const pid = String(peerId ?? '').trim();
  const bid = String(boardId ?? '').trim();
  if (!pid || !bid || pid === bid) return;
  allIds.add(pid);
  const anc = ancestraisPorBoardCard.get(bid) ?? new Set<string>();
  anc.add(pid);
  ancestraisPorBoardCard.set(bid, anc);
}

/** Cards com mesmo FK#### no título (ex.: Portfolio pai do Acoplamento sem origem_card_id). */
async function expandirConsultaPorNumeroFranquiaTitulo(
  supabase: SupabaseClient,
  boardCards: KanbanCardBrief[],
  ancestraisPorBoardCard: Map<string, Set<string>>,
  allIds: Set<string>,
): Promise<void> {
  const numerosPorBoard = new Map<string, string>();
  for (const c of boardCards) {
    const boardId = String(c.id ?? '').trim();
    const num = extrairNumeroFranquiaDoTitulo(String(c.titulo ?? ''));
    if (boardId && num) numerosPorBoard.set(boardId, num);
  }
  const numeros = [...new Set(numerosPorBoard.values())];
  if (numeros.length === 0) return;

  const { data: peers } = await supabase
    .from('kanban_cards')
    .select('id, titulo')
    .or(filtroOrTituloFranquia(numeros))
    .limit(200);

  for (const row of peers ?? []) {
    const peerId = String((row as { id?: string | null }).id ?? '').trim();
    const peerNum = extrairNumeroFranquiaDoTitulo(
      String((row as { titulo?: string | null }).titulo ?? ''),
    );
    if (!peerId || !peerNum) continue;
    for (const [boardId, num] of numerosPorBoard) {
      if (num === peerNum) {
        registrarPeerOrigemConsulta(boardCards, boardId, peerId, ancestraisPorBoardCard, allIds);
      }
    }
  }
}

/**
 * Operações: sync group (vínculos + processo) + FK#### + cadeia origem_card_id.
 * Cards em em_obra costumam ter origem_card_id/projeto_id nulos — filhos ficam no Portfolio ou Cash Me.
 */
async function coletarOrigemConsultaOperacoesBatch(
  supabase: SupabaseClient,
  boardCards: KanbanCardBrief[],
): Promise<CadeiaOrigemBatch> {
  const boardCardIds = boardCards.map((c) => c.id).filter(Boolean);
  const cadeia = await coletarCadeiaOrigemAncestraisBatch(supabase, boardCardIds);
  const ancestraisPorBoardCard = cadeia.ancestraisPorBoardCard;
  const allIds = new Set(cadeia.origemIdsConsulta);

  await Promise.all(
    boardCardIds.map(async (boardId) => {
      const groupIds = await listarKanbanCardIdsSyncGroup(supabase, boardId);
      for (const gid of groupIds) {
        registrarPeerOrigemConsulta(
          boardCards,
          boardId,
          gid,
          ancestraisPorBoardCard,
          allIds,
        );
      }
    }),
  );

  await expandirConsultaPorNumeroFranquiaTitulo(
    supabase,
    boardCards,
    ancestraisPorBoardCard,
    allIds,
  );

  return { ancestraisPorBoardCard, origemIdsConsulta: [...allIds] };
}

type EnrichOperacoesFilhosMaps = {
  filhoAcoplamentoPorPai: Map<string, { nome: string; slug: string }>;
  paisComFilhoAcoplamentoArquivado: Set<string>;
  filhoProjetoLegalPorPai: Map<string, string>;
  filhoProjetoLegalConcluidoPorPai: Map<string, boolean>;
  paisComFilhoProjetoLegalArquivado: Set<string>;
  filhoProjetosLocaisPorPai: Map<string, string>;
  paisComFilhoProjetosLocaisArquivado: Set<string>;
  filhoCreditoObraPorPai: Map<string, string>;
  paisComFilhoCreditoObraArquivado: Set<string>;
};

/**
 * Fallback robusto: filhos com mesmo FK#### no título (sem depender de origem_card_id).
 * Cobre Em Obra / Aguardando Crédito quando filho aponta para Portfolio ou sync group falhou.
 */
async function enrichFilhosOperacoesPorTituloFranquia(
  supabase: SupabaseClient,
  boardCards: KanbanCardBrief[],
  maps: EnrichOperacoesFilhosMaps,
): Promise<void> {
  const numerosPorBoard = new Map<string, string>();
  for (const c of boardCards) {
    const boardId = String(c.id ?? '').trim();
    const num = extrairNumeroFranquiaDoTitulo(String(c.titulo ?? ''));
    if (boardId && num) numerosPorBoard.set(boardId, num);
  }
  const numeros = [...new Set(numerosPorBoard.values())];
  if (numeros.length === 0) return;

  const tituloFilter = filtroOrTituloFranquia(numeros);
  const esteiras: { kanbanId: string; kind: keyof EnrichOperacoesFilhosMaps }[] = [
    { kanbanId: KANBAN_IDS.ACOPLAMENTO, kind: 'filhoAcoplamentoPorPai' },
    { kanbanId: KANBAN_IDS.PROJETO_LEGAL, kind: 'filhoProjetoLegalPorPai' },
    { kanbanId: KANBAN_IDS.PROJETOS_LOCAIS, kind: 'filhoProjetosLocaisPorPai' },
    { kanbanId: KANBAN_IDS.CREDITO_OBRA, kind: 'filhoCreditoObraPorPai' },
  ];

  await Promise.all(
    esteiras.map(async ({ kanbanId, kind }) => {
      const { data: filhos } = await supabase
        .from('kanban_cards')
        .select('id, titulo, arquivado, concluido, kanban_fases ( nome, slug )')
        .eq('kanban_id', kanbanId)
        .or(tituloFilter);

      for (const row of filhos ?? []) {
        const fkNum = extrairNumeroFranquiaDoTitulo(
          String((row as { titulo?: string | null }).titulo ?? ''),
        );
        if (!fkNum) continue;
        const arquivado = Boolean((row as { arquivado?: boolean | null }).arquivado);
        const fase = unwrapFase(
          (row as { kanban_fases?: FaseJoin | FaseJoin[] | null }).kanban_fases ?? null,
        );

        for (const [boardId, num] of numerosPorBoard) {
          if (num !== fkNum) continue;

          if (kind === 'filhoAcoplamentoPorPai') {
            if (arquivado) {
              maps.paisComFilhoAcoplamentoArquivado.add(boardId);
            } else {
              registrarFilhoAcoplamentoPai(maps.filhoAcoplamentoPorPai, boardId, fase);
            }
            continue;
          }

          if (kind === 'filhoProjetoLegalPorPai') {
            if (arquivado) {
              maps.paisComFilhoProjetoLegalArquivado.add(boardId);
            } else {
              const faseNome = String(fase?.nome ?? '').trim();
              if (faseNome && !maps.filhoProjetoLegalPorPai.has(boardId)) {
                maps.filhoProjetoLegalPorPai.set(boardId, faseNome);
              }
              if (!maps.filhoProjetoLegalConcluidoPorPai.has(boardId)) {
                maps.filhoProjetoLegalConcluidoPorPai.set(
                  boardId,
                  (row as { concluido?: boolean | null }).concluido === true,
                );
              }
            }
            continue;
          }

          if (kind === 'filhoProjetosLocaisPorPai') {
            if (arquivado) {
              maps.paisComFilhoProjetosLocaisArquivado.add(boardId);
            } else if (!maps.filhoProjetosLocaisPorPai.has(boardId)) {
              maps.filhoProjetosLocaisPorPai.set(boardId, String(fase?.nome ?? '').trim());
            }
            continue;
          }

          if (kind === 'filhoCreditoObraPorPai') {
            if (arquivado) {
              maps.paisComFilhoCreditoObraArquivado.add(boardId);
            } else if (!maps.filhoCreditoObraPorPai.has(boardId)) {
              maps.filhoCreditoObraPorPai.set(boardId, String(fase?.nome ?? '').trim());
            }
          }
        }
      }
    }),
  );
}

function boardCardsDoFilhoOrigem(
  origemCardId: string,
  boardCardIds: string[],
  ancestraisPorBoardCard: Map<string, Set<string>>,
): string[] {
  const oid = String(origemCardId ?? '').trim();
  if (!oid) return [];
  const out: string[] = [];
  for (const boardId of boardCardIds) {
    if (boardId === oid) {
      out.push(boardId);
      continue;
    }
    if (ancestraisPorBoardCard.get(boardId)?.has(oid)) out.push(boardId);
  }
  return out;
}

type PeerVinculoMap = Map<string, string>;

/** Pares peerId → idConsultado para vínculos onde um lado está em `consultaIds`. */
function mapearPeersVinculados(consultaIds: string[], vinculos: unknown[]): PeerVinculoMap {
  const consultaSet = new Set(consultaIds.filter(Boolean));
  const peerToConsulta = new Map<string, string>();
  for (const row of vinculos ?? []) {
    const orig = String((row as { card_origem_id?: string | null }).card_origem_id ?? '').trim();
    const dest = String((row as { card_destino_id?: string | null }).card_destino_id ?? '').trim();
    if (consultaSet.has(orig) && !consultaSet.has(dest)) peerToConsulta.set(dest, orig);
    else if (consultaSet.has(dest) && !consultaSet.has(orig)) peerToConsulta.set(orig, dest);
  }
  return peerToConsulta;
}

/** Filhos de esteira paralela ligados por `kanban_card_vinculos` (fallback sem `origem_card_id`). */
async function enrichFilhosEsteiraPorVinculos(
  supabase: SupabaseClient,
  boardCardIds: string[],
  consultaIds: string[],
  kanbanIdFilho: string,
  ancestraisPorBoardCard: Map<string, Set<string>>,
  onFilhoAtivo: (boardId: string, fase: FaseJoin) => void,
): Promise<void> {
  if (consultaIds.length === 0) return;

  const idsFilter = consultaIds.join(',');
  const { data: vinculos } = await supabase
    .from('kanban_card_vinculos')
    .select('card_origem_id, card_destino_id')
    .or(`card_origem_id.in.(${idsFilter}),card_destino_id.in.(${idsFilter})`);

  const peerToConsulta = mapearPeersVinculados(consultaIds, vinculos ?? []);
  if (peerToConsulta.size === 0) return;

  const { data: peers } = await supabase
    .from('kanban_cards')
    .select('id, arquivado, kanban_fases ( nome, slug )')
    .in('id', [...peerToConsulta.keys()])
    .eq('kanban_id', kanbanIdFilho);

  for (const row of peers ?? []) {
    const peerId = String((row as { id?: string | null }).id ?? '').trim();
    const consultaId = peerToConsulta.get(peerId);
    if (!consultaId) continue;
    if (Boolean((row as { arquivado?: boolean | null }).arquivado)) continue;
    const fase = unwrapFase(
      (row as { kanban_fases?: FaseJoin | FaseJoin[] | null }).kanban_fases ?? null,
    );
    for (const boardId of boardCardsDoFilhoOrigem(consultaId, boardCardIds, ancestraisPorBoardCard)) {
      onFilhoAtivo(boardId, fase);
    }
  }
}

async function enrichFilhosEsteiraArquivadosPorVinculos(
  supabase: SupabaseClient,
  boardCardIds: string[],
  consultaIds: string[],
  kanbanIdFilho: string,
  ancestraisPorBoardCard: Map<string, Set<string>>,
  paisComFilhoArquivado: Set<string>,
): Promise<void> {
  if (consultaIds.length === 0) return;

  const idsFilter = consultaIds.join(',');
  const { data: vinculos } = await supabase
    .from('kanban_card_vinculos')
    .select('card_origem_id, card_destino_id')
    .or(`card_origem_id.in.(${idsFilter}),card_destino_id.in.(${idsFilter})`);

  const peerToConsulta = mapearPeersVinculados(consultaIds, vinculos ?? []);
  if (peerToConsulta.size === 0) return;

  const { data: peers } = await supabase
    .from('kanban_cards')
    .select('id, arquivado')
    .in('id', [...peerToConsulta.keys()])
    .eq('kanban_id', kanbanIdFilho)
    .eq('arquivado', true);

  for (const row of peers ?? []) {
    const peerId = String((row as { id?: string | null }).id ?? '').trim();
    const consultaId = peerToConsulta.get(peerId);
    if (!consultaId) continue;
    for (const boardId of boardCardsDoFilhoOrigem(consultaId, boardCardIds, ancestraisPorBoardCard)) {
      paisComFilhoArquivado.add(boardId);
    }
  }
}

async function enrichFilhosAcoplamentoPorVinculos(
  supabase: SupabaseClient,
  boardCardIds: string[],
  consultaIds: string[],
  ancestraisPorBoardCard: Map<string, Set<string>>,
  filhoAcoplamentoPorPai: Map<string, { nome: string; slug: string }>,
): Promise<void> {
  await enrichFilhosEsteiraPorVinculos(
    supabase,
    boardCardIds,
    consultaIds,
    KANBAN_IDS.ACOPLAMENTO,
    ancestraisPorBoardCard,
    (boardId, fase) => registrarFilhoAcoplamentoPai(filhoAcoplamentoPorPai, boardId, fase),
  );
}

async function enrichFilhosAcoplamentoArquivadosPorVinculos(
  supabase: SupabaseClient,
  boardCardIds: string[],
  consultaIds: string[],
  ancestraisPorBoardCard: Map<string, Set<string>>,
  paisComFilhoArquivado: Set<string>,
): Promise<void> {
  await enrichFilhosEsteiraArquivadosPorVinculos(
    supabase,
    boardCardIds,
    consultaIds,
    KANBAN_IDS.ACOPLAMENTO,
    ancestraisPorBoardCard,
    paisComFilhoArquivado,
  );
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

    const [
      { data: filhosJuridico },
      { data: filhosAcoplamento },
      { data: filhosAcoplamentoArq },
      { data: filhosOperacoes },
      { data: filhosOperacoesArq },
    ] = await Promise.all([
      supabase
        .from('kanban_cards')
        .select('origem_card_id, concluido, kanban_fases ( nome, slug )')
        .eq('kanban_id', KANBAN_IDS.JURIDICO)
        .eq('arquivado', false)
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
      supabase
        .from('kanban_cards')
        .select('origem_card_id, concluido, kanban_fases ( nome, slug )')
        .eq('kanban_id', KANBAN_IDS.OPERACOES)
        .eq('arquivado', false)
        .in('origem_card_id', cardIds),
      supabase
        .from('kanban_cards')
        .select('origem_card_id')
        .eq('kanban_id', KANBAN_IDS.OPERACOES)
        .eq('arquivado', true)
        .in('origem_card_id', cardIds),
    ]);

    const comFilhoJuridico = new Set<string>();
    const filhoJuridicoPorPai = new Map<string, string>();
    for (const row of filhosJuridico ?? []) {
      const oid = String((row as { origem_card_id?: string | null }).origem_card_id ?? '').trim();
      if (!oid) continue;
      comFilhoJuridico.add(oid);
      if (!filhoJuridicoPorPai.has(oid)) {
        const fase = unwrapFase(
          (row as { kanban_fases?: FaseJoin | FaseJoin[] | null }).kanban_fases ?? null,
        );
        const faseNome = String(fase?.nome ?? '').trim();
        if (faseNome) filhoJuridicoPorPai.set(oid, faseNome);
      }
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

    const filhoOperacoesPorPai = new Map<string, string>();
    const filhoOperacoesConcluidoPorPai = new Map<string, boolean>();
    for (const row of filhosOperacoes ?? []) {
      const oid = String((row as { origem_card_id?: string | null }).origem_card_id ?? '').trim();
      if (!oid) continue;
      const fase = unwrapFase(
        (row as { kanban_fases?: FaseJoin | FaseJoin[] | null }).kanban_fases ?? null,
      );
      filhoOperacoesPorPai.set(
        oid,
        rotuloFaseOperacoesVinculo(String(fase?.nome ?? ''), String(fase?.slug ?? '')),
      );
      if (!filhoOperacoesConcluidoPorPai.has(oid)) {
        filhoOperacoesConcluidoPorPai.set(oid, (row as { concluido?: boolean | null }).concluido === true);
      }
    }

    const paisComFilhoOperacoesArquivado = new Set<string>();
    for (const row of filhosOperacoesArq ?? []) {
      const oid = String((row as { origem_card_id?: string | null }).origem_card_id ?? '').trim();
      if (oid) paisComFilhoOperacoesArquivado.add(oid);
    }

    await enrichFilhosAcoplamentoPorVinculos(
      supabase,
      cardIds,
      cardIds,
      new Map(cardIds.map((id) => [id, new Set<string>()])),
      filhoAcoplamentoPorPai,
    );
    await enrichFilhosAcoplamentoArquivadosPorVinculos(
      supabase,
      cardIds,
      cardIds,
      new Map(cardIds.map((id) => [id, new Set<string>()])),
      paisComFilhoArquivado,
    );

    return cards.map((c) => {
      const filhoAcop = filhoAcoplamentoPorPai.get(c.id);
      const temFilhoAcoplamento = Boolean(filhoAcop);
      const filhoArquivado = paisComFilhoArquivado.has(c.id) && !temFilhoAcoplamento;
      const temJuridico = comFilhoJuridico.has(c.id);
      const temFilhoOperacoes = filhoOperacoesPorPai.has(c.id);
      const filhoOperacoesArquivado =
        paisComFilhoOperacoesArquivado.has(c.id) && !temFilhoOperacoes;
      if (
        !temFilhoAcoplamento &&
        !temJuridico &&
        !filhoArquivado &&
        !temFilhoOperacoes &&
        !filhoOperacoesArquivado
      ) {
        return c;
      }

      const patch: Partial<KanbanCardBrief> = {};
      if (temJuridico) {
        patch.tem_filho_juridico = true;
        const faseJur = filhoJuridicoPorPai.get(c.id);
        if (faseJur) patch.juridico_filho_fase_nome = faseJur;
      }
      if (temFilhoAcoplamento) patch.tem_filho_acoplamento = true;
      if (filhoArquivado) patch.filho_acoplamento_arquivado = true;
      if (temFilhoOperacoes) {
        patch.tem_filho_operacoes = true;
        patch.operacoes_filho_fase_rotulo = filhoOperacoesPorPai.get(c.id) ?? null;
        patch.operacoes_filho_concluido = filhoOperacoesConcluidoPorPai.get(c.id) === true;
      }
      if (filhoOperacoesArquivado) patch.filho_operacoes_arquivado = true;
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

  if (kid === KANBAN_IDS.OPERACOES) {
    const cardIds = cards.map((c) => c.id).filter(Boolean);
    if (cardIds.length === 0) return cards;

    const { ancestraisPorBoardCard, origemIdsConsulta } =
      await coletarOrigemConsultaOperacoesBatch(supabase, cards);

    const [
      { data: filhosProjetoLegal },
      { data: filhosProjetoLegalArq },
      { data: filhosAcoplamento },
      { data: filhosAcoplamentoArq },
      { data: filhosCreditoObra },
      { data: filhosCreditoObraArq },
      { data: filhosProjetosLocais },
      { data: filhosProjetosLocaisArq },
    ] = await Promise.all([
      supabase
        .from('kanban_cards')
        .select('origem_card_id, concluido, kanban_fases ( nome, slug )')
        .eq('kanban_id', KANBAN_IDS.PROJETO_LEGAL)
        .eq('arquivado', false)
        .in('origem_card_id', origemIdsConsulta),
      supabase
        .from('kanban_cards')
        .select('origem_card_id')
        .eq('kanban_id', KANBAN_IDS.PROJETO_LEGAL)
        .eq('arquivado', true)
        .in('origem_card_id', origemIdsConsulta),
      supabase
        .from('kanban_cards')
        .select('origem_card_id, kanban_fases ( nome, slug )')
        .eq('kanban_id', KANBAN_IDS.ACOPLAMENTO)
        .eq('arquivado', false)
        .in('origem_card_id', origemIdsConsulta),
      supabase
        .from('kanban_cards')
        .select('origem_card_id')
        .eq('kanban_id', KANBAN_IDS.ACOPLAMENTO)
        .eq('arquivado', true)
        .in('origem_card_id', origemIdsConsulta),
      supabase
        .from('kanban_cards')
        .select('origem_card_id, kanban_fases ( nome, slug )')
        .eq('kanban_id', KANBAN_IDS.CREDITO_OBRA)
        .eq('arquivado', false)
        .in('origem_card_id', origemIdsConsulta),
      supabase
        .from('kanban_cards')
        .select('origem_card_id')
        .eq('kanban_id', KANBAN_IDS.CREDITO_OBRA)
        .eq('arquivado', true)
        .in('origem_card_id', origemIdsConsulta),
      supabase
        .from('kanban_cards')
        .select('origem_card_id, kanban_fases ( nome, slug )')
        .eq('kanban_id', KANBAN_IDS.PROJETOS_LOCAIS)
        .eq('arquivado', false)
        .in('origem_card_id', origemIdsConsulta),
      supabase
        .from('kanban_cards')
        .select('origem_card_id')
        .eq('kanban_id', KANBAN_IDS.PROJETOS_LOCAIS)
        .eq('arquivado', true)
        .in('origem_card_id', origemIdsConsulta),
    ]);

    const filhoProjetoLegalPorPai = new Map<string, string>();
    const filhoProjetoLegalConcluidoPorPai = new Map<string, boolean>();
    for (const row of filhosProjetoLegal ?? []) {
      const oid = String((row as { origem_card_id?: string | null }).origem_card_id ?? '').trim();
      if (!oid) continue;
      for (const boardId of boardCardsDoFilhoOrigem(oid, cardIds, ancestraisPorBoardCard)) {
        const fase = unwrapFase(
          (row as { kanban_fases?: FaseJoin | FaseJoin[] | null }).kanban_fases ?? null,
        );
        const faseNome = String(fase?.nome ?? '').trim();
        if (faseNome && !filhoProjetoLegalPorPai.has(boardId)) {
          filhoProjetoLegalPorPai.set(boardId, faseNome);
        }
        if (!filhoProjetoLegalConcluidoPorPai.has(boardId)) {
          filhoProjetoLegalConcluidoPorPai.set(
            boardId,
            (row as { concluido?: boolean | null }).concluido === true,
          );
        }
      }
    }

    const paisComFilhoProjetoLegalArquivado = new Set<string>();
    for (const row of filhosProjetoLegalArq ?? []) {
      const oid = String((row as { origem_card_id?: string | null }).origem_card_id ?? '').trim();
      if (!oid) continue;
      for (const boardId of boardCardsDoFilhoOrigem(oid, cardIds, ancestraisPorBoardCard)) {
        paisComFilhoProjetoLegalArquivado.add(boardId);
      }
    }

    const filhoAcoplamentoPorPai = new Map<string, { nome: string; slug: string }>();
    for (const row of filhosAcoplamento ?? []) {
      const oid = String((row as { origem_card_id?: string | null }).origem_card_id ?? '').trim();
      if (!oid) continue;
      const fase = unwrapFase(
        (row as { kanban_fases?: FaseJoin | FaseJoin[] | null }).kanban_fases ?? null,
      );
      for (const boardId of boardCardsDoFilhoOrigem(oid, cardIds, ancestraisPorBoardCard)) {
        registrarFilhoAcoplamentoPai(filhoAcoplamentoPorPai, boardId, fase);
      }
    }

    const paisComFilhoAcoplamentoArquivado = new Set<string>();
    for (const row of filhosAcoplamentoArq ?? []) {
      const oid = String((row as { origem_card_id?: string | null }).origem_card_id ?? '').trim();
      if (!oid) continue;
      for (const boardId of boardCardsDoFilhoOrigem(oid, cardIds, ancestraisPorBoardCard)) {
        paisComFilhoAcoplamentoArquivado.add(boardId);
      }
    }

    const filhoCreditoObraPorPai = new Map<string, string>();
    for (const row of filhosCreditoObra ?? []) {
      const oid = String((row as { origem_card_id?: string | null }).origem_card_id ?? '').trim();
      if (!oid) continue;
      const fase = unwrapFase(
        (row as { kanban_fases?: FaseJoin | FaseJoin[] | null }).kanban_fases ?? null,
      );
      for (const boardId of boardCardsDoFilhoOrigem(oid, cardIds, ancestraisPorBoardCard)) {
        if (filhoCreditoObraPorPai.has(boardId)) continue;
        filhoCreditoObraPorPai.set(boardId, String(fase?.nome ?? '').trim());
      }
    }

    const paisComFilhoCreditoObraArquivado = new Set<string>();
    for (const row of filhosCreditoObraArq ?? []) {
      const oid = String((row as { origem_card_id?: string | null }).origem_card_id ?? '').trim();
      if (!oid) continue;
      for (const boardId of boardCardsDoFilhoOrigem(oid, cardIds, ancestraisPorBoardCard)) {
        paisComFilhoCreditoObraArquivado.add(boardId);
      }
    }

    const filhoProjetosLocaisPorPai = new Map<string, string>();
    for (const row of filhosProjetosLocais ?? []) {
      const oid = String((row as { origem_card_id?: string | null }).origem_card_id ?? '').trim();
      if (!oid) continue;
      const fase = unwrapFase(
        (row as { kanban_fases?: FaseJoin | FaseJoin[] | null }).kanban_fases ?? null,
      );
      for (const boardId of boardCardsDoFilhoOrigem(oid, cardIds, ancestraisPorBoardCard)) {
        if (filhoProjetosLocaisPorPai.has(boardId)) continue;
        filhoProjetosLocaisPorPai.set(boardId, String(fase?.nome ?? '').trim());
      }
    }

    const paisComFilhoProjetosLocaisArquivado = new Set<string>();
    for (const row of filhosProjetosLocaisArq ?? []) {
      const oid = String((row as { origem_card_id?: string | null }).origem_card_id ?? '').trim();
      if (!oid) continue;
      for (const boardId of boardCardsDoFilhoOrigem(oid, cardIds, ancestraisPorBoardCard)) {
        paisComFilhoProjetosLocaisArquivado.add(boardId);
      }
    }

    await enrichFilhosAcoplamentoPorVinculos(
      supabase,
      cardIds,
      origemIdsConsulta,
      ancestraisPorBoardCard,
      filhoAcoplamentoPorPai,
    );
    await enrichFilhosAcoplamentoArquivadosPorVinculos(
      supabase,
      cardIds,
      origemIdsConsulta,
      ancestraisPorBoardCard,
      paisComFilhoAcoplamentoArquivado,
    );

    await enrichFilhosEsteiraPorVinculos(
      supabase,
      cardIds,
      origemIdsConsulta,
      KANBAN_IDS.PROJETO_LEGAL,
      ancestraisPorBoardCard,
      (boardId, fase) => {
        const faseNome = String(fase?.nome ?? '').trim();
        if (faseNome && !filhoProjetoLegalPorPai.has(boardId)) {
          filhoProjetoLegalPorPai.set(boardId, faseNome);
        }
      },
    );
    await enrichFilhosEsteiraArquivadosPorVinculos(
      supabase,
      cardIds,
      origemIdsConsulta,
      KANBAN_IDS.PROJETO_LEGAL,
      ancestraisPorBoardCard,
      paisComFilhoProjetoLegalArquivado,
    );

    await enrichFilhosEsteiraPorVinculos(
      supabase,
      cardIds,
      origemIdsConsulta,
      KANBAN_IDS.CREDITO_OBRA,
      ancestraisPorBoardCard,
      (boardId, fase) => {
        if (filhoCreditoObraPorPai.has(boardId)) return;
        filhoCreditoObraPorPai.set(boardId, String(fase?.nome ?? '').trim());
      },
    );
    await enrichFilhosEsteiraArquivadosPorVinculos(
      supabase,
      cardIds,
      origemIdsConsulta,
      KANBAN_IDS.CREDITO_OBRA,
      ancestraisPorBoardCard,
      paisComFilhoCreditoObraArquivado,
    );

    await enrichFilhosEsteiraPorVinculos(
      supabase,
      cardIds,
      origemIdsConsulta,
      KANBAN_IDS.PROJETOS_LOCAIS,
      ancestraisPorBoardCard,
      (boardId, fase) => {
        if (filhoProjetosLocaisPorPai.has(boardId)) return;
        filhoProjetosLocaisPorPai.set(boardId, String(fase?.nome ?? '').trim());
      },
    );
    await enrichFilhosEsteiraArquivadosPorVinculos(
      supabase,
      cardIds,
      origemIdsConsulta,
      KANBAN_IDS.PROJETOS_LOCAIS,
      ancestraisPorBoardCard,
      paisComFilhoProjetosLocaisArquivado,
    );

    await enrichFilhosOperacoesPorTituloFranquia(supabase, cards, {
      filhoAcoplamentoPorPai,
      paisComFilhoAcoplamentoArquivado,
      filhoProjetoLegalPorPai,
      filhoProjetoLegalConcluidoPorPai,
      paisComFilhoProjetoLegalArquivado,
      filhoProjetosLocaisPorPai,
      paisComFilhoProjetosLocaisArquivado,
      filhoCreditoObraPorPai,
      paisComFilhoCreditoObraArquivado,
    });

    return cards.map((c) => {
      const temFilhoProjetoLegal = filhoProjetoLegalPorPai.has(c.id);
      const filhoProjetoLegalArquivado =
        paisComFilhoProjetoLegalArquivado.has(c.id) && !temFilhoProjetoLegal;
      const filhoAcop = filhoAcoplamentoPorPai.get(c.id);
      const temFilhoAcoplamento = Boolean(filhoAcop);
      const filhoAcoplamentoArquivado =
        paisComFilhoAcoplamentoArquivado.has(c.id) && !temFilhoAcoplamento;
      const temFilhoCreditoObra = filhoCreditoObraPorPai.has(c.id);
      const filhoCreditoObraArquivado =
        paisComFilhoCreditoObraArquivado.has(c.id) && !temFilhoCreditoObra;
      const temFilhoProjetosLocais = filhoProjetosLocaisPorPai.has(c.id);
      const filhoProjetosLocaisArquivado =
        paisComFilhoProjetosLocaisArquivado.has(c.id) && !temFilhoProjetosLocais;

      if (
        !temFilhoProjetoLegal &&
        !filhoProjetoLegalArquivado &&
        !temFilhoAcoplamento &&
        !filhoAcoplamentoArquivado &&
        !temFilhoCreditoObra &&
        !filhoCreditoObraArquivado &&
        !temFilhoProjetosLocais &&
        !filhoProjetosLocaisArquivado
      ) {
        return c;
      }

      const patch: Partial<KanbanCardBrief> = {};
      if (temFilhoProjetoLegal) {
        patch.tem_filho_projeto_legal = true;
        patch.projeto_legal_filho_fase = filhoProjetoLegalPorPai.get(c.id) ?? null;
        patch.projeto_legal_filho_concluido = filhoProjetoLegalConcluidoPorPai.get(c.id) === true;
      }
      if (filhoProjetoLegalArquivado) patch.filho_projeto_legal_arquivado = true;
      if (temFilhoAcoplamento) patch.tem_filho_acoplamento = true;
      if (filhoAcoplamentoArquivado) patch.filho_acoplamento_arquivado = true;
      if (filhoAcop) {
        if (!String(c.acoplamento_filho_fase_slug ?? '').trim() && filhoAcop.slug) {
          patch.acoplamento_filho_fase_slug = filhoAcop.slug;
        }
        if (!String(c.acoplamento_filho_fase_nome ?? '').trim() && filhoAcop.nome) {
          patch.acoplamento_filho_fase_nome = filhoAcop.nome;
        }
      } else if (filhoAcoplamentoArquivado) {
        patch.acoplamento_filho_fase_slug = null;
        patch.acoplamento_filho_fase_nome = FASE_EXIBICAO_CARD_ARQUIVADO;
      }
      if (temFilhoCreditoObra) {
        patch.tem_filho_credito_obra = true;
        patch.credito_obra_filho_fase = filhoCreditoObraPorPai.get(c.id) || null;
      }
      if (filhoCreditoObraArquivado) patch.filho_credito_obra_arquivado = true;
      if (temFilhoProjetosLocais) {
        patch.tem_filho_projetos_locais = true;
        patch.projetos_locais_filho_fase = filhoProjetosLocaisPorPai.get(c.id) ?? null;
      }
      if (filhoProjetosLocaisArquivado) patch.filho_projetos_locais_arquivado = true;
      return { ...c, ...patch };
    });
  }

  return cards;
}

export function hipotesesOrdemMinima(fases: { slug?: string | null; ordem: number }[]): number | null {
  let min: number | null = null;
  for (const f of fases) {
    const s = String(f.slug ?? '').trim();
    if (!isHipotesesFaseSlug(s)) continue;
    if (min == null || f.ordem < min) min = f.ordem;
  }
  return min ?? HIPOTESES_ORDEM_MIN_PROD;
}
