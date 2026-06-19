import { calcularDiasUteis } from '@/lib/dias-uteis';
import {
  buildConversaoContext,
  cardConverteuPorRegras,
} from '@/lib/kanban/painel-conversao-classify';
import { MOTIVO_ARQUIVAMENTO_SEM_INFORMADO } from '@/lib/kanban/painel-motivo-arquivamento';
import { periodSinceMs } from '@/lib/kanban/painel-performance-compute';
import { parseAreaAtuacao } from '@/lib/rede-area-atuacao';
import type {
  ConversionFunnelTreeNode,
  GargaloScoreFase,
  PainelCardDTO,
  PainelChamadoUnificadoDTO,
  PainelFaseDTO,
  PainelPerformanceResult,
  PainelPeriodKey,
  PainelRetrocessoDTO,
} from '@/lib/kanban/painel-performance-types';

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

export function periodWeeks(period: PainelPeriodKey): number | null {
  if (period === '7d') return 1;
  if (period === '30d') return 30 / 7;
  if (period === '90d') return 90 / 7;
  return null;
}

export type PainelFluxoDerivado = {
  concluidosPorSemana: number | null;
  entradasPorSemana: number | null;
  cycleTimeMediano: number | null;
  cycleTimeP90: number | null;
  porFase: Array<{
    faseId: string;
    faseNome: string;
    medianaDias: number | null;
    vsSla: string;
    retornosFase: number;
  }>;
};

export function deriveFluxoMetrics(
  analise: PainelPerformanceResult,
  cards: PainelCardDTO[],
  retrocessoRows: PainelRetrocessoDTO[],
  period: PainelPeriodKey,
): PainelFluxoDerivado {
  const sinceMs = periodSinceMs(period);
  const semanas = periodWeeks(period);

  const concluidos = cards.filter((c) => {
    if (!c.concluido || !c.concluido_em) return false;
    if (sinceMs == null) return true;
    const t = new Date(c.concluido_em).getTime();
    return Number.isFinite(t) && t >= sinceMs;
  });

  const entradas =
    sinceMs == null
      ? cards.length
      : cards.filter((c) => {
          const t = new Date(c.created_at).getTime();
          return Number.isFinite(t) && t >= sinceMs;
        }).length;

  const cycleTimes = concluidos
    .map((c) => {
      const ini = new Date(c.created_at).getTime();
      const fim = new Date(c.concluido_em!).getTime();
      if (!Number.isFinite(ini) || !Number.isFinite(fim) || fim <= ini) return null;
      const d0 = new Date(c.created_at);
      d0.setHours(0, 0, 0, 0);
      const d1 = new Date(c.concluido_em!);
      d1.setHours(0, 0, 0, 0);
      return calcularDiasUteis(d0, d1);
    })
    .filter((n): n is number => n != null && n >= 0);

  const retornoPorFase = new Map<string, number>();
  for (const r of retrocessoRows) {
    const faseId = String(r.detalhe?.fase_nova_id ?? '').trim();
    if (!faseId) continue;
    retornoPorFase.set(faseId, (retornoPorFase.get(faseId) ?? 0) + 1);
  }

  const porFase = analise.operacao.porFase.map((f) => {
    const sla = f.slaDias;
    const med = f.diasUteisMedio > 0 ? f.diasUteisMedio : null;
    let vsSla = '—';
    if (sla != null && sla > 0 && med != null) {
      if (med <= sla) vsSla = 'Dentro';
      else if (med <= sla * 1.25) vsSla = 'Atenção';
      else vsSla = 'Acima';
    }
    return {
      faseId: f.faseId,
      faseNome: f.faseNome,
      medianaDias: med,
      vsSla,
      retornosFase: retornoPorFase.get(f.faseId) ?? 0,
    };
  });

  return {
    concluidosPorSemana: semanas != null && semanas > 0 ? concluidos.length / semanas : null,
    entradasPorSemana: semanas != null && semanas > 0 ? entradas / semanas : null,
    cycleTimeMediano: median(cycleTimes),
    cycleTimeP90: percentile(cycleTimes, 90),
    porFase,
  };
}

export type PainelQualidadeDerivado = {
  semPrazo: number;
  semResponsavel: number;
  camposIncompletos: number;
  arquivSemMotivo: number;
  alertaAtivo: boolean;
  alertaMensagem: string;
  porResponsavel: Array<{ nome: string; total: number }>;
  porFase: Array<{ faseId: string; faseNome: string; total: number }>;
};

function cardAtivo(c: PainelCardDTO): boolean {
  return !c.arquivado && !c.concluido;
}

