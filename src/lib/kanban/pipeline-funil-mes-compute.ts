import { isHipotesesFaseSlug } from '@/lib/kanban/stepone-fase-slugs';
import {
  FUNIL_MES_ETAPA_FASES,
  kanbanIdsFunilMesEtapa,
  slugsFunilMesEtapa,
} from '@/lib/kanban/pipeline-funil-mes-etapas';
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
  PipelineFunilPeriodo,
  PipelineFranqueadoUnidade,
} from '@/lib/kanban/pipeline-cards-types';
import { fkFranqueadoPipeline } from '@/lib/kanban/pipeline-cards-utils';
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
  { key: 'aprovacoes', label: 'Aprovações' },
  { key: 'garantia_transferencia', label: 'Garantia + Transferência' },
  { key: 'aguardando_credito', label: 'Aguardando Crédito' },
  { key: 'obras_iniciadas', label: 'Obras em andamento' },
  { key: 'obras_finalizadas', label: 'Obras finalizadas' },
];

function inicioMesCorrente(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

function inicioTrimestreCorrente(): Date {
  const now = new Date();
  const mesInicioTri = Math.floor(now.getMonth() / 3) * 3;
  return new Date(now.getFullYear(), mesInicioTri, 1, 0, 0, 0, 0);
}

function fimHoje(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
}

export function isNoMesCorrente(iso: string | null | undefined): boolean {
  return isNoPeriodoCorrente(iso, 'mes');
}

export function isNoPeriodoCorrente(
  iso: string | null | undefined,
  periodo: PipelineFunilPeriodo,
): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return false;
  const inicio = periodo === 'mes' ? inicioMesCorrente() : inicioTrimestreCorrente();
  return d >= inicio && d <= fimHoje();
}

export function diaDoMesCorrente(): number {
  return new Date().getDate();
}

