import { HIPOTESES_FASE_SLUGS } from '@/lib/kanban/stepone-fase-slugs';
import type {
  PipelineCardRow,
  PipelineFunilMesBarSegment,
  PipelineFunilMesColuna,
  PipelineFunilMesCompact,
  PipelineFunilMesDotNivel,
  PipelineFunilMesEtapaKey,
  PipelineFunilMesRede,
  PipelineFunilMesUnidade,
  PipelineFunilMesUnidadeMetric,
  PipelineFunilMesUnidadeRow,
  PipelineFranqueadoUnidade,
} from '@/lib/kanban/pipeline-cards-types';
import { labelFranqueadoPipeline } from '@/lib/kanban/pipeline-cards-utils';
import { excluirFranquiaDosGraficosVisaoGeral } from '@/lib/rede-visibilidade-franqueado';

const UNIDADE_BAR_COLORS = [
  'var(--moni-navy-800)',
  'var(--moni-green-800)',
  'var(--moni-earth-800)',
  'var(--moni-gold-400)',
  'var(--moni-navy-400)',
  'var(--moni-green-400)',
  'var(--moni-earth-400)',
] as const;

const ETAPAS: { key: PipelineFunilMesEtapaKey; label: string }[] = [
  { key: 'hipoteses', label: 'Hipóteses' },
  { key: 'opcoes', label: 'Opções' },
  { key: 'comites', label: 'Comitês' },
  { key: 'contratos', label: 'Contratos' },
];

