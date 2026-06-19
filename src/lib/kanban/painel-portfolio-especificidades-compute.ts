import { calcularDiasUteis } from '@/lib/dias-uteis';
import { FASE_SLUGS, PORTFOLIO_FASES_CONFIRMACAO_SAIDA } from '@/lib/constants/kanban-ids';
import { categoriaMotivoArquivamento } from '@/lib/kanban/motivos-arquivamento';
import type {
  PainelCardDTO,
  PainelFaseDTO,
  PainelHistoricoMovimentoDTO,
  PainelPeriodKey,
} from '@/lib/kanban/painel-performance-types';

const MOTIVOS_PERDA_INTERNA = new Set([
  'Terreno inviável',
  'Crédito inviável',
  'Documentação incompleta',
  'Produto não encaixou',
  'Fora do escopo',
  'Erro operacional',
  'Duplicado',
]);

const MOTIVOS_PERDA_EXTERNA = new Set([
  'Desistência do terrenista/parceiro',
  'Desistência do franqueado',
]);

function periodSinceMs(key: PainelPeriodKey): number | null {
  if (key === 'all') return null;
  const days = key === '7d' ? 7 : key === '30d' ? 30 : 90;
  return Date.now() - days * 86400000;
}

function timestampInPeriod(iso: string | null | undefined, sinceMs: number | null): boolean {
  if (sinceMs === null) return Boolean(iso);
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= sinceMs;
}

function detStr(d: Record<string, unknown> | null | undefined, key: string): string {
  if (!d) return '';
  const v = d[key];
  return typeof v === 'string' ? v.trim() : '';
}

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

function cardVisitouFase(
  card: PainelCardDTO,
  faseIds: Set<string>,
  historicoPorCard: Map<string, PainelHistoricoMovimentoDTO[]>,
): boolean {
  if (faseIds.has(card.fase_id)) return true;
  for (const h of historicoPorCard.get(card.id) ?? []) {
    const d = h.detalhe;
    if (faseIds.has(detStr(d, 'fase_nova_id'))) return true;
    if (faseIds.has(detStr(d, 'fase_anterior_id'))) return true;
    if (h.acao === 'card_criado' && faseIds.has(detStr(d, 'fase_id'))) return true;
  }
  return false;
}

function cardChegouFaseNoPeriodo(
  card: PainelCardDTO,
  faseIds: Set<string>,
  sinceMs: number | null,
  historicoPorCard: Map<string, PainelHistoricoMovimentoDTO[]>,
): boolean {
  for (const faseId of faseIds) {
    for (const h of historicoPorCard.get(card.id) ?? []) {
      const nov =
        detStr(h.detalhe, 'fase_nova_id') ||
        (h.acao === 'card_criado' ? detStr(h.detalhe, 'fase_id') : '');
      if (nov !== faseId) continue;
      if (sinceMs === null) return true;
      const t = new Date(h.criado_em).getTime();
      if (Number.isFinite(t) && t >= sinceMs) return true;
    }
    if (faseIds.has(card.fase_id) && faseId === card.fase_id && timestampInPeriod(card.entered_fase_at, sinceMs)) {
      return true;
    }
  }
  return false;
}

function cardConfirmadoNoPeriodo(
  c: PainelCardDTO,
  flag: 'opcao_assinada' | 'comite_aprovado' | 'contrato_assinado',
  emField: 'opcao_assinada_em' | 'comite_aprovado_em' | 'contrato_assinado_em',
  sinceMs: number | null,
): boolean {
  if (c[flag] !== true) return false;
  return timestampInPeriod(c[emField], sinceMs);
}

