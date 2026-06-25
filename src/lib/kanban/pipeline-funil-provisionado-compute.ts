import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import {
  adicionarDiasCorridos,
  adicionarDiasUteis,
  parseIsoDateOnlyLocal,
  type SlaTipo,
} from '@/lib/dias-uteis';
import type {
  PipelineCardRow,
  PipelineEsteiraHistoricoPorCard,
  PipelineFranqueadoUnidade,
  PipelineFunilMesBarSegment,
  PipelineFunilMesUnidadeRow,
  PipelineFunilProvisionadoColuna,
  PipelineFunilProvisionadoEtapaKey,
  PipelineFunilProvisionadoHorizonte,
  PipelineFunilProvisionadoRede,
} from '@/lib/kanban/pipeline-cards-types';
import { fkFranqueadoPipeline } from '@/lib/kanban/pipeline-cards-utils';
import {
  ESTEIRA_COLUNAS,
  computarDatasEsteira,
  extrairHistoricoDeSaida,
  parseEnteredFaseAtEsteira,
  resolverColunaEsteira,
  type CelulaEsteira,
} from '@/lib/kanban/pipeline-esteira-datas';
import {
  conversionPct,
  formatFunilMesPct,
} from '@/lib/kanban/pipeline-funil-mes-compute';
import { excluirFranquiaDosGraficosVisaoGeral } from '@/lib/rede-visibilidade-franqueado';

const ESTEIRA_KANBAN_IDS = [KANBAN_IDS.STEP_ONE, KANBAN_IDS.PORTFOLIO, KANBAN_IDS.OPERACOES] as const;

const UNIDADE_BAR_COLORS = [
  'var(--moni-navy-800)',
  'var(--moni-green-800)',
  'var(--moni-earth-800)',
  'var(--moni-gold-400)',
  'var(--moni-navy-400)',
  'var(--moni-green-400)',
  'var(--moni-earth-400)',
] as const;

const ETAPAS_PROVISIONADO: { key: PipelineFunilProvisionadoEtapaKey; label: string }[] = [
  { key: 'hipoteses', label: 'Hipóteses' },
  { key: 'opcao', label: 'Opção' },
  { key: 'comite', label: 'Comitê' },
  { key: 'aprovacao_prefeitura', label: 'Aprovação na Prefeitura' },
  { key: 'em_obra', label: 'Em Obra' },
  { key: 'obras_finalizadas', label: 'Obras Finalizadas' },
];