/** Campos de negócio do card (exclui responsável — contado em Sem responsável). */
function cardTemCamposIncompletos(c: PainelCardDTO): boolean {
  const titulo = String(c.titulo ?? '').trim();
  return titulo.length === 0 || titulo === '(sem título)';
}

export function deriveQualidadeMetrics(
  cards: PainelCardDTO[],
  chamados: PainelChamadoUnificadoDTO[],
  fases: PainelFaseDTO[],
  analise: PainelPerformanceResult,
): PainelQualidadeDerivado {
  const faseNome = new Map(fases.map((f) => [f.id, f.nome]));
  const ativos = cards.filter(cardAtivo);

  const semResponsavel = ativos.filter((c) => !String(c.responsavel_fase_id ?? '').trim()).length;

  const chamadosAbertos = chamados.filter((c) => c.aberto);
  const semPrazo = chamadosAbertos.filter((c) => !String(c.data_vencimento ?? '').trim()).length;

  const camposIncompletos = ativos.filter(cardTemCamposIncompletos).length;

  const arquivSemMotivo = analise.arquivamento.perdas.semMotivoInformado;
  const pctSemMotivo = analise.arquivamento.perdas.pctSemMotivo ?? 0;

  const respIssues = new Map<string, number>();
  const faseIssues = new Map<string, number>();

  for (const c of ativos) {
    const issues =
      (!String(c.responsavel_fase_id ?? '').trim() ? 1 : 0) +
      (cardTemCamposIncompletos(c) ? 1 : 0);
    if (issues === 0) continue;
    const rn = c.responsavel_fase_nome?.trim() || 'Sem responsável';
    respIssues.set(rn, (respIssues.get(rn) ?? 0) + issues);
    const fn = faseNome.get(c.fase_id) ?? 'Fase';
    faseIssues.set(c.fase_id, (faseIssues.get(c.fase_id) ?? 0) + issues);
  }

  for (const ch of chamadosAbertos) {
    if (String(ch.data_vencimento ?? '').trim()) continue;
    const card = cards.find((c) => c.id === ch.cardId);
    const fn = card ? (faseNome.get(card.fase_id) ?? 'Fase') : 'Fase';
    faseIssues.set(card?.fase_id ?? fn, (faseIssues.get(card?.fase_id ?? fn) ?? 0) + 1);
  }

  const alertaSemMotivo = pctSemMotivo > 20 && arquivSemMotivo > 0;
  const alertaCards = semResponsavel > 0 || semPrazo > 0;
  const alertaAtivo = alertaSemMotivo || alertaCards;

  let alertaMensagem = '';
  if (alertaSemMotivo && alertaCards) {
    alertaMensagem =
      'Mais de 20% dos arquivamentos sem motivo e cards/chamados com lacunas de prazo ou responsável.';
  } else if (alertaSemMotivo) {
    alertaMensagem = 'Mais de 20% dos arquivamentos no recorte estão sem motivo informado.';
  } else if (alertaCards) {
    alertaMensagem = 'Há cards ativos sem responsável ou chamados abertos sem prazo definido.';
  }

  return {
    semPrazo,
    semResponsavel,
    camposIncompletos,
    arquivSemMotivo,
    alertaAtivo,
    alertaMensagem,
    porResponsavel: [...respIssues.entries()]
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8),
    porFase: [...faseIssues.entries()]
      .map(([faseId, total]) => ({
        faseId,
        faseNome: faseNome.get(faseId) ?? faseId,
        total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8),
  };
}

export function maxFunnelBar(nodes: ConversionFunnelTreeNode[]): number {
  return Math.max(1, ...nodes.map((n) => n.alcancaram));
}

export function arquivamentoMomentoLabel(
  antes: number,
  na: number,
  depois: number,
): string {
  const parts: string[] = [];
  if (antes > 0) parts.push('Antes conv.');
  if (na > 0) parts.push('Na conv.');
  if (depois > 0) parts.push('Após conv.');
  return parts.length > 0 ? parts.join(' · ') : '—';
}

export function semMotivoNaFase(
  analise: PainelPerformanceResult,
  faseId: string,
): number {
  const row = analise.arquivamento.motivos.porFase.find((f) => f.faseId === faseId);
  return row?.motivos.find((m) => m.motivo === MOTIVO_ARQUIVAMENTO_SEM_INFORMADO)?.total ?? 0;
}

export type InsightSeveridade = 'critico' | 'atencao' | 'positivo';

export function insightSeveridade(tipo: string): InsightSeveridade {
  if (
    tipo === 'conversao_destaque' ||
    tipo === 'oportunidades_concentradas' ||
    tipo === 'tempo_medio_variacao'
  ) {
    return 'positivo';
  }
  if (
    tipo === 'inatividade_critica' ||
    tipo === 'arquivamento_perda_funil' ||
    tipo === 'chamados_gargalo' ||
    tipo === 'arquivamento_sem_motivo'
  ) {
    return 'critico';
  }
  return 'atencao';
}

export function tempoMedioConversaoPorResponsavel(
  cards: PainelCardDTO[],
  profiles: Record<string, string>,
): Map<string, { nome: string; mediana: number | null }> {
  const buckets = new Map<string, number[]>();
  for (const c of cards) {
    if (!c.concluido || !c.concluido_em) continue;
    const rid = c.responsavel_fase_id ?? '__sem__';
    const ini = new Date(c.created_at);
    const fim = new Date(c.concluido_em);
    ini.setHours(0, 0, 0, 0);
    fim.setHours(0, 0, 0, 0);
    const dias = calcularDiasUteis(ini, fim);
    const list = buckets.get(rid) ?? [];
    list.push(dias);
    buckets.set(rid, list);
  }
  const out = new Map<string, { nome: string; mediana: number | null }>();
  for (const [rid, nums] of buckets) {
    const nome =
      rid === '__sem__'
        ? 'Sem responsável'
        : profiles[rid] ?? cards.find((c) => c.responsavel_fase_id === rid)?.responsavel_fase_nome ?? '—';
    out.set(rid, { nome, mediana: median(nums) });
  }
  return out;
}

export function gargalosVisiveis(ranking: GargaloScoreFase[]): GargaloScoreFase[] {
  return ranking
    .filter((g) => g.classificacao === 'critico' || g.classificacao === 'atencao')
    .sort((a, b) => b.score - a.score);
}

export function gargalosBaixos(ranking: GargaloScoreFase[]): GargaloScoreFase[] {
  return ranking.filter((g) => g.classificacao === 'baixo').sort((a, b) => b.score - a.score);
}

/** Contagem de chamados em pastelaria por fase do card vinculado. */
export function pastelariaPorFaseId(
  chamados: PainelChamadoUnificadoDTO[],
  cards: PainelCardDTO[],
): Map<string, number> {
  const cardFase = new Map(cards.map((c) => [c.id, c.fase_id]));
  const out = new Map<string, number>();
  for (const ch of chamados) {
    if (!ch.aberto || !ch.emPastelaria) continue;
    const faseId = cardFase.get(ch.cardId);
    if (!faseId) continue;
    out.set(faseId, (out.get(faseId) ?? 0) + 1);
  }
  return out;
}

function resolveCidadeCard(c: PainelCardDTO): string | null {
  const areaRaw = c.rede_area_atuacao?.trim() || c.projeto_rede_area_atuacao?.trim();
  const fromArea = parseAreaAtuacao(areaRaw)[0]?.cidade?.trim();
  if (fromArea) return fromArea;
  const casa = c.rede_cidade_casa_frank?.trim() || c.projeto_rede_cidade_casa_frank?.trim();
  return casa || null;
}

export type PainelConversaoCidadeRow = {
  cidade: string;
  entradas: number;
  converteram: number;
  taxaConversaoPct: number | null;
  tempoMedioDias: number | null;
};

export function deriveConversaoPorCidade(
  cards: PainelCardDTO[],
  fases: PainelFaseDTO[],
  period: PainelPeriodKey,
): { linhas: PainelConversaoCidadeRow[]; campoDisponivel: boolean } {
  const sinceMs = periodSinceMs(period);
  const ctx = buildConversaoContext(fases);
  const cohort = cards.filter((c) => {
    if (sinceMs == null) return true;
    const t = new Date(c.created_at).getTime();
    return Number.isFinite(t) && t >= sinceMs;
  });

  const campoDisponivel = cohort.some((c) => resolveCidadeCard(c) != null);
  const map = new Map<string, { entradas: number; converteram: number; tempos: number[] }>();

  for (const c of cohort) {
    const cidade = resolveCidadeCard(c) ?? 'Cidade não informada';
    const cur = map.get(cidade) ?? { entradas: 0, converteram: 0, tempos: [] };
    cur.entradas += 1;
    if (cardConverteuPorRegras(c, ctx)) {
      cur.converteram += 1;
      if (c.concluido_em) {
        const d0 = new Date(c.created_at);
        const d1 = new Date(c.concluido_em);
        d0.setHours(0, 0, 0, 0);
        d1.setHours(0, 0, 0, 0);
        const dias = calcularDiasUteis(d0, d1);
        if (dias >= 0) cur.tempos.push(dias);
      }
    }
    map.set(cidade, cur);
  }

  const linhas = [...map.entries()]
    .map(([cidade, g]) => ({
      cidade,
      entradas: g.entradas,
      converteram: g.converteram,
      taxaConversaoPct: g.entradas === 0 ? null : (g.converteram / g.entradas) * 100,
      tempoMedioDias:
        g.tempos.length === 0 ? null : g.tempos.reduce((s, n) => s + n, 0) / g.tempos.length,
    }))
    .sort((a, b) => b.entradas - a.entradas);

  return { linhas, campoDisponivel };
}

export type PainelQualidadeOperacionalRespRow = {
  nome: string;
  semPrazo: number;
  semResponsavel: number;
  arquivSemMotivo: number;
};

export type PainelQualidadeOperacionalFaseRow = {
  faseId: string;
  faseNome: string;
  semPrazo: number;
  semResponsavel: number;
  camposIncompletos: number;
};

export function deriveQualidadeOperacional(
  cards: PainelCardDTO[],
  chamados: PainelChamadoUnificadoDTO[],
  fases: PainelFaseDTO[],
  analise: PainelPerformanceResult,
): {
  porResponsavel: PainelQualidadeOperacionalRespRow[];
  porFase: PainelQualidadeOperacionalFaseRow[];
} {
  const faseNome = new Map(fases.map((f) => [f.id, f.nome]));
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const respMap = new Map<string, PainelQualidadeOperacionalRespRow>();
  const faseMap = new Map<string, PainelQualidadeOperacionalFaseRow>();

  const ensureResp = (nome: string): PainelQualidadeOperacionalRespRow => {
    const key = nome.trim() || 'Sem responsável';
    const cur = respMap.get(key) ?? {
      nome: key,
      semPrazo: 0,
      semResponsavel: 0,
      arquivSemMotivo: 0,
    };
    respMap.set(key, cur);
    return cur;
  };

  const ensureFase = (faseId: string): PainelQualidadeOperacionalFaseRow => {
    const cur = faseMap.get(faseId) ?? {
      faseId,
      faseNome: faseNome.get(faseId) ?? faseId,
      semPrazo: 0,
      semResponsavel: 0,
      camposIncompletos: 0,
    };
    faseMap.set(faseId, cur);
    return cur;
  };

  for (const c of cards.filter(cardAtivo)) {
    const fn = ensureFase(c.fase_id);
    const respNome = c.responsavel_fase_nome?.trim() || 'Sem responsável';
    const rr = ensureResp(respNome);

    if (!String(c.responsavel_fase_id ?? '').trim()) {
      rr.semResponsavel += 1;
      fn.semResponsavel += 1;
    }
    if (cardTemCamposIncompletos(c)) {
      fn.camposIncompletos += 1;
    }
  }

  for (const ch of chamados.filter((c) => c.aberto)) {
    if (String(ch.data_vencimento ?? '').trim()) continue;
    const card = cardById.get(ch.cardId);
    const respNome =
      ch.responsavelNome?.trim() ||
      card?.responsavel_fase_nome?.trim() ||
      'Sem responsável';
    ensureResp(respNome).semPrazo += 1;
    if (card?.fase_id) ensureFase(card.fase_id).semPrazo += 1;
  }

  for (const r of analise.arquivamento.motivos.porResponsavel) {
    const semMotivo = r.motivos.find((m) => m.motivo === MOTIVO_ARQUIVAMENTO_SEM_INFORMADO);
    if (!semMotivo?.total) continue;
    ensureResp(r.responsavelNome).arquivSemMotivo += semMotivo.total;
  }

  return {
    porResponsavel: [...respMap.values()]
      .filter((r) => r.semPrazo + r.semResponsavel + r.arquivSemMotivo > 0)
      .sort((a, b) => b.semPrazo + b.semResponsavel + b.arquivSemMotivo - (a.semPrazo + a.semResponsavel + a.arquivSemMotivo))
      .slice(0, 12),
    porFase: [...faseMap.values()]
      .filter((f) => f.semPrazo + f.semResponsavel + f.camposIncompletos > 0)
      .sort((a, b) => b.semPrazo + b.semResponsavel + b.camposIncompletos - (a.semPrazo + a.semResponsavel + a.camposIncompletos))
      .slice(0, 12),
  };
}
