import { buildNativeFaseTimeline } from '@/lib/kanban/kanban-card-timeline';
import { LOTEADORES_R1_CONCEITO_FASE_SLUG } from '@/lib/kanban/loteadores-r1-conceito';
import { LOTEADORES_VIABILIDADE_FASE_SLUGS } from '@/lib/kanban/loteadores-viabilidade';
import {
  buildConversaoContext,
  cardConverteuPorRegras,
} from '@/lib/kanban/painel-conversao-classify';
import type {
  PainelCardDTO,
  PainelFaseDTO,
  PainelHistoricoMovimentoDTO,
} from '@/lib/kanban/painel-performance-types';

const MS_15_DIAS = 15 * 24 * 60 * 60 * 1000;
const CONTRATO_PARCERIA_SLUG = 'contrato_parceria_moni_inc' as const;

function campoDisponivel(cards: PainelCardDTO[], key: keyof PainelCardDTO): boolean {
  return cards.some((c) => c[key] !== undefined);
}

function faseIdsPorSlugs(fases: PainelFaseDTO[], slugs: readonly string[]): string[] {
  const want = new Set(slugs.map((s) => s.trim()));
  return fases.filter((f) => want.has(String(f.slug ?? '').trim())).map((f) => f.id);
}

function buildHistoricoPorCard(
  rows: PainelHistoricoMovimentoDTO[],
): Map<string, PainelHistoricoMovimentoDTO[]> {
  const m = new Map<string, PainelHistoricoMovimentoDTO[]>();
  for (const r of rows) {
    const list = m.get(r.card_id) ?? [];
    list.push(r);
    m.set(r.card_id, list);
  }
  return m;
}

function cardAtivo(c: PainelCardDTO): boolean {
  return !c.arquivado && !c.concluido;
}

function resolveLoteadorKey(c: PainelCardDTO): { key: string; label: string } {
  const id = c.rede_loteador_id?.trim();
  const nome = c.loteador_nome?.trim();
  if (id) {
    return { key: id, label: nome || id.slice(0, 8) };
  }
  const tituloParte = c.titulo.split(' - ')[0]?.trim();
  if (tituloParte) {
    return { key: `titulo:${tituloParte.toLowerCase()}`, label: tituloParte };
  }
  return { key: '__sem_loteador__', label: 'Loteador não vinculado' };
}

function primeiraEntradaFase(
  card: PainelCardDTO,
  faseId: string,
  fasesOrd: PainelFaseDTO[],
  historico: PainelHistoricoMovimentoDTO[],
): string | null {
  const linhas = buildNativeFaseTimeline(
    fasesOrd,
    { created_at: card.created_at, fase_id: card.fase_id },
    historico.map((h) => ({ acao: h.acao, detalhe: h.detalhe, criado_em: h.criado_em })),
  );
  const entrou = linhas.find((l) => l.faseId === faseId)?.entrouEm ?? null;
  if (entrou) return entrou;
  if (card.fase_id === faseId && card.entered_fase_at) return card.entered_fase_at;
  return null;
}

function diasEntreFases(
  card: PainelCardDTO,
  faseOrigemId: string,
  faseDestinoId: string,
  fasesOrd: PainelFaseDTO[],
  historico: PainelHistoricoMovimentoDTO[],
): number | null {
  const inicio = primeiraEntradaFase(card, faseOrigemId, fasesOrd, historico);
  const fim = primeiraEntradaFase(card, faseDestinoId, fasesOrd, historico);
  if (!inicio || !fim) return null;
  const a = new Date(inicio).getTime();
  const b = new Date(fim).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return (b - a) / (24 * 60 * 60 * 1000);
}

export type PainelLoteadoresConversaoRow = {
  loteadorId: string;
  label: string;
  entradas: number;
  converteram: number;
  taxaConversaoPct: number | null;
};

export type PainelLoteadoresLoteadorAtivosRow = {
  loteadorId: string;
  label: string;
  cardsAtivos: number;
};

export type PainelLoteadoresEspecificidades = {
  conversaoPorLoteador: {
    linhas: PainelLoteadoresConversaoRow[];
    loteadorIndisponivel: boolean;
  } | null;
  tempoR1AteContrato: {
    mediaDias: number | null;
    amostras: number;
    historicoParcial: boolean;
  } | null;
  viabilidadeSemMovimentacao15Dias: {
    acima15Dias: number;
    totalNaFase: number;
    percentual: number | null;
  } | null;
  loteadoresComMaisDe2Ativos: {
    linhas: PainelLoteadoresLoteadorAtivosRow[];
    loteadorIndisponivel: boolean;
  } | null;
};