function median(nums: number[]): number | null {
  const sorted = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function diasUteisEntreIso(a: string, b: string): number | null {
  const da = new Date(a);
  const db = new Date(b);
  if (!Number.isFinite(da.getTime()) || !Number.isFinite(db.getTime()) || db <= da) return null;
  da.setHours(0, 0, 0, 0);
  db.setHours(0, 0, 0, 0);
  return calcularDiasUteis(da, db);
}

export type PainelPortfolioEspecificidades = {
  taxaAprovacaoComite: {
    aprovados: number;
    chegaramComite: number;
    percentual: number | null;
  } | null;
  perdaDecisao: {
    internaMoni: number;
    externaTerrenista: number;
    outros: number;
    totalComMotivo: number;
  } | null;
  tempoOpcaoAteComite: {
    medianaDiasUteis: number | null;
    amostras: number;
  } | null;
  moniCapitalPctContrato: {
    comCaptacaoCapital: number;
    chegaramContrato: number;
    percentual: number | null;
  } | null;
  taxaComiteVirandoContrato: {
    contratosAssinados: number;
    comitesAprovados: number;
    percentual: number | null;
  } | null;
};

export function portfolioEspecificidadesDisponivel(
  cards: PainelCardDTO[],
  carometroFieldsAvailable?: boolean,
): boolean {
  if (carometroFieldsAvailable === false) return false;
  return (
    carometroFieldsAvailable === true ||
    campoDisponivel(cards, 'opcao_assinada') ||
    campoDisponivel(cards, 'comite_aprovado') ||
    campoDisponivel(cards, 'contrato_assinado')
  );
}

/** Métricas específicas do Funil Portfólio (migration 389 + histórico). Degrada para null por bloco. */
export function computePortfolioEspecificidades(input: {
  period: PainelPeriodKey;
  fases: PainelFaseDTO[];
  cards: PainelCardDTO[];
  historicoMovimentos: PainelHistoricoMovimentoDTO[];
  carometroFieldsAvailable?: boolean;
}): PainelPortfolioEspecificidades | null {
  if (!portfolioEspecificidadesDisponivel(input.cards, input.carometroFieldsAvailable)) {
    return null;
  }

  const sinceMs = periodSinceMs(input.period);
  const historicoPorCard = buildHistoricoPorCard(input.historicoMovimentos);

  const faseComiteIds = new Set(faseIdsPorSlugs(input.fases, PORTFOLIO_FASES_CONFIRMACAO_SAIDA.comite));
  const faseContratoIds = new Set(faseIdsPorSlugs(input.fases, PORTFOLIO_FASES_CONFIRMACAO_SAIDA.contrato));
  const faseCaptacaoCapitalIds = new Set(faseIdsPorSlugs(input.fases, [FASE_SLUGS.CAPTACAO_CAPITAL]));

  let taxaAprovacaoComite: PainelPortfolioEspecificidades['taxaAprovacaoComite'] = null;
  try {
    let chegaramComite = 0;
    let aprovados = 0;
    for (const c of input.cards) {
      const chegou = cardChegouFaseNoPeriodo(c, faseComiteIds, sinceMs, historicoPorCard);
      if (!chegou) continue;
      chegaramComite += 1;
      if (cardConfirmadoNoPeriodo(c, 'comite_aprovado', 'comite_aprovado_em', sinceMs)) {
        aprovados += 1;
      }
    }
    taxaAprovacaoComite = {
      chegaramComite,
      aprovados,
      percentual: chegaramComite === 0 ? null : (aprovados / chegaramComite) * 100,
    };
  } catch {
    taxaAprovacaoComite = null;
  }

  let perdaDecisao: PainelPortfolioEspecificidades['perdaDecisao'] = null;
  try {
    let internaMoni = 0;
    let externaTerrenista = 0;
    let outros = 0;
    for (const c of input.cards) {
      if (!c.arquivado) continue;
      if (sinceMs != null && !timestampInPeriod(c.arquivado_em, sinceMs)) continue;
      const cat = categoriaMotivoArquivamento(String(c.motivo_arquivamento ?? ''));
      if (!cat) {
        outros += 1;
        continue;
      }
      if (MOTIVOS_PERDA_INTERNA.has(cat)) internaMoni += 1;
      else if (MOTIVOS_PERDA_EXTERNA.has(cat)) externaTerrenista += 1;
      else outros += 1;
    }
    const totalComMotivo = internaMoni + externaTerrenista + outros;
    if (totalComMotivo > 0) {
      perdaDecisao = { internaMoni, externaTerrenista, outros, totalComMotivo };
    }
  } catch {
    perdaDecisao = null;
  }

  let tempoOpcaoAteComite: PainelPortfolioEspecificidades['tempoOpcaoAteComite'] = null;
  try {
    const tempos: number[] = [];
    for (const c of input.cards) {
      const opEm = c.opcao_assinada_em?.trim();
      const comEm = c.comite_aprovado_em?.trim();
      if (opEm && comEm) {
        const du = diasUteisEntreIso(opEm, comEm);
        if (du != null && du >= 0) tempos.push(du);
      }
    }
    tempoOpcaoAteComite = {
      medianaDiasUteis: median(tempos),
      amostras: tempos.length,
    };
  } catch {
    tempoOpcaoAteComite = null;
  }

  let moniCapitalPctContrato: PainelPortfolioEspecificidades['moniCapitalPctContrato'] = null;
  try {
    let chegaramContrato = 0;
    let comCaptacaoCapital = 0;
    for (const c of input.cards) {
      const chegouContrato =
        cardConfirmadoNoPeriodo(c, 'contrato_assinado', 'contrato_assinado_em', sinceMs) ||
        cardChegouFaseNoPeriodo(c, faseContratoIds, sinceMs, historicoPorCard);
      if (!chegouContrato) continue;
      chegaramContrato += 1;
      if (cardVisitouFase(c, faseCaptacaoCapitalIds, historicoPorCard)) {
        comCaptacaoCapital += 1;
      }
    }
    moniCapitalPctContrato = {
      chegaramContrato,
      comCaptacaoCapital,
      percentual: chegaramContrato === 0 ? null : (comCaptacaoCapital / chegaramContrato) * 100,
    };
  } catch {
    moniCapitalPctContrato = null;
  }

  let taxaComiteVirandoContrato: PainelPortfolioEspecificidades['taxaComiteVirandoContrato'] = null;
  try {
    let comitesAprovados = 0;
    let contratosAssinados = 0;
    for (const c of input.cards) {
      if (cardConfirmadoNoPeriodo(c, 'comite_aprovado', 'comite_aprovado_em', sinceMs)) {
        comitesAprovados += 1;
      }
      if (cardConfirmadoNoPeriodo(c, 'contrato_assinado', 'contrato_assinado_em', sinceMs)) {
        contratosAssinados += 1;
      }
    }
    taxaComiteVirandoContrato = {
      comitesAprovados,
      contratosAssinados,
      percentual:
        comitesAprovados === 0 ? null : (contratosAssinados / comitesAprovados) * 100,
    };
  } catch {
    taxaComiteVirandoContrato = null;
  }

  const temAlgum =
    taxaAprovacaoComite != null ||
    perdaDecisao != null ||
    tempoOpcaoAteComite != null ||
    moniCapitalPctContrato != null ||
    taxaComiteVirandoContrato != null;

  if (!temAlgum) return null;

  return {
    taxaAprovacaoComite,
    perdaDecisao,
    tempoOpcaoAteComite,
    moniCapitalPctContrato,
    taxaComiteVirandoContrato,
  };
}
