import { buildNativeFaseTimeline } from '@/lib/kanban/kanban-card-timeline';
import { LOTEADORES_R1_CONCEITO_FASE_SLUG } from '@/lib/kanban/loteadores-r1-conceito';
import {
  buildConversaoContext,
  cardConverteuPorRegras,
} from '@/lib/kanban/painel-conversao-classify';
import type {
  PainelCardDTO,
  PainelFaseDTO,
  PainelHistoricoMovimentoDTO,
} from '@/lib/kanban/painel-performance-types';

const CONTRATO_PARCERIA_SLUG = 'contrato_parceria_moni_inc' as const;
const VIABILIDADE_SLUG = 'viabilidade_moni_inc' as const;

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

function resolveLoteadorKey(c: PainelCardDTO): { key: string; label: string } | null {
  const id = c.rede_loteador_id?.trim();
  if (!id) return null;
  const nome = c.loteador_nome?.trim();
  return { key: id, label: nome || id.slice(0, 8) };
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

function median(nums: number[]): number | null {
  const sorted = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function percentile(nums: number[], p: number): number | null {
  const sorted = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? null;
}

function diasDesdeEnteredFaseAt(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / (24 * 60 * 60 * 1000);
}

function teveMovimentacaoDesde(
  enteredIso: string,
  historico: PainelHistoricoMovimentoDTO[],
): boolean {
  const t0 = new Date(enteredIso).getTime();
  if (!Number.isFinite(t0)) return false;
  for (const h of historico) {
    const t = new Date(h.criado_em).getTime();
    if (!Number.isFinite(t) || t <= t0) continue;
    if (h.acao === 'fase_avancada' || h.acao === 'fase_retrocedida') return true;
  }
  return false;
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
    medianaDias: number | null;
    p90Dias: number | null;
    amostras: number;
    historicoParcial: boolean;
  } | null;
  viabilidadeSemMovimentacao15Dias: {
    acima15Dias: number;
    itens: Array<{ cardId: string; titulo: string; diasParados: number }>;
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
  const viabilidadeIds = new Set(faseIdsPorSlugs(input.fases, [VIABILIDADE_SLUG]));

  const loteadorIndisponivel =
    input.loteadoresFieldsAvailable === false ||
    (input.loteadoresFieldsAvailable !== true && !campoDisponivel(input.cards, 'rede_loteador_id'));

  let conversaoPorLoteador: PainelLoteadoresEspecificidades['conversaoPorLoteador'] = null;
  try {
    const map = new Map<string, PainelLoteadoresConversaoRow>();
    if (!loteadorIndisponivel) {
      for (const c of input.cards) {
        const lk = resolveLoteadorKey(c);
        if (!lk) continue;
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
    }
    const linhas = [...map.values()]
      .map((g) => ({
        ...g,
        taxaConversaoPct: g.entradas === 0 ? null : (g.converteram / g.entradas) * 100,
      }))
      .sort((a, b) => b.entradas - a.entradas);
    conversaoPorLoteador = { linhas, loteadorIndisponivel };
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
        medianaDias: median(tempos),
        p90Dias: percentile(tempos, 90),
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
      const itens: NonNullable<
        PainelLoteadoresEspecificidades['viabilidadeSemMovimentacao15Dias']
      >['itens'] = [];

      for (const c of input.cards) {
        if (!viabilidadeIds.has(c.fase_id)) continue;
        if (!cardAtivo(c)) continue;
        const historico = historicoPorCard.get(c.id) ?? [];
        let entered = c.entered_fase_at?.trim() || null;
        if (!entered) {
          for (const faseId of viabilidadeIds) {
            entered = primeiraEntradaFase(c, faseId, fasesOrd, historico);
            if (entered) break;
          }
        }
        if (!entered) continue;
        const dias = diasDesdeEnteredFaseAt(entered);
        if (dias == null || dias <= 15) continue;
        if (teveMovimentacaoDesde(entered, historico)) continue;
        itens.push({
          cardId: c.id,
          titulo: c.titulo?.trim() || c.id.slice(0, 8),
          diasParados: Math.floor(dias),
        });
      }

      itens.sort((a, b) => b.diasParados - a.diasParados);

      viabilidadeSemMovimentacao15Dias = {
        acima15Dias: itens.length,
        itens,
      };
    }
  } catch {
    viabilidadeSemMovimentacao15Dias = null;
  }

  let loteadoresComMaisDe2Ativos: PainelLoteadoresEspecificidades['loteadoresComMaisDe2Ativos'] =
    null;
  try {
    const map = new Map<string, PainelLoteadoresLoteadorAtivosRow>();
    if (!loteadorIndisponivel) {
      for (const c of input.cards) {
        if (!cardAtivo(c)) continue;
        const lk = resolveLoteadorKey(c);
        if (!lk) continue;
        const cur = map.get(lk.key) ?? {
          loteadorId: lk.key,
          label: lk.label,
          cardsAtivos: 0,
        };
        cur.cardsAtivos += 1;
        map.set(lk.key, cur);
      }
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