export function funilMesFieldsAvailable(cards: PipelineCardRow[]): boolean {
  return cards.some((c) => String(c.kanban_id ?? '').trim() && c.fase_slug);
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

/** Seta de conversão entre etapas — ex.: "42% →" ou "— →". */
export function formatFunilMesConversaoSeta(pct: number | null): string {
  if (pct == null) return '— →';
  return `${formatFunilMesPct(pct)} →`;
}

export function dotCorFunilMesRede(qtd: number): 'verde' | 'cinza' {
  return qtd >= 1 ? 'verde' : 'cinza';
}

export function dotCorUnidadeMetric(qtd: number, indisponivel = false): PipelineFunilMesUnidadeMetric['dotCor'] {
  if (indisponivel) return 'cinza';
  if (qtd >= 1) return 'verde';
  if (diaDoMesCorrente() > 15) return 'vermelho';
  return 'cinza';
}

function cardContaEtapaPorFases(
  c: PipelineCardRow,
  key: PipelineFunilMesEtapaKey,
  periodo: PipelineFunilPeriodo,
): boolean {
  const kanbanIds = kanbanIdsFunilMesEtapa(key);
  const slugs = slugsFunilMesEtapa(key);
  if (!kanbanIds?.length || !slugs?.size) return false;

  const kanbanId = String(c.kanban_id ?? '').trim();
  if (!kanbanIds.includes(kanbanId)) return false;

  const slug = String(c.fase_slug ?? '').trim();
  if (!slug || !slugs.has(slug)) return false;

  return isNoPeriodoCorrente(c.entered_fase_at, periodo);
}

export function cardContaEtapa(
  c: PipelineCardRow,
  key: PipelineFunilMesEtapaKey,
  periodo: PipelineFunilPeriodo = 'mes',
): boolean {
  if (key === 'hipoteses') {
    return isHipotesesFaseSlug(c.fase_slug) && isNoPeriodoCorrente(c.entered_fase_at, periodo);
  }
  const regra = FUNIL_MES_ETAPA_FASES[key];
  if (!regra) return false;
  return cardContaEtapaPorFases(c, key, periodo);
}

/** Etapa indisponível quando não há cards do funil/fase mapeados no dataset. */
function etapaFunilMesIndisponivel(cards: PipelineCardRow[], key: PipelineFunilMesEtapaKey): boolean {
  if (key === 'hipoteses') {
    return !cards.some((c) => isHipotesesFaseSlug(c.fase_slug));
  }
  const regra = FUNIL_MES_ETAPA_FASES[key];
  if (!regra) return true;
  const kanbanSet = new Set(regra.kanbanIds.map((id) => String(id).trim()));
  return !cards.some((c) => {
    const kid = String(c.kanban_id ?? '').trim();
    if (!kanbanSet.has(kid)) return false;
    return Boolean(String(c.fase_slug ?? '').trim());
  });
}

function cardsElegiveisFunilMes(cards: PipelineCardRow[]): PipelineCardRow[] {
  return cards.filter((c) => !excluirFranquiaDosGraficosVisaoGeral(c.n_franquia));
}

function contarPorRede(
  cards: PipelineCardRow[],
  key: PipelineFunilMesEtapaKey,
  franqueados: PipelineFranqueadoUnidade[],
  periodo: PipelineFunilPeriodo,
): PipelineFunilMesUnidadeRow[] {
  const porRede = new Map<string, number>();
  for (const c of cards) {
    if (!cardContaEtapa(c, key, periodo)) continue;
    const rid = String(c.rede_franqueado_id ?? '').trim();
    if (!rid) continue;
    porRede.set(rid, (porRede.get(rid) ?? 0) + 1);
  }

  const labelPorRede = new Map(franqueados.map((f) => [f.rede_franqueado_id, fkFranqueadoPipeline(f)]));

  return [...porRede.entries()]
    .map(([redeId, quantidade]) => {
      const { filled } = quantidadeParaDots(quantidade);
      return {
        redeId,
        label: labelPorRede.get(redeId) ?? redeId.slice(0, 6),
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
  periodo: PipelineFunilPeriodo,
): PipelineFunilMesColuna {
  const totalIndisponivel = etapaFunilMesIndisponivel(cards, key);
  let total = 0;
  if (!totalIndisponivel) {
    for (const c of cards) {
      if (cardContaEtapa(c, key, periodo)) total += 1;
    }
  }
  const porUnidade = totalIndisponivel ? [] : contarPorRede(cards, key, franqueados, periodo);
  const idsComQtd = new Set(porUnidade.map((r) => r.redeId));
  const porUnidadeZeradas: PipelineFunilMesUnidadeRow[] = totalIndisponivel
    ? []
    : franqueados
        .filter((f) => !idsComQtd.has(f.rede_franqueado_id))
        .map((f) => ({
          redeId: f.rede_franqueado_id,
          label: fkFranqueadoPipeline(f),
          quantidade: 0,
          dots: 0 as PipelineFunilMesDotNivel,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));

  return {
    key,
    label,
    total,
    totalIndisponivel,
    porUnidade,
    porUnidadeZeradas,
    barSegments: barSegmentsFromRows(porUnidade, total),
  };
}

function buildConversoes(
  colunas: Array<{ total: number; totalIndisponivel?: boolean }>,
): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < colunas.length - 1; i++) {
    const from = colunas[i]!;
    const to = colunas[i + 1]!;
    if (from.totalIndisponivel || to.totalIndisponivel) {
      out.push(null);
      continue;
    }
    out.push(conversionPct(from.total, to.total));
  }
  return out;
}

function compactValue(compact: PipelineFunilMesCompact, key: PipelineFunilMesEtapaKey): number {
  switch (key) {
    case 'hipoteses':
      return compact.hipoteses;
    case 'opcoes':
      return compact.opcoes;
    case 'comites':
      return compact.comites;
    case 'contratos':
      return compact.contratos;
    case 'aprovacoes':
      return compact.aprovacoes;
    case 'garantia_transferencia':
      return compact.garantiaTransferencia;
    case 'aguardando_credito':
      return compact.aguardandoCredito;
    case 'obras_iniciadas':
      return compact.obrasIniciadas;
    case 'obras_finalizadas':
      return compact.obrasFinalizadas;
  }
}

export function computeFunilMesCompact(cards: PipelineCardRow[]): PipelineFunilMesCompact {
  const elegiveis = cardsElegiveisFunilMes(cards);
  return {
    hipoteses: elegiveis.filter((c) => cardContaEtapa(c, 'hipoteses')).length,
    opcoes: elegiveis.filter((c) => cardContaEtapa(c, 'opcoes')).length,
    comites: elegiveis.filter((c) => cardContaEtapa(c, 'comites')).length,
    contratos: elegiveis.filter((c) => cardContaEtapa(c, 'contratos')).length,
    aprovacoes: elegiveis.filter((c) => cardContaEtapa(c, 'aprovacoes')).length,
    garantiaTransferencia: elegiveis.filter((c) => cardContaEtapa(c, 'garantia_transferencia')).length,
    aguardandoCredito: elegiveis.filter((c) => cardContaEtapa(c, 'aguardando_credito')).length,
    obrasIniciadas: elegiveis.filter((c) => cardContaEtapa(c, 'obras_iniciadas')).length,
    obrasFinalizadas: elegiveis.filter((c) => cardContaEtapa(c, 'obras_finalizadas')).length,
  };
}

export function computeFunilMesRede(
  cards: PipelineCardRow[],
  franqueados: PipelineFranqueadoUnidade[],
  periodo: PipelineFunilPeriodo = 'mes',
): PipelineFunilMesRede {
  const elegiveis = cardsElegiveisFunilMes(cards);
  const franqueadosElegiveis = franqueados.filter((f) => !excluirFranquiaDosGraficosVisaoGeral(f.n_franquia));

  const colunas = ETAPAS.map((e) => buildColuna(e.key, e.label, elegiveis, franqueadosElegiveis, periodo));

  return {
    colunas,
    conversoes: buildConversoes(colunas),
    disponivel: elegiveis.length > 0 || funilMesFieldsAvailable(cards),
    periodo,
  };
}

export function computeFunilMesUnidade(cards: PipelineCardRow[]): PipelineFunilMesUnidade {
  const elegiveis = cardsElegiveisFunilMes(cards);
  const compact = computeFunilMesCompact(elegiveis);

  const metricas: PipelineFunilMesUnidadeMetric[] = ETAPAS.map((e) => {
    const totalIndisponivel = etapaFunilMesIndisponivel(cards, e.key);
    const total = totalIndisponivel ? 0 : compactValue(compact, e.key);
    const { filled } = quantidadeParaDots(total);
    return {
      key: e.key,
      label: e.label,
      total,
      totalIndisponivel,
      dots: filled,
      dotCor: dotCorUnidadeMetric(total, totalIndisponivel),
    };
  });

  return {
    metricas,
    conversoes: buildConversoes(metricas),
    disponivel: elegiveis.length > 0 || funilMesFieldsAvailable(cards),
  };
}
