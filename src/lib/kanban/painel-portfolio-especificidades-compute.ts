import { calcularDiasUteis } from '@/lib/dias-uteis';
import { FASE_SLUGS, PORTFOLIO_FASES_CONFIRMACAO_SAIDA } from '@/lib/constants/kanban-ids';
import type {
  PainelCardDTO,
  PainelFaseDTO,
  PainelHistoricoMovimentoDTO,
  PainelPeriodKey,
} from '@/lib/kanban/painel-performance-types';

const KW_PERDA_INTERNA = ['credito', 'produto', 'viabilidade', 'comite'] as const;
const KW_PERDA_EXTERNA = ['desistencia', 'terrenista', 'parceiro'] as const;

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

function cardAtivoOuArquivado(c: PainelCardDTO): boolean {
  return !c.concluido;
}

function normalizeMotivo(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

type OrigemPerda = 'interna' | 'externa' | 'outros';

function classificarOrigemPerda(motivoRaw: string): OrigemPerda {
  const m = normalizeMotivo(String(motivoRaw ?? '').trim());
  if (!m) return 'outros';
  if (KW_PERDA_INTERNA.some((kw) => m.includes(kw))) return 'interna';
  if (KW_PERDA_EXTERNA.some((kw) => m.includes(kw))) return 'externa';
  return 'outros';
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
    linhas: Array<{ origem: string; quantidade: number; percentual: number | null }>;
    totalArquivados: number;
  } | null;
  tempoOpcaoAteComite: {
    medianaDiasUteis: number | null;
    p90DiasUteis: number | null;
    amostras: number;
    insuficiente: boolean;
  } | null;
  moniCapitalPctContrato: {
    emCaptacaoMoniCapital: number;
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
  const faseStep7Ids = new Set(faseIdsPorSlugs(input.fases, [FASE_SLUGS.STEP_7]));
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
      const origem = classificarOrigemPerda(String(c.motivo_arquivamento ?? ''));
      if (origem === 'interna') internaMoni += 1;
      else if (origem === 'externa') externaTerrenista += 1;
      else outros += 1;
    }
    const totalArquivados = internaMoni + externaTerrenista + outros;
    if (totalArquivados > 0) {
      const pct = (n: number) => (totalArquivados === 0 ? null : (n / totalArquivados) * 100);
      perdaDecisao = {
        totalArquivados,
        linhas: [
          { origem: 'Interna (Moní reprova)', quantidade: internaMoni, percentual: pct(internaMoni) },
          {
            origem: 'Externa (terrenista / franqueado desiste)',
            quantidade: externaTerrenista,
            percentual: pct(externaTerrenista),
          },
          { origem: 'Outros', quantidade: outros, percentual: pct(outros) },
        ],
      };
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
    const insuficiente = tempos.length < 3;
    tempoOpcaoAteComite = {
      medianaDiasUteis: insuficiente ? null : median(tempos),
      p90DiasUteis: insuficiente ? null : percentile(tempos, 90),
      amostras: tempos.length,
      insuficiente,
    };
  } catch {
    tempoOpcaoAteComite = null;
  }

  let moniCapitalPctContrato: PainelPortfolioEspecificidades['moniCapitalPctContrato'] = null;
  try {
    let chegaramContrato = 0;
    let emCaptacaoMoniCapital = 0;
    for (const c of input.cards) {
      if (cardVisitouFase(c, faseStep7Ids, historicoPorCard)) {
        chegaramContrato += 1;
      }
      if (cardAtivoOuArquivado(c) && faseCaptacaoCapitalIds.has(c.fase_id)) {
        emCaptacaoMoniCapital += 1;
      }
    }
    moniCapitalPctContrato = {
      chegaramContrato,
      emCaptacaoMoniCapital,
      percentual:
        chegaramContrato === 0 ? null : (emCaptacaoMoniCapital / chegaramContrato) * 100,
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