function inicioMesCorrente(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

function fimHoje(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
}

export function isNoMesCorrente(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return false;
  return d >= inicioMesCorrente() && d <= fimHoje();
}

export function diaDoMesCorrente(): number {
  return new Date().getDate();
}

function isHipotesesFaseSlug(slug: string | null | undefined): boolean {
  const s = String(slug ?? '').trim();
  if (!s) return false;
  return (HIPOTESES_FASE_SLUGS as readonly string[]).includes(s);
}

export function funilMesFieldsAvailable(cards: PipelineCardRow[]): boolean {
  return cards.some(
    (c) =>
      c.opcao_assinada !== undefined ||
      c.comite_aprovado !== undefined ||
      c.contrato_assinado !== undefined,
  );
}

export function quantidadeParaDots(qtd: number): { filled: PipelineFunilMesDotNivel; showPlus: boolean } {
  if (qtd <= 0) return { filled: 0, showPlus: false };
  if (qtd >= 5) return { filled: 5, showPlus: true };
  return { filled: qtd as PipelineFunilMesDotNivel, showPlus: false };
}

export function conversionPct(from: number, to: number): number | null {
  if (from <= 0) return null;
  return (to / from) * 100;
}

export function formatFunilMesPct(pct: number | null): string {
  if (pct == null) return '—';
  return `${pct.toFixed(0).replace('.', ',')}%`;
}

export function dotCorUnidadeMetric(qtd: number): PipelineFunilMesUnidadeMetric['dotCor'] {
  if (qtd >= 1) return 'verde';
  if (diaDoMesCorrente() > 15) return 'vermelho';
  return 'cinza';
}

function cardContaEtapa(c: PipelineCardRow, key: PipelineFunilMesEtapaKey): boolean {
  if (key === 'hipoteses') {
    return isHipotesesFaseSlug(c.fase_slug) && isNoMesCorrente(c.entered_fase_at);
  }
  if (key === 'opcoes') {
    return c.opcao_assinada === true && isNoMesCorrente(c.opcao_assinada_em);
  }
  if (key === 'comites') {
    return c.comite_aprovado === true && isNoMesCorrente(c.comite_aprovado_em);
  }
  return c.contrato_assinado === true && isNoMesCorrente(c.contrato_assinado_em);
}

function cardsElegiveisFunilMes(cards: PipelineCardRow[]): PipelineCardRow[] {
  return cards.filter((c) => !excluirFranquiaDosGraficosVisaoGeral(c.n_franquia));
}

function contarPorRede(
  cards: PipelineCardRow[],
  key: PipelineFunilMesEtapaKey,
  franqueados: PipelineFranqueadoUnidade[],
): PipelineFunilMesUnidadeRow[] {
  const porRede = new Map<string, number>();
  for (const c of cards) {
    if (!cardContaEtapa(c, key)) continue;
    const rid = String(c.rede_franqueado_id ?? '').trim();
    if (!rid) continue;
    porRede.set(rid, (porRede.get(rid) ?? 0) + 1);
  }

  const labelPorRede = new Map(franqueados.map((f) => [f.rede_franqueado_id, labelFranqueadoPipeline(f)]));

  return [...porRede.entries()]
    .map(([redeId, quantidade]) => {
      const { filled } = quantidadeParaDots(quantidade);
      return {
        redeId,
        label: labelPorRede.get(redeId) ?? redeId.slice(0, 8),
        quantidade,
        dots: filled,
      };
    })
    .sort((a, b) => b.quantidade - a.quantidade || a.label.localeCompare(b.label, 'pt-BR'));
}

function barSegmentsFromRows(rows: PipelineFunilMesUnidadeRow[], total: number): PipelineFunilMesBarSegment[] {
  if (total <= 0) return [];
  return rows.map((row, idx) => ({
    redeId: row.redeId,
    label: row.label,
    quantidade: row.quantidade,
    pct: (row.quantidade / total) * 100,
    cor: UNIDADE_BAR_COLORS[idx % UNIDADE_BAR_COLORS.length]!,
  }));
}

function buildColuna(
  key: PipelineFunilMesEtapaKey,
  label: string,
  cards: PipelineCardRow[],
  franqueados: PipelineFranqueadoUnidade[],
): PipelineFunilMesColuna {
  let total = 0;
  for (const c of cards) {
    if (cardContaEtapa(c, key)) total += 1;
  }
  const porUnidade = contarPorRede(cards, key, franqueados);
  return {
    key,
    label,
    total,
    porUnidade,
    barSegments: barSegmentsFromRows(porUnidade, total),
  };
}

export function computeFunilMesCompact(cards: PipelineCardRow[]): PipelineFunilMesCompact {
  const elegiveis = cardsElegiveisFunilMes(cards);
  return {
    hipoteses: elegiveis.filter((c) => cardContaEtapa(c, 'hipoteses')).length,
    opcoes: elegiveis.filter((c) => cardContaEtapa(c, 'opcoes')).length,
    comites: elegiveis.filter((c) => cardContaEtapa(c, 'comites')).length,
    contratos: elegiveis.filter((c) => cardContaEtapa(c, 'contratos')).length,
  };
}

export function computeFunilMesRede(
  cards: PipelineCardRow[],
  franqueados: PipelineFranqueadoUnidade[],
): PipelineFunilMesRede {
  const elegiveis = cardsElegiveisFunilMes(cards);
  const franqueadosElegiveis = franqueados.filter((f) => !excluirFranquiaDosGraficosVisaoGeral(f.n_franquia));

  const colunas = ETAPAS.map((e) => buildColuna(e.key, e.label, elegiveis, franqueadosElegiveis));
  const totals = colunas.map((c) => c.total);

  return {
    colunas,
    conversoes: [
      conversionPct(totals[0] ?? 0, totals[1] ?? 0),
      conversionPct(totals[1] ?? 0, totals[2] ?? 0),
      conversionPct(totals[2] ?? 0, totals[3] ?? 0),
    ],
    disponivel: true,
  };
}

export function computeFunilMesUnidade(cards: PipelineCardRow[]): PipelineFunilMesUnidade {
  const elegiveis = cardsElegiveisFunilMes(cards);
  const compact = computeFunilMesCompact(elegiveis);

  const metricas: PipelineFunilMesUnidadeMetric[] = ETAPAS.map((e) => {
    const total =
      e.key === 'hipoteses'
        ? compact.hipoteses
        : e.key === 'opcoes'
          ? compact.opcoes
          : e.key === 'comites'
            ? compact.comites
            : compact.contratos;
    const { filled } = quantidadeParaDots(total);
    return {
      key: e.key,
      label: e.label,
      total,
      dots: filled,
      dotCor: dotCorUnidadeMetric(total),
    };
  });

  return {
    metricas,
    conversoes: [
      conversionPct(compact.hipoteses, compact.opcoes),
      conversionPct(compact.opcoes, compact.comites),
      conversionPct(compact.comites, compact.contratos),
    ],
    disponivel: true,
  };
}