/** Métricas específicas do Funil Loteadores. Degrada por bloco quando dados ausentes. */
export function computeLoteadoresEspecificidades(input: {
  fases: PainelFaseDTO[];
  cards: PainelCardDTO[];
  historicoMovimentos: PainelHistoricoMovimentoDTO[];
  loteadoresFieldsAvailable?: boolean;
}): PainelLoteadoresEspecificidades | null {
  const historicoPorCard = buildHistoricoPorCard(input.historicoMovimentos);
  const fasesOrd = [...input.fases].sort((a, b) => a.ordem - b.ordem);
  const conversaoCtx = buildConversaoContext(input.fases);

  const r1Ids = faseIdsPorSlugs(input.fases, [LOTEADORES_R1_CONCEITO_FASE_SLUG]);
  const contratoIds = faseIdsPorSlugs(input.fases, [CONTRATO_PARCERIA_SLUG]);
  const viabilidadeIds = new Set(faseIdsPorSlugs(input.fases, LOTEADORES_VIABILIDADE_FASE_SLUGS));

  const loteadorIndisponivel =
    input.loteadoresFieldsAvailable === false ||
    (input.loteadoresFieldsAvailable !== true && !campoDisponivel(input.cards, 'rede_loteador_id'));

  let conversaoPorLoteador: PainelLoteadoresEspecificidades['conversaoPorLoteador'] = null;
  try {
    const map = new Map<string, PainelLoteadoresConversaoRow>();
    for (const c of input.cards) {
      const lk = resolveLoteadorKey(c);
      const cur = map.get(lk.key) ?? {
        loteadorId: lk.key,
        label: lk.label,
        entradas: 0,
        converteram: 0,
        taxaConversaoPct: null,
      };
      cur.entradas += 1;
      if (cardConverteuPorRegras(c, conversaoCtx)) cur.converteram += 1;
      map.set(lk.key, cur);
    }
    const linhas = [...map.values()]
      .map((g) => ({
        ...g,
        taxaConversaoPct: g.entradas === 0 ? null : (g.converteram / g.entradas) * 100,
      }))
      .sort((a, b) => b.entradas - a.entradas);
    if (linhas.length > 0 || !loteadorIndisponivel) {
      conversaoPorLoteador = { linhas, loteadorIndisponivel };
    }
  } catch {
    conversaoPorLoteador = null;
  }

  let tempoR1AteContrato: PainelLoteadoresEspecificidades['tempoR1AteContrato'] = null;
  try {
    if (r1Ids.length > 0 && contratoIds.length > 0) {
      const tempos: number[] = [];
      let historicoParcial = false;
      for (const c of input.cards) {
        const historico = historicoPorCard.get(c.id) ?? [];
        const temMov = historico.some(
          (h) =>
            h.acao === 'fase_avancada' || h.acao === 'fase_retrocedida' || h.acao === 'card_criado',
        );
        if (!temMov) historicoParcial = true;
        for (const r1Id of r1Ids) {
          for (const contratoId of contratoIds) {
            const dias = diasEntreFases(c, r1Id, contratoId, fasesOrd, historico);
            if (dias != null) tempos.push(dias);
          }
        }
      }
      tempoR1AteContrato = {
        mediaDias:
          tempos.length === 0 ? null : tempos.reduce((s, n) => s + n, 0) / tempos.length,
        amostras: tempos.length,
        historicoParcial,
      };
    }
  } catch {
    tempoR1AteContrato = null;
  }

  let viabilidadeSemMovimentacao15Dias: PainelLoteadoresEspecificidades['viabilidadeSemMovimentacao15Dias'] =
    null;
  try {
    if (viabilidadeIds.size > 0) {
      const now = Date.now();
      let acima15Dias = 0;
      let totalNaFase = 0;
      for (const c of input.cards) {
        if (!viabilidadeIds.has(c.fase_id)) continue;
        if (!cardAtivo(c)) continue;
        totalNaFase += 1;
        const historico = historicoPorCard.get(c.id) ?? [];
        let entered = c.entered_fase_at?.trim() || null;
        if (!entered) {
          for (const faseId of viabilidadeIds) {
            entered = primeiraEntradaFase(c, faseId, fasesOrd, historico);
            if (entered) break;
          }
        }
        if (!entered) continue;
        const t = new Date(entered).getTime();
        if (Number.isFinite(t) && now - t > MS_15_DIAS) acima15Dias += 1;
      }
      viabilidadeSemMovimentacao15Dias = {
        acima15Dias,
        totalNaFase,
        percentual: totalNaFase === 0 ? null : (acima15Dias / totalNaFase) * 100,
      };
    }
  } catch {
    viabilidadeSemMovimentacao15Dias = null;
  }

  let loteadoresComMaisDe2Ativos: PainelLoteadoresEspecificidades['loteadoresComMaisDe2Ativos'] =
    null;
  try {
    const map = new Map<string, PainelLoteadoresLoteadorAtivosRow>();
    for (const c of input.cards) {
      if (!cardAtivo(c)) continue;
      const lk = resolveLoteadorKey(c);
      const cur = map.get(lk.key) ?? {
        loteadorId: lk.key,
        label: lk.label,
        cardsAtivos: 0,
      };
      cur.cardsAtivos += 1;
      map.set(lk.key, cur);
    }
    const linhas = [...map.values()]
      .filter((r) => r.cardsAtivos > 2)
      .sort((a, b) => b.cardsAtivos - a.cardsAtivos);
    loteadoresComMaisDe2Ativos = { linhas, loteadorIndisponivel };
  } catch {
    loteadoresComMaisDe2Ativos = null;
  }

  const temAlgum =
    conversaoPorLoteador != null ||
    tempoR1AteContrato != null ||
    viabilidadeSemMovimentacao15Dias != null ||
    loteadoresComMaisDe2Ativos != null;

  if (!temAlgum) return null;

  return {
    conversaoPorLoteador,
    tempoR1AteContrato,
    viabilidadeSemMovimentacao15Dias,
    loteadoresComMaisDe2Ativos,
  };
}
