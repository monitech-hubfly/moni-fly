import { computeConversionFunnelTree } from '@/lib/kanban/painel-funnel-tree-compute';
import { MOTIVO_ARQUIVAMENTO_SEM_INFORMADO } from '@/lib/kanban/painel-motivo-arquivamento';
import { diasUteisDecorridos, periodSinceMs } from '@/lib/kanban/painel-performance-compute';import type {
  ConversionFunnelTreeData,
  GargaloScoreFase,
  PainelCardDTO,
  PainelChamadosAnalise,
  PainelFaseDTO,
  PainelHistoricoMovimentoDTO,
  PainelInsight,
  PainelInsightTipo,
  PainelPeriodKey,
} from '@/lib/kanban/painel-performance-types';

const MAX_INSIGHTS = 7;
const DIAS_INATIVIDADE_CRITICA = 15;

const PERIOD_LABEL: Record<PainelPeriodKey, string> = {
  '7d': 'nos últimos 7 dias',
  '30d': 'nos últimos 30 dias',
  '90d': 'nos últimos 90 dias',
  all: 'no histórico analisado',
};

const PERIOD_DAYS: Record<Exclude<PainelPeriodKey, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

const TIPO_LABEL: Record<PainelInsightTipo, string> = {
  atrasos_concentrados: 'Atrasos',
  conversao_destaque: 'Conversão',
  tempo_medio_variacao: 'Tempo médio',
  oportunidades_concentradas: 'Conversões',
  chamados_gargalo: 'Chamados',
  inatividade_critica: 'Inatividade',
  arquivamento_perda_funil: 'Arquivamento',
  arquivamento_concentracao_fase: 'Arquivamento',
  arquivamento_sem_motivo: 'Arquivamento',
  arquivamento_taxa_unidade: 'Arquivamento',
  arquivamento_motivo_frequente: 'Arquivamento',
  arquivamento_tempo_medio_fase: 'Arquivamento',
  arquivamento_pos_conversao: 'Arquivamento',
  arquivamento_motivo_perda: 'Arquivamento',
};
function buildHistoricoPorCard(rows: PainelHistoricoMovimentoDTO[]): Map<string, PainelHistoricoMovimentoDTO[]> {
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

function cardInativoCritico(
  card: PainelCardDTO,
  historicoPorCard: Map<string, PainelHistoricoMovimentoDTO[]>,
): boolean {
  const ref = card.entered_fase_at ?? card.updated_at ?? card.created_at;
  if (diasUteisDecorridos(ref) < DIAS_INATIVIDADE_CRITICA) return false;
  const refMs = new Date(ref).getTime();
  const movs = historicoPorCard.get(card.id) ?? [];
  return !movs.some((h) => {
    if (h.acao !== 'fase_avancada' && h.acao !== 'fase_retrocedida') return false;
    const t = new Date(h.criado_em).getTime();
    return Number.isFinite(t) && t >= refMs;
  });
}

function pushInsight(
  pool: PainelInsight[],
  tipo: PainelInsightTipo,
  relevancia: number,
  texto: string,
): void {
  pool.push({ tipo, relevancia, texto, tipoLabel: TIPO_LABEL[tipo] });
}

function topInsights(pool: PainelInsight[]): PainelInsight[] {
  return [...pool].sort((a, b) => b.relevancia - a.relevancia).slice(0, MAX_INSIGHTS);
}

function pct(n: number, total: number): number {
  if (total <= 0) return 0;
  return (n / total) * 100;
}

function fmtPct(n: number): string {
  return `${Math.round(n)}%`;
}

function fmtDias(n: number): string {
  return `${Math.round(n)} dias`;
}

function diasAteArquivamento(card: PainelCardDTO): number | null {
  const refArq = card.arquivado_em ?? card.updated_at;
  const a = new Date(refArq).getTime();
  const b = new Date(card.created_at).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < b) return null;
  return (a - b) / (24 * 60 * 60 * 1000);
}