const SLUG_ESTEIRA_POR_ETAPA: Partial<Record<PipelineFunilProvisionadoEtapaKey, string>> = {
  hipoteses: 'hipoteses',
  comite: 'step_5',
  aprovacao_prefeitura: 'aprovacao_prefeitura',
  em_obra: 'em_obra',
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseData(iso: string | null | undefined): Date | null {
  const p = parseIsoDateOnlyLocal(iso?.slice(0, 10) ?? null);
  return p ? startOfDay(p) : null;
}

function addDiasPorTipo(base: Date, dias: number, tipo: SlaTipo): Date {
  const normalized = startOfDay(base);
  if (dias <= 0) return normalized;
  return tipo === 'corridos' ? adicionarDiasCorridos(normalized, dias) : adicionarDiasUteis(normalized, dias);
}

function dataCelulaEsteira(datas: Record<string, CelulaEsteira>, slug: string): Date | null {
  const cell = datas[slug];
  return cell?.date ? startOfDay(cell.date) : null;
}

function anchorDateParaFaseId(faseId: string, datas: Record<string, CelulaEsteira>): Date | null {
  const col = ESTEIRA_COLUNAS.find((c) => c.faseId === faseId);
  if (col) return dataCelulaEsteira(datas, col.slug);
  return null;
}

function resolverDataOpcao(card: PipelineCardRow, datas: Record<string, CelulaEsteira>): Date | null {
  const modo = card.prazo_opcao_modo;
  if (modo === 'data') {
    return parseData(card.prazo_opcao_data);
  }
  if (modo === 'fase' && card.prazo_opcao_dias && card.prazo_opcao_dias > 0) {
    const faseId = String(card.prazo_opcao_fase_id ?? '').trim();
    const anchor = faseId ? anchorDateParaFaseId(faseId, datas) : null;
    if (anchor) {
      return addDiasPorTipo(anchor, card.prazo_opcao_dias, card.prazo_opcao_sla_tipo ?? 'uteis');
    }
  }

  const comite = dataCelulaEsteira(datas, 'step_5');
  const hipoteses = dataCelulaEsteira(datas, 'hipoteses');
  if (comite && hipoteses) {
    const mid = new Date((hipoteses.getTime() + comite.getTime()) / 2);
    return startOfDay(mid);
  }
  return comite ?? hipoteses ?? dataCelulaEsteira(datas, 'step_6');
}

function resolverDataObrasFinalizadas(datas: Record<string, CelulaEsteira>): Date | null {
  const emObra = dataCelulaEsteira(datas, 'em_obra');
  if (!emObra) return null;
  const col = ESTEIRA_COLUNAS.find((c) => c.slug === 'em_obra');
  const sla = col?.sla ?? 180;
  const tipo = col?.tipo ?? 'corridos';
  return addDiasPorTipo(emObra, sla, tipo);
}

function resolverDataProvisionada(
  card: PipelineCardRow,
  key: PipelineFunilProvisionadoEtapaKey,
  datas: Record<string, CelulaEsteira>,
): Date | null {
  const slug = SLUG_ESTEIRA_POR_ETAPA[key];
  if (key === 'opcao') return resolverDataOpcao(card, datas);
  if (key === 'aprovacao_prefeitura') {
    return parseData(card.prev_aprovacao_prefeitura) ?? (slug ? dataCelulaEsteira(datas, slug) : null);
  }
  if (key === 'em_obra') {
    return parseData(card.prev_inicio_obra) ?? (slug ? dataCelulaEsteira(datas, slug) : null);
  }
  if (key === 'obras_finalizadas') {
    const real = parseData(card.obra_finalizada_em);
    if (real) return real;
    return resolverDataObrasFinalizadas(datas);
  }
  return slug ? dataCelulaEsteira(datas, slug) : null;
}

function etapaFechada(
  card: PipelineCardRow,
  key: PipelineFunilProvisionadoEtapaKey,
  ordemAtual: number,
): boolean {
  switch (key) {
    case 'hipoteses':
      return ordemAtual > 3;
    case 'opcao':
      return card.opcao_assinada === true;
    case 'comite':
      return card.comite_aprovado === true;
    case 'aprovacao_prefeitura':
      return card.prefeitura_aprovada === true;
    case 'em_obra':
      return card.obra_iniciada === true;
    case 'obras_finalizadas':
      return card.obra_finalizada === true;
    default:
      return false;
  }
}

function dentroHorizonte(data: Date, hoje: Date, horizonteDias: number): boolean {
  const limite = new Date(hoje);
  limite.setDate(limite.getDate() + horizonteDias);
  limite.setHours(23, 59, 59, 999);
  return data <= limite;
}

type CardProvisionadoCtx = {
  card: PipelineCardRow;
  ordemAtual: number;
  datas: Record<string, CelulaEsteira>;
};

function cardsElegiveis(cards: PipelineCardRow[]): PipelineCardRow[] {
  return cards.filter(
    (c) =>
      !excluirFranquiaDosGraficosVisaoGeral(c.n_franquia) &&
      !c.arquivado &&
      !c.concluido &&
      (ESTEIRA_KANBAN_IDS as readonly string[]).includes(c.kanban_id),
  );
}

function montarContextos(
  cards: PipelineCardRow[],
  historico: PipelineEsteiraHistoricoPorCard,
): CardProvisionadoCtx[] {
  const out: CardProvisionadoCtx[] = [];
  for (const card of cards) {
    const faseCol = resolverColunaEsteira(card);
    if (!faseCol) continue;
    const hist = extrairHistoricoDeSaida(historico[card.id] ?? []);
    const datas = computarDatasEsteira(
      {
        faseId: card.fase_id,
        faseSlug: card.fase_slug,
        enteredFaseAt: parseEnteredFaseAtEsteira(card.entered_fase_at, card.created_at),
        slaAtual: card.fase_sla_dias,
        slaAtualTipo: card.fase_sla_tipo,
      },
      hist,
      faseCol.ordemGlobal,
    );
    out.push({ card, ordemAtual: faseCol.ordemGlobal, datas });
  }
  return out;
}

function cardContaEtapaProvisionada(
  ctx: CardProvisionadoCtx,
  key: PipelineFunilProvisionadoEtapaKey,
  horizonteDias: number,
  hoje: Date,
): boolean {
  if (etapaFechada(ctx.card, key, ctx.ordemAtual)) return false;
  const data = resolverDataProvisionada(ctx.card, key, ctx.datas);
  if (!data) return false;
  return dentroHorizonte(data, hoje, horizonteDias);
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

function contarPorRede(
  contextos: CardProvisionadoCtx[],
  key: PipelineFunilProvisionadoEtapaKey,
  franqueados: PipelineFranqueadoUnidade[],
  horizonteDias: number,
  hoje: Date,
): PipelineFunilMesUnidadeRow[] {
  const porRede = new Map<string, number>();
  for (const ctx of contextos) {
    if (!cardContaEtapaProvisionada(ctx, key, horizonteDias, hoje)) continue;
    const rid = String(ctx.card.rede_franqueado_id ?? '').trim();
    if (!rid) continue;
    porRede.set(rid, (porRede.get(rid) ?? 0) + 1);
  }

  const labelPorRede = new Map(franqueados.map((f) => [f.rede_franqueado_id, fkFranqueadoPipeline(f)]));

  return [...porRede.entries()]
    .map(([redeId, quantidade]) => ({
      redeId,
      label: labelPorRede.get(redeId) ?? redeId.slice(0, 6),
      quantidade,
      dots: Math.min(5, quantidade) as 0 | 1 | 2 | 3 | 4 | 5,
    }))
    .sort((a, b) => b.quantidade - a.quantidade || a.label.localeCompare(b.label, 'pt-BR'));
}

function buildColuna(
  key: PipelineFunilProvisionadoEtapaKey,
  label: string,
  contextos: CardProvisionadoCtx[],
  franqueados: PipelineFranqueadoUnidade[],
  horizonteDias: number,
  hoje: Date,
): PipelineFunilProvisionadoColuna {
  let total = 0;
  for (const ctx of contextos) {
    if (cardContaEtapaProvisionada(ctx, key, horizonteDias, hoje)) total += 1;
  }
  const porUnidade = contarPorRede(contextos, key, franqueados, horizonteDias, hoje);
  const idsComQtd = new Set(porUnidade.map((r) => r.redeId));
  const porUnidadeZeradas = franqueados
    .filter((f) => !idsComQtd.has(f.rede_franqueado_id))
    .map((f) => ({
      redeId: f.rede_franqueado_id,
      label: fkFranqueadoPipeline(f),
      quantidade: 0,
      dots: 0 as const,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));

  return {
    key,
    label,
    total,
    porUnidade,
    porUnidadeZeradas,
    barSegments: barSegmentsFromRows(porUnidade, total),
  };
}

function buildConversoes(colunas: PipelineFunilProvisionadoColuna[]): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < colunas.length - 1; i++) {
    out.push(conversionPct(colunas[i]!.total, colunas[i + 1]!.total));
  }
  return out;
}

export function computeFunilProvisionadoRede(
  cards: PipelineCardRow[],
  franqueados: PipelineFranqueadoUnidade[],
  historico: PipelineEsteiraHistoricoPorCard,
  horizonteDias: PipelineFunilProvisionadoHorizonte = 30,
): PipelineFunilProvisionadoRede {
  const hoje = startOfDay(new Date());
  const elegiveis = cardsElegiveis(cards);
  const franqueadosElegiveis = franqueados.filter((f) => !excluirFranquiaDosGraficosVisaoGeral(f.n_franquia));
  const contextos = montarContextos(elegiveis, historico);

  const colunas = ETAPAS_PROVISIONADO.map((e) =>
    buildColuna(e.key, e.label, contextos, franqueadosElegiveis, horizonteDias, hoje),
  );

  return {
    colunas,
    conversoes: buildConversoes(colunas),
    disponivel: elegiveis.length > 0,
    horizonteDias,
  };
}

export { formatFunilMesPct };
