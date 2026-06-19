import { FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import type {
  PainelCardDTO,
  PainelCarometroIndicadores,
  PainelFaseDTO,
  PainelHistoricoMovimentoDTO,
  PainelPeriodKey,
} from '@/lib/kanban/painel-performance-types';

function periodSinceMs(key: PainelPeriodKey): number | null {
  if (key === 'all') return null;
  const days = key === '7d' ? 7 : key === '30d' ? 30 : 90;
  return Date.now() - days * 86400000;
}

export type ComputeCarometroIndicadoresInput = {
  kanbanId?: string | null;
  period: PainelPeriodKey;
  fases: PainelFaseDTO[];
  cards: PainelCardDTO[];
  historicoMovimentos: PainelHistoricoMovimentoDTO[];
  /** false quando migration 389 ainda não aplicada ou select básico em uso. */
  carometroFieldsAvailable?: boolean;
};

function campoDisponivel(cards: PainelCardDTO[], key: keyof PainelCardDTO): boolean {
  return cards.some((c) => c[key] !== undefined);
}

function detStr(d: Record<string, unknown> | null | undefined, key: string): string {
  if (!d) return '';
  const v = d[key];
  return typeof v === 'string' ? v.trim() : '';
}

function timestampInPeriod(iso: string | null | undefined, sinceMs: number | null): boolean {
  if (sinceMs === null) return Boolean(iso);
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= sinceMs;
}

function franquiaKeyLabel(c: PainelCardDTO): { key: string; label: string } | null {
  const redeId = c.projeto_franqueado_id?.trim() || c.rede_franqueado_id?.trim();
  if (!redeId) return null;
  const nFranq = c.projeto_n_franquia?.trim() || c.n_franquia?.trim();
  const nomeRede = c.projeto_franqueado_nome?.trim() || c.franqueado_rede_nome?.trim();
  const label = [nFranq, nomeRede].filter(Boolean).join(' · ') || redeId.slice(0, 8);
  return { key: redeId, label };
}

function bumpFranquiaCount(
  map: Map<string, { label: string; quantidade: number }>,
  c: PainelCardDTO,
): void {
  const fk = franquiaKeyLabel(c);
  if (!fk) return;
  const cur = map.get(fk.key) ?? { label: fk.label, quantidade: 0 };
  cur.quantidade += 1;
  map.set(fk.key, cur);
}

function franquiaCountsFromMap(
  map: Map<string, { label: string; quantidade: number }>,
): Array<{ franqueadoId: string; label: string; quantidade: number }> {
  return [...map.entries()]
    .map(([franqueadoId, v]) => ({
      franqueadoId,
      label: v.label,
      quantidade: v.quantidade,
    }))
    .sort((a, b) => b.quantidade - a.quantidade);
}

function cardTemCampoConfirmacao(
  c: PainelCardDTO,
  flag: 'opcao_assinada' | 'comite_aprovado' | 'contrato_assinado',
  emField: 'opcao_assinada_em' | 'comite_aprovado_em' | 'contrato_assinado_em',
  sinceMs: number | null,
): boolean {
  if (c[flag] !== true) return false;
  return timestampInPeriod(c[emField], sinceMs);
}

function computeOpcoesAssinadas(
  cards: PainelCardDTO[],
  sinceMs: number | null,
): PainelCarometroIndicadores['opcoes_assinadas_no_periodo'] {
  const porFranquiaMap = new Map<string, { label: string; quantidade: number }>();
  let total = 0;
  for (const c of cards) {
    if (!cardTemCampoConfirmacao(c, 'opcao_assinada', 'opcao_assinada_em', sinceMs)) continue;
    total += 1;
    bumpFranquiaCount(porFranquiaMap, c);
  }
  return {
    total,
    porFranquia: franquiaCountsFromMap(porFranquiaMap),
  };
}

function computeContratosAssinados(
  cards: PainelCardDTO[],
  sinceMs: number | null,
): PainelCarometroIndicadores['contratos_assinados_no_periodo'] {
  const porFranquiaMap = new Map<string, { label: string; quantidade: number }>();
  let total = 0;
  for (const c of cards) {
    if (!cardTemCampoConfirmacao(c, 'contrato_assinado', 'contrato_assinado_em', sinceMs)) continue;
    total += 1;
    bumpFranquiaCount(porFranquiaMap, c);
  }
  return {
    total,
    porFranquia: franquiaCountsFromMap(porFranquiaMap),
  };
}

function computeComiteParaContratoTaxa(
  cards: PainelCardDTO[],
  sinceMs: number | null,
): PainelCarometroIndicadores['comite_para_contrato_taxa'] {
  let numerador = 0;
  let denominador = 0;
  for (const c of cards) {
    if (cardTemCampoConfirmacao(c, 'comite_aprovado', 'comite_aprovado_em', sinceMs)) {
      numerador += 1;
    }
    if (cardTemCampoConfirmacao(c, 'contrato_assinado', 'contrato_assinado_em', sinceMs)) {
      denominador += 1;
    }
  }
  return {
    numerador,
    denominador,
    percentual: denominador === 0 ? null : (numerador / denominador) * 100,
  };
}

function faseIdPorSlug(fases: PainelFaseDTO[], slug: string): string | null {
  const s = slug.trim();
  const f = fases.find((x) => String(x.slug ?? '').trim() === s);
  return f?.id ?? null;
}

function cardChegouFaseNoPeriodo(
  card: PainelCardDTO,
  faseId: string,
  sinceMs: number | null,
  historicoPorCard: Map<string, PainelHistoricoMovimentoDTO[]>,
): boolean {
  const movs = historicoPorCard.get(card.id) ?? [];
  for (const h of movs) {
    const nov =
      detStr(h.detalhe, 'fase_nova_id') ||
      (h.acao === 'card_criado' ? detStr(h.detalhe, 'fase_id') : '');
    if (nov !== faseId) continue;
    if (sinceMs === null) return true;
    const t = new Date(h.criado_em).getTime();
    if (Number.isFinite(t) && t >= sinceMs) return true;
  }
  if (card.fase_id === faseId && timestampInPeriod(card.entered_fase_at, sinceMs)) {
    return true;
  }
  return false;
}

function computeHipotesesNoPeriodo(
  cards: PainelCardDTO[],
  fases: PainelFaseDTO[],
  sinceMs: number | null,
): PainelCarometroIndicadores['hipoteses_no_periodo'] {
  const hipFaseId = faseIdPorSlug(fases, FASE_SLUGS.HIPOTESES);
  if (!hipFaseId) {
    return { total: 0, porFranquia: [] };
  }

  const porFranquiaMap = new Map<string, { label: string; quantidade: number }>();
  let total = 0;
  for (const c of cards) {
    if (c.fase_id !== hipFaseId) continue;
    if (!timestampInPeriod(c.entered_fase_at, sinceMs)) continue;
    total += 1;
    bumpFranquiaCount(porFranquiaMap, c);
  }
  return {
    total,
    porFranquia: franquiaCountsFromMap(porFranquiaMap),
  };
}

function computeAcoplamentosPorOrigem(
  cards: PainelCardDTO[],
  fases: PainelFaseDTO[],
  sinceMs: number | null,
  historicoPorCard: Map<string, PainelHistoricoMovimentoDTO[]>,
): PainelCarometroIndicadores['acoplamentos_por_origem'] {
  const faseAprovadoId = faseIdPorSlug(fases, FASE_SLUGS.ACOPLAMENTO_APROVADO);
  if (!faseAprovadoId) return [];

  const porOrigem = new Map<string, number>();
  for (const c of cards) {
    if (!cardChegouFaseNoPeriodo(c, faseAprovadoId, sinceMs, historicoPorCard)) continue;
    const origem = c.origem_kanban_nome?.trim() || 'Origem não informada';
    porOrigem.set(origem, (porOrigem.get(origem) ?? 0) + 1);
  }

  return [...porOrigem.entries()]
    .map(([origem, quantidade]) => ({ origem, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade);
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

const CAROMETRO_VAZIO: PainelCarometroIndicadores = {
  opcoes_assinadas_no_periodo: null,
  contratos_assinados_no_periodo: null,
  comite_para_contrato_taxa: null,
  hipoteses_no_periodo: null,
  acoplamentos_por_origem: null,
};

/** Indicadores conectáveis ao Carômetro (degradam para null se colunas/campos ausentes). */
export function computeCarometroIndicadores(
  input: ComputeCarometroIndicadoresInput,
): PainelCarometroIndicadores {
  const kanbanId = String(input.kanbanId ?? '').trim();
  const sinceMs = periodSinceMs(input.period);
  const historicoPorCard = buildHistoricoPorCard(input.historicoMovimentos);
  const out: PainelCarometroIndicadores = { ...CAROMETRO_VAZIO };
  const camposCarometro =
    input.carometroFieldsAvailable !== false &&
    (input.carometroFieldsAvailable === true ||
      campoDisponivel(input.cards, 'opcao_assinada') ||
      campoDisponivel(input.cards, 'origem_kanban_nome'));

  if (kanbanId === KANBAN_IDS.PORTFOLIO && camposCarometro) {
    try {
      out.opcoes_assinadas_no_periodo = computeOpcoesAssinadas(input.cards, sinceMs);
    } catch {
      out.opcoes_assinadas_no_periodo = null;
    }
    try {
      out.contratos_assinados_no_periodo = computeContratosAssinados(input.cards, sinceMs);
    } catch {
      out.contratos_assinados_no_periodo = null;
    }
    try {
      out.comite_para_contrato_taxa = computeComiteParaContratoTaxa(input.cards, sinceMs);
    } catch {
      out.comite_para_contrato_taxa = null;
    }
  }

  if (kanbanId === KANBAN_IDS.STEP_ONE) {
    try {
      out.hipoteses_no_periodo = computeHipotesesNoPeriodo(input.cards, input.fases, sinceMs);
    } catch {
      out.hipoteses_no_periodo = null;
    }
  }

  if (kanbanId === KANBAN_IDS.ACOPLAMENTO && camposCarometro) {
    try {
      out.acoplamentos_por_origem = computeAcoplamentosPorOrigem(
        input.cards,
        input.fases,
        sinceMs,
        historicoPorCard,
      );
    } catch {
      out.acoplamentos_por_origem = null;
    }
  }

  return out;
}