function tempoMedioArquivamentoPorFase(
  arquivados: PainelCardDTO[],
  fases: PainelFaseDTO[],
): Array<{ faseId: string; faseNome: string; mediaDias: number; count: number }> {
  const faseById = new Map(fases.map((f) => [f.id, f]));
  const somaPorFase = new Map<string, { soma: number; count: number }>();
  for (const c of arquivados) {
    const dias = diasAteArquivamento(c);
    if (dias == null) continue;
    const cur = somaPorFase.get(c.fase_id) ?? { soma: 0, count: 0 };
    cur.soma += dias;
    cur.count += 1;
    somaPorFase.set(c.fase_id, cur);
  }
  return [...somaPorFase.entries()]
    .map(([faseId, v]) => ({
      faseId,
      faseNome: faseById.get(faseId)?.nome ?? 'Fase',
      mediaDias: v.soma / v.count,
      count: v.count,
    }))
    .filter((r) => r.count >= 3)
    .sort((a, b) => b.mediaDias - a.mediaDias);
}

export function computePainelInsights(input: {
  period: PainelPeriodKey;
  mode: 'nativo' | 'legado';
  fases: PainelFaseDTO[];
  cards: PainelCardDTO[];
  historicoMovimentos: PainelHistoricoMovimentoDTO[];
  operacaoPorFase: Array<{ faseId: string; faseNome: string; atrasados: number }>;
  conversao: {
    faseConversaoConfigurada: boolean;
    fasesConversao: Array<{ id: string; nome: string }>;
    entradasNoPeriodo: number;
    porFranquia: Array<{
      label: string;
      entradas: number;
      converteram: number;
      taxaConversaoPct: number | null;
    }>;
    porResponsavel: Array<{
      responsavelNome: string;
      entradas: number;
      converteram: number;
      taxaConversaoPct: number | null;
    }>;
    chegaramConversao: number;
    entreFases: Array<{
      deFaseNome: string;
      paraFaseNome: string;
      taxaPassagemPct: number | null;
    }>;
  };
  gargaloRanking: GargaloScoreFase[];
  chamados: PainelChamadosAnalise;
  funnelTree: ConversionFunnelTreeData;
  arquivamento: {
    noPeriodo: number;
    antesConversao: number;
    naConversao?: number;
    depoisConversao: number;
    arquivados: PainelCardDTO[];
    porFase: Array<{
      faseId: string;
      faseNome: string;
      total: number;
      antesConversao: number;
      depoisConversao: number;
    }>;
    porFranquia: Array<{
      redeFranqueadoId: string;
      label: string;
      total: number;
      antesConversao: number;
      depoisConversao: number;
    }>;
    porResponsavel: Array<{
      responsavelId: string | null;
      responsavelNome: string;
      total: number;
      antesConversao: number;
      depoisConversao: number;
    }>;
    motivos: {
      semMotivoInformado: number;
      pctSemMotivo: number | null;
      sugestaoMotivoObrigatorio: boolean;
      ranking: Array<{ motivo: string; total: number; antesConversao: number; depoisConversao: number }>;
      impactoPerdaAntesConversao: Array<{ motivo: string; antesConversao: number; depoisConversao: number }>;
    };
  };
}): PainelInsight[] {
  const pool: PainelInsight[] = [];
  const periodLabel = PERIOD_LABEL[input.period];
  const historicoPorCard = buildHistoricoPorCard(input.historicoMovimentos);
  const faseById = new Map(input.fases.map((f) => [f.id, f]));
  const cardsAtivos = input.cards.filter(cardAtivo);

  // 1. Concentração de atrasos
  const atrasosPorFase = input.operacaoPorFase.filter((f) => f.atrasados > 0);
  const totalAtrasos = atrasosPorFase.reduce((s, f) => s + f.atrasados, 0);
  if (totalAtrasos >= 4) {
    const top = [...atrasosPorFase].sort((a, b) => b.atrasados - a.atrasados)[0]!;
    const share = pct(top.atrasados, totalAtrasos);
    if (share >= 45 && top.atrasados >= 2) {
      pushInsight(
        pool,
        'atrasos_concentrados',
        70 + Math.min(20, share - 45),
        `${fmtPct(share)} dos cards com SLA vencido estão concentrados em ${top.faseNome} (${top.atrasados} de ${totalAtrasos} atrasos) ${periodLabel}.`,
      );
    }
  }

  // 2. Melhor conversão por franquia / responsável
  const convNome =
    input.conversao.fasesConversao.map((f) => f.nome).join(' / ') || 'conversão';
  const transicaoDestaque = [...input.conversao.entreFases]
    .filter((t) => t.taxaPassagemPct != null)
    .sort((a, b) => (b.taxaPassagemPct ?? 0) - (a.taxaPassagemPct ?? 0))[0];
  const transicaoLabel = transicaoDestaque
    ? `${transicaoDestaque.deFaseNome} → ${transicaoDestaque.paraFaseNome}`
    : convNome;

  if (input.conversao.faseConversaoConfigurada && input.conversao.entradasNoPeriodo >= 5) {
    const franqCandidatos = input.conversao.porFranquia.filter(
      (f) => f.entradas >= 3 && f.taxaConversaoPct != null,
    );
    const respCandidatos = input.conversao.porResponsavel.filter(
      (r) => r.entradas >= 3 && r.taxaConversaoPct != null,
    );
    const melhorFranq = [...franqCandidatos].sort(
      (a, b) => (b.taxaConversaoPct ?? 0) - (a.taxaConversaoPct ?? 0),
    )[0];
    const melhorResp = [...respCandidatos].sort(
      (a, b) => (b.taxaConversaoPct ?? 0) - (a.taxaConversaoPct ?? 0),
    )[0];

    const escolhido =
      melhorFranq && melhorResp
        ? (melhorFranq.taxaConversaoPct ?? 0) >= (melhorResp.taxaConversaoPct ?? 0)
          ? { tipo: 'franquia' as const, row: melhorFranq }
          : { tipo: 'resp' as const, row: melhorResp }
        : melhorFranq
          ? { tipo: 'franquia' as const, row: melhorFranq }
          : melhorResp
            ? { tipo: 'resp' as const, row: melhorResp }
            : null;

    if (escolhido && (escolhido.row.taxaConversaoPct ?? 0) >= 15) {
      const nome =
        escolhido.tipo === 'franquia'
          ? (escolhido.row as (typeof franqCandidatos)[0]).label
          : (escolhido.row as (typeof respCandidatos)[0]).responsavelNome;
      pushInsight(
        pool,
        'conversao_destaque',
        65 + Math.min(15, (escolhido.row.taxaConversaoPct ?? 0) / 5),
        `${nome} possui a maior taxa de conversão ${transicaoLabel} (${fmtPct(escolhido.row.taxaConversaoPct ?? 0)}) ${periodLabel}.`,
      );
    }
  }

  // 3. Variação de tempo médio (período atual vs janela anterior)
  if (input.period !== 'all') {
    const days = PERIOD_DAYS[input.period];
    const sinceMs = periodSinceMs(input.period)!;
    const prevSince = sinceMs - days * 86400000;

    const funnelAtual = input.funnelTree;
    const funnelAnterior = computeConversionFunnelTree({
      mode: input.mode,
      period: input.period,
      fases: input.fases,
      cards: input.cards,
      historicoMovimentos: input.historicoMovimentos,
      cohortCreatedWindow: { sinceMs: prevSince, untilMs: sinceMs },
    });

    let maiorVariacao: {
      faseNome: string;
      deltaPct: number;
      atual: number;
      anterior: number;
    } | null = null;

    for (let i = 1; i < funnelAtual.nodes.length; i++) {
      const atual = funnelAtual.nodes[i]!;
      const ant = funnelAnterior.nodes[i];
      if (atual.tempoMedioDias == null || ant?.tempoMedioDias == null) continue;
      if (atual.alcancaram < 4 || (ant.alcancaram ?? 0) < 4) continue;
      if (ant.tempoMedioDias < 1) continue;
      const deltaPct = ((atual.tempoMedioDias - ant.tempoMedioDias) / ant.tempoMedioDias) * 100;
      if (Math.abs(deltaPct) < 10) continue;
      if (!maiorVariacao || Math.abs(deltaPct) > Math.abs(maiorVariacao.deltaPct)) {
        maiorVariacao = {
          faseNome: atual.faseNome,
          deltaPct,
          atual: atual.tempoMedioDias,
          anterior: ant.tempoMedioDias,
        };
      }
    }

    if (maiorVariacao) {
      const dir = maiorVariacao.deltaPct > 0 ? 'aumentou' : 'reduziu';
      const janelaAnterior =
        input.period === '30d'
          ? 'em relação aos 30 dias anteriores'
          : input.period === '90d'
            ? 'em relação aos 90 dias anteriores'
            : 'em relação à semana anterior';
      pushInsight(
        pool,
        'tempo_medio_variacao',
        60 + Math.min(20, Math.abs(maiorVariacao.deltaPct) / 3),
        `O tempo médio em ${maiorVariacao.faseNome} ${dir} ${fmtPct(Math.abs(maiorVariacao.deltaPct))} ${periodLabel} (${janelaAnterior}).`,
      );
    }
  }

  // 4. Concentração de oportunidades convertidas (por franquia)
  if (input.conversao.chegaramConversao >= 5) {
    const porFranqConv = input.conversao.porFranquia
      .filter((f) => f.converteram > 0)
      .sort((a, b) => b.converteram - a.converteram);
    const top = porFranqConv[0];
    if (top && top.converteram >= 2) {
      const share = pct(top.converteram, input.conversao.chegaramConversao);
      if (share >= 30) {
        pushInsight(
          pool,
          'oportunidades_concentradas',
          55 + Math.min(20, share - 30),
          `${top.label} concentra ${fmtPct(share)} das conversões do funil (${top.converteram} de ${input.conversao.chegaramConversao}) ${periodLabel}.`,
        );
      }
    }
  }

  // 5. Chamados explicando gargalo (trava por fase)
  const totalTrava = input.chamados.comTrava;
  if (totalTrava >= 3 && input.chamados.travaPorFase.length > 0) {
    const top = input.chamados.travaPorFase[0]!;
    const share = pct(top.total, totalTrava);
    if (share >= 40 && top.total >= 2) {
      pushInsight(
        pool,
        'chamados_gargalo',
        75 + Math.min(15, share - 40),
        `${top.faseNome} concentra ${fmtPct(share)} dos chamados com trava (${top.total} de ${totalTrava}) ${periodLabel} — alinhado ao gargalo operacional.`,
      );
    }
  }

  // 6. Inatividade crítica (>15 d.u. sem movimentação)
  const inativosPorFase = new Map<string, { faseNome: string; count: number }>();
  for (const c of cardsAtivos) {
    if (!cardInativoCritico(c, historicoPorCard)) continue;
    const f = faseById.get(c.fase_id);
    if (!f) continue;
    const cur = inativosPorFase.get(f.id) ?? { faseNome: f.nome, count: 0 };
    cur.count += 1;
    inativosPorFase.set(f.id, cur);
  }
  const topInativo = [...inativosPorFase.values()].sort((a, b) => b.count - a.count)[0];
  if (topInativo && topInativo.count >= 3) {
    pushInsight(
      pool,
      'inatividade_critica',
      80 + Math.min(15, topInativo.count),
      `${topInativo.count} cards estão sem movimentação há mais de ${DIAS_INATIVIDADE_CRITICA} dias úteis em ${topInativo.faseNome} ${periodLabel}.`,
    );
  }

  // 7+. Insights de arquivamento
  const arq = input.arquivamento;
  const motArq = arq.motivos;
  const convNomeArq =
    input.conversao.fasesConversao.map((f) => f.nome).join(' / ') || 'conversão';

  if (arq.noPeriodo >= 2) {
    // Perdas do funil por arquivamento antes da conversão
    const perdasCoorte =
      input.conversao.entradasNoPeriodo - input.conversao.chegaramConversao;
    if (
      input.conversao.faseConversaoConfigurada &&
      perdasCoorte >= 3 &&
      arq.antesConversao >= 2
    ) {
      const sharePerdaFunil = pct(arq.antesConversao, perdasCoorte);
      if (sharePerdaFunil >= 20) {
        pushInsight(
          pool,
          'arquivamento_perda_funil',
          78 + Math.min(15, sharePerdaFunil / 3),
          `${fmtPct(sharePerdaFunil)} das perdas do funil ocorreram por arquivamento antes da fase de conversão (${arq.antesConversao} de ${perdasCoorte} não convertidos) ${periodLabel}.`,
        );
      }
    }

    // Concentração de arquivamentos por fase
    const faseTop = [...arq.porFase]
      .filter((f) => f.total >= 2)
      .sort((a, b) => b.total - a.total)[0];
    if (faseTop && arq.noPeriodo >= 3) {
      const shareFase = pct(faseTop.total, arq.noPeriodo);
      if (shareFase >= 30) {
        const partesConv: string[] = [];
        if (faseTop.antesConversao > 0) {
          partesConv.push(`${faseTop.antesConversao} antes da conversão`);
        }
        if (faseTop.depoisConversao > 0) {
          partesConv.push(`${faseTop.depoisConversao} depois da conversão`);
        }
        const sufixo = partesConv.length ? ` (${partesConv.join(', ')})` : '';
        pushInsight(
          pool,
          'arquivamento_concentracao_fase',
          74 + Math.min(18, shareFase / 2),
          `${faseTop.faseNome} concentra ${fmtPct(shareFase)} dos arquivamentos do período${sufixo} ${periodLabel}.`,
        );
      }
    }

    // Sem motivo informado
    if (motArq.semMotivoInformado >= 1 && arq.noPeriodo >= 3) {
      const shareSemMotivo = pct(motArq.semMotivoInformado, arq.noPeriodo);
      if (shareSemMotivo >= 15 || motArq.semMotivoInformado >= 2) {
        pushInsight(
          pool,
          'arquivamento_sem_motivo',
          72 + Math.min(18, shareSemMotivo / 2),
          `${fmtPct(shareSemMotivo)} dos cards arquivados estão sem motivo informado (${motArq.semMotivoInformado} de ${arq.noPeriodo}) ${periodLabel}.`,
        );
      }
    }

    // Maior taxa de arquivamento antes da conversão por unidade
    const entradasFranq = new Map(
      input.conversao.porFranquia.map((f) => [f.label, f.entradas]),
    );
    const candidatosUnidade = arq.porFranquia
      .map((f) => {
        const entradas = entradasFranq.get(f.label) ?? 0;
        return {
          label: f.label,
          antesConversao: f.antesConversao,
          depoisConversao: f.depoisConversao,
          entradas,
          taxaAntesPct: entradas >= 3 ? pct(f.antesConversao, entradas) : 0,
        };
      })
      .filter((c) => c.antesConversao >= 2 && c.entradas >= 3)
      .sort((a, b) => b.taxaAntesPct - a.taxaAntesPct);
    const topUnidade = candidatosUnidade[0];
    const segundoUnidade = candidatosUnidade[1];
    if (
      topUnidade &&
      topUnidade.taxaAntesPct >= 15 &&
      (!segundoUnidade || topUnidade.taxaAntesPct - segundoUnidade.taxaAntesPct >= 5)
    ) {
      pushInsight(
        pool,
        'arquivamento_taxa_unidade',
        70 + Math.min(20, topUnidade.taxaAntesPct / 4),
        `${topUnidade.label} teve a maior taxa de arquivamento antes da conversão (${fmtPct(topUnidade.taxaAntesPct)} das ${topUnidade.entradas} entradas; ${topUnidade.antesConversao} arquivados antes de ${convNomeArq}) ${periodLabel}.`,
      );
    }

    // Motivo mais frequente (exceto "sem motivo")
    const topMotivo = motArq.ranking.find((m) => m.motivo !== MOTIVO_ARQUIVAMENTO_SEM_INFORMADO);
    if (topMotivo && topMotivo.total >= 2 && arq.noPeriodo >= 3) {
      const shareMotivo = pct(topMotivo.total, arq.noPeriodo);
      if (shareMotivo >= 15) {
        const detConv =
          topMotivo.antesConversao > 0 && topMotivo.depoisConversao > 0
            ? ` (${topMotivo.antesConversao} antes e ${topMotivo.depoisConversao} depois da conversão)`
            : topMotivo.antesConversao > 0
              ? ` (${topMotivo.antesConversao} antes da conversão)`
              : topMotivo.depoisConversao > 0
                ? ` (${topMotivo.depoisConversao} depois da conversão)`
                : '';
        pushInsight(
          pool,
          'arquivamento_motivo_frequente',
          68 + Math.min(18, shareMotivo / 2),
          `O motivo mais frequente de arquivamento foi "${topMotivo.motivo}" (${topMotivo.total} ocorrências, ${fmtPct(shareMotivo)} do total)${detConv} ${periodLabel}.`,
        );
      }
    }

    // Tempo médio até arquivamento por fase
    const temposFase = tempoMedioArquivamentoPorFase(arq.arquivados, input.fases);
    const topTempo = temposFase[0];
    if (topTempo && topTempo.mediaDias >= 7) {
      pushInsight(
        pool,
        'arquivamento_tempo_medio_fase',
        65 + Math.min(15, topTempo.mediaDias / 3),
        `Cards arquivados em ${topTempo.faseNome} levaram em média ${fmtDias(topTempo.mediaDias)} antes de sair do funil (${topTempo.count} cards) ${periodLabel}.`,
      );
    }

    // Arquivamento depois da conversão (perda pós-conversão)
    if (arq.depoisConversao >= 2 && arq.noPeriodo >= 3) {
      const sharePos = pct(arq.depoisConversao, arq.noPeriodo);
      if (sharePos >= 15) {
        pushInsight(
          pool,
          'arquivamento_pos_conversao',
          62 + Math.min(15, sharePos / 2),
          `${arq.depoisConversao} cards arquivados depois da conversão (${fmtPct(sharePos)} dos arquivados) — perda pós-conversão que não reduz a taxa do funil ${periodLabel}.`,
        );
      }
    }

    // Motivo que mais explica perda antes da conversão
    const topPerda = motArq.impactoPerdaAntesConversao[0];
    if (topPerda && topPerda.antesConversao >= 2 && arq.antesConversao >= 3) {
      const sharePerda = pct(topPerda.antesConversao, arq.antesConversao);
      if (sharePerda >= 25 && topPerda.motivo !== MOTIVO_ARQUIVAMENTO_SEM_INFORMADO) {
        pushInsight(
          pool,
          'arquivamento_motivo_perda',
          68 + Math.min(20, sharePerda / 2),
          `"${topPerda.motivo}" explica ${fmtPct(sharePerda)} dos arquivamentos antes da conversão (${topPerda.antesConversao} de ${arq.antesConversao}) ${periodLabel}.`,
        );
      }
    }
  }

  const ranked = topInsights(pool);
  if (ranked.length === 0 && input.conversao.entradasNoPeriodo === 0) {
    return [
      {
        tipo: 'atrasos_concentrados',
        relevancia: 10,
        tipoLabel: TIPO_LABEL.atrasos_concentrados,
        texto: `Poucos dados no recorte ${periodLabel} — amplie o período ou aguarde novas entradas no funil.`,
      },
    ];
  }

  return ranked;
}

export { TIPO_LABEL as PAINEL_INSIGHT_TIPO_LABEL };
