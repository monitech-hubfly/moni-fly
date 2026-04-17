import { calcularDiasUteis, calcularStatusSLA } from '@/lib/dias-uteis';
import type {
  PainelAtividadeDTO,
  PainelCardDTO,
  PainelFaseDTO,
  PainelPeriodKey,
  PainelRetrocessoDTO,
} from '@/lib/kanban/painel-performance-types';

export function periodSinceMs(key: PainelPeriodKey): number | null {
  if (key === 'all') return null;
  const days = key === '7d' ? 7 : key === '30d' ? 30 : 90;
  return Date.now() - days * 86400000;
}

/** Card entrou no recorte temporal (criação ou conclusão no período). */
export function cardInPeriod(c: PainelCardDTO, sinceMs: number | null): boolean {
  if (sinceMs === null) return true;
  const cr = new Date(c.created_at).getTime();
  if (Number.isFinite(cr) && cr >= sinceMs) return true;
  if (c.concluido_em) {
    const cl = new Date(c.concluido_em).getTime();
    if (Number.isFinite(cl) && cl >= sinceMs) return true;
  }
  return false;
}

export function atividadeInPeriod(a: PainelAtividadeDTO, sinceMs: number | null): boolean {
  if (sinceMs === null) return true;
  const t = new Date(a.created_at).getTime();
  return Number.isFinite(t) && t >= sinceMs;
}

export function hojeMeiaNoite(): Date {
  const h = new Date();
  h.setHours(0, 0, 0, 0);
  return h;
}

export function diasUteisDecorridos(createdAt: string): number {
  const criacao = new Date(createdAt);
  criacao.setHours(0, 0, 0, 0);
  return calcularDiasUteis(criacao, hojeMeiaNoite());
}

export type RetrocessoAgg = {
  cardId: string;
  titulo: string;
  count: number;
  fasesLabel: string;
};

export function aggregateRetrocesso(
  rows: PainelRetrocessoDTO[],
  tituloByCardId: Map<string, string>,
): RetrocessoAgg[] {
  const m = new Map<string, { count: number; lastLabel: string }>();
  for (const r of rows) {
    const d = r.detalhe;
    const label =
      d?.fase_anterior_nome && d?.fase_nova_nome
        ? `${d.fase_anterior_nome} → ${d.fase_nova_nome}`
        : 'Retrocesso de fase';
    const cur = m.get(r.card_id) ?? { count: 0, lastLabel: label };
    cur.count += 1;
    cur.lastLabel = label;
    m.set(r.card_id, cur);
  }
  return [...m.entries()]
    .map(([cardId, v]) => ({
      cardId,
      titulo: tituloByCardId.get(cardId) ?? 'Card',
      count: v.count,
      fasesLabel: v.lastLabel,
    }))
    .sort((a, b) => b.count - a.count);
}

export function isDuvidaTipo(tipo: string | null | undefined): boolean {
  const t = String(tipo ?? '')
    .trim()
    .toLowerCase();
  return t === 'duvida' || t === 'dúvida';
}

export function atividadeAtrasada(a: PainelAtividadeDTO): boolean {
  const st = String(a.status ?? '').toLowerCase();
  if (st === 'concluida' || st === 'cancelada') return false;
  if (!a.data_vencimento) return false;
  const d = new Date(`${a.data_vencimento}T23:59:59`);
  return Number.isFinite(d.getTime()) && d.getTime() < Date.now();
}

export function buildFaseMaps(
  fases: PainelFaseDTO[],
  cardsAtivosFunil: PainelCardDTO[],
): {
  totalPorFase: Map<string, number>;
  atrasadosPorFase: Map<string, number>;
  tempoMedioDiasPorFase: Map<string, number>;
  diasUteisMedioPorFase: Map<string, number>;
  slaPorFase: Map<string, number>;
} {
  const faseById = new Map(fases.map((f) => [f.id, f]));
  const totalPorFase = new Map<string, number>();
  const atrasadosPorFase = new Map<string, number>();
  const somaDiasPorFase = new Map<string, number>();
  const somaDuPorFase = new Map<string, number>();
  const slaPorFase = new Map<string, number>();

  for (const f of fases) {
    totalPorFase.set(f.id, 0);
    atrasadosPorFase.set(f.id, 0);
    somaDiasPorFase.set(f.id, 0);
    somaDuPorFase.set(f.id, 0);
    slaPorFase.set(f.id, f.sla_dias ?? 0);
  }

  for (const c of cardsAtivosFunil) {
    const fid = c.fase_id;
    totalPorFase.set(fid, (totalPorFase.get(fid) ?? 0) + 1);
    const fase = faseById.get(fid);
    const slaDias = fase?.sla_dias ?? 999;
    const created = new Date(c.created_at);
    if (Number.isFinite(created.getTime()) && calcularStatusSLA(created, slaDias).status === 'atrasado') {
      atrasadosPorFase.set(fid, (atrasadosPorFase.get(fid) ?? 0) + 1);
    }
    const diasCal = (Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (Number.isFinite(diasCal)) {
      somaDiasPorFase.set(fid, (somaDiasPorFase.get(fid) ?? 0) + diasCal);
    }
    const du = diasUteisDecorridos(c.created_at);
    somaDuPorFase.set(fid, (somaDuPorFase.get(fid) ?? 0) + du);
  }

  const tempoMedioDiasPorFase = new Map<string, number>();
  const diasUteisMedioPorFase = new Map<string, number>();
  for (const f of fases) {
    const n = totalPorFase.get(f.id) ?? 0;
    tempoMedioDiasPorFase.set(f.id, n > 0 ? (somaDiasPorFase.get(f.id) ?? 0) / n : 0);
    diasUteisMedioPorFase.set(f.id, n > 0 ? (somaDuPorFase.get(f.id) ?? 0) / n : 0);
  }

  return { totalPorFase, atrasadosPorFase, tempoMedioDiasPorFase, diasUteisMedioPorFase, slaPorFase };
}
