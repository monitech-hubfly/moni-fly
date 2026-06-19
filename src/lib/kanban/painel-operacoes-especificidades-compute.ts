import { buildNativeFaseTimeline } from '@/lib/kanban/kanban-card-timeline';
import { FASE_SLUGS } from '@/lib/constants/kanban-ids';
import { parseAreaAtuacao } from '@/lib/rede-area-atuacao';
import type {
  PainelCardDTO,
  PainelFaseDTO,
  PainelHistoricoMovimentoDTO,
  PainelRetrocessoDTO,
} from '@/lib/kanban/painel-performance-types';

const REVISAO_BCA_SLUGS = ['revisao_bca'] as const;

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

function buildRetrocessoPorCard(rows: PainelRetrocessoDTO[]): Map<string, PainelRetrocessoDTO[]> {
  const m = new Map<string, PainelRetrocessoDTO[]>();
  for (const r of rows) {
    const list = m.get(r.card_id) ?? [];
    list.push(r);
    m.set(r.card_id, list);
  }
  return m;
}

function resolveCondominio(c: PainelCardDTO): string {
  const nome = c.nome_condominio?.trim() || c.projeto_titulo?.trim();
  return nome || 'Condomínio não informado';
}

function resolveCidade(c: PainelCardDTO): string {
  const areaRaw = c.rede_area_atuacao?.trim() || c.projeto_rede_area_atuacao?.trim();
  const fromArea = parseAreaAtuacao(areaRaw)[0]?.cidade?.trim();
  if (fromArea) return fromArea;
  const casa =
    c.rede_cidade_casa_frank?.trim() || c.projeto_rede_cidade_casa_frank?.trim();
  if (casa) return casa;
  return 'Cidade não informada';
}

function diasNaFaseViaTimeline(
  card: PainelCardDTO,
  faseId: string,
  fasesOrd: PainelFaseDTO[],
  historico: PainelHistoricoMovimentoDTO[],
): number | null {
  const linhas = buildNativeFaseTimeline(
    fasesOrd,
    { created_at: card.created_at, fase_id: card.fase_id },
    historico.map((h) => ({ acao: h.acao, detalhe: h.detalhe, criado_em: h.criado_em })),
  );
  const linha = linhas.find((l) => l.faseId === faseId);
  if (!linha?.entrouEm) {
    if (card.fase_id === faseId && card.entered_fase_at) {
      const a = new Date(card.entered_fase_at).getTime();
      const b = Date.now();
      if (Number.isFinite(a) && b >= a) return (b - a) / (24 * 60 * 60 * 1000);
    }
    return null;
  }
  const fim = linha.saiuEm ?? new Date().toISOString();
  const a = new Date(linha.entrouEm).getTime();
  const b = new Date(fim).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return (b - a) / (24 * 60 * 60 * 1000);
}

function mediaPorGrupo(
  grupos: Map<string, number[]>,
): PainelOperacoesGrupoTempoRow[] {
  return [...grupos.entries()]
    .map(([label, nums]) => ({
      label,
      mediaDias: nums.length === 0 ? null : nums.reduce((s, n) => s + n, 0) / nums.length,
      amostras: nums.length,
    }))
    .sort((a, b) => b.amostras - a.amostras);
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

function contagemRetrocessosParaFase(
  retrocessos: PainelRetrocessoDTO[],
  faseIds: Set<string>,
): number {
  let n = 0;
  for (const r of retrocessos) {
    const novaId = detStr(r.detalhe, 'fase_nova_id');
    if (faseIds.has(novaId)) {
      n += 1;
      continue;
    }
    const novaNome = detStr(r.detalhe, 'fase_nova_nome').toLowerCase();
    if (novaNome.includes('revisão') || novaNome.includes('revisao')) n += 1;
  }
  return n;
}

function diasDesdeEnteredFaseAt(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / (24 * 60 * 60 * 1000);
}

function resolveEnteredAguardandoCredito(
  card: PainelCardDTO,
  aguardandoCreditoIds: Set<string>,
  fasesOrd: PainelFaseDTO[],
  historico: PainelHistoricoMovimentoDTO[],
): string | null {
  const direct = card.entered_fase_at?.trim();
  if (direct && aguardandoCreditoIds.has(card.fase_id)) return direct;
  for (const faseId of aguardandoCreditoIds) {
    const linhas = buildNativeFaseTimeline(
      fasesOrd,
      { created_at: card.created_at, fase_id: card.fase_id },
      historico.map((h) => ({ acao: h.acao, detalhe: h.detalhe, criado_em: h.criado_em })),
    );
    const linha = linhas.find((l) => l.faseId === faseId);
    if (linha?.entrouEm) return linha.entrouEm;
  }
  return null;
}

export type PainelOperacoesGrupoTempoRow = {
  label: string;
  mediaDias: number | null;
  amostras: number;
};

export type PainelOperacoesEspecificidades = {
  tempoAprovacaoCondominio: {
    porCondominio: PainelOperacoesGrupoTempoRow[];
    localIndisponivel: boolean;
  } | null;
  tempoAprovacaoPrefeitura: {
    porCidade: PainelOperacoesGrupoTempoRow[];
    localIndisponivel: boolean;
  } | null;
  taxaRetrabalhoBca: {
    comRetrabalho: number;
    totalEmObra: number;
    percentual: number | null;
  } | null;
  aguardandoCredito30Dias: {
    acima30Dias: number;
    itens: Array<{ cardId: string; titulo: string; diasParados: number }>;
  } | null;
};

/** Métricas específicas do Funil Operações. Degrada por bloco quando dados ausentes. */
export function computeOperacoesEspecificidades(input: {
  fases: PainelFaseDTO[];
  cards: PainelCardDTO[];
  historicoMovimentos: PainelHistoricoMovimentoDTO[];
  retrocessoRows: PainelRetrocessoDTO[];
  operacoesFieldsAvailable?: boolean;
}): PainelOperacoesEspecificidades | null {
  const historicoPorCard = buildHistoricoPorCard(input.historicoMovimentos);
  const retrocessoPorCard = buildRetrocessoPorCard(input.retrocessoRows);
  const fasesOrd = [...input.fases].sort((a, b) => a.ordem - b.ordem);

  const aprovCondIds = faseIdsPorSlugs(input.fases, [FASE_SLUGS.APROVACAO_CONDOMINIO]);
  const aprovPrefIds = faseIdsPorSlugs(input.fases, [FASE_SLUGS.APROVACAO_PREFEITURA]);
  const revisaoBcaIds = new Set(faseIdsPorSlugs(input.fases, REVISAO_BCA_SLUGS));
  const aguardandoCreditoIds = new Set(faseIdsPorSlugs(input.fases, [FASE_SLUGS.AGUARDANDO_CREDITO]));

  const localIndisponivel =
    input.operacoesFieldsAvailable === false ||
    (!campoDisponivel(input.cards, 'nome_condominio') &&
      !campoDisponivel(input.cards, 'projeto_titulo') &&
      !campoDisponivel(input.cards, 'rede_area_atuacao') &&
      input.operacoesFieldsAvailable !== true);

  let tempoAprovacaoCondominio: PainelOperacoesEspecificidades['tempoAprovacaoCondominio'] = null;
  try {
    if (aprovCondIds.length > 0) {
      const grupos = new Map<string, number[]>();
      for (const c of input.cards) {
        for (const faseId of aprovCondIds) {
          const historico = historicoPorCard.get(c.id) ?? [];
          const dias = diasNaFaseViaTimeline(c, faseId, fasesOrd, historico);
          if (dias == null) continue;
          const label = resolveCondominio(c);
          const list = grupos.get(label) ?? [];
          list.push(dias);
          grupos.set(label, list);
        }
      }
      tempoAprovacaoCondominio = {
        porCondominio: mediaPorGrupo(grupos),
        localIndisponivel,
      };
    }
  } catch {
    tempoAprovacaoCondominio = null;
  }

  let tempoAprovacaoPrefeitura: PainelOperacoesEspecificidades['tempoAprovacaoPrefeitura'] = null;
  try {
    if (aprovPrefIds.length > 0) {
      const grupos = new Map<string, number[]>();
      for (const c of input.cards) {
        for (const faseId of aprovPrefIds) {
          const historico = historicoPorCard.get(c.id) ?? [];
          const dias = diasNaFaseViaTimeline(c, faseId, fasesOrd, historico);
          if (dias == null) continue;
          const label = resolveCidade(c);
          const list = grupos.get(label) ?? [];
          list.push(dias);
          grupos.set(label, list);
        }
      }
      tempoAprovacaoPrefeitura = {
        porCidade: mediaPorGrupo(grupos),
        localIndisponivel,
      };
    }
  } catch {
    tempoAprovacaoPrefeitura = null;
  }

  let taxaRetrabalhoBca: PainelOperacoesEspecificidades['taxaRetrabalhoBca'] = null;
  try {
    if (revisaoBcaIds.size > 0) {
      const totalEmObra = input.cards.filter((c) => !c.arquivado && !c.concluido).length;
      let comRetrabalho = 0;

      for (const c of input.cards) {
        if (!cardVisitouFase(c, revisaoBcaIds, historicoPorCard)) continue;
        const retrocessos = retrocessoPorCard.get(c.id) ?? [];
        if (contagemRetrocessosParaFase(retrocessos, revisaoBcaIds) >= 1) {
          comRetrabalho += 1;
        }
      }

      taxaRetrabalhoBca = {
        comRetrabalho,
        totalEmObra,
        percentual: totalEmObra === 0 ? null : (comRetrabalho / totalEmObra) * 100,
      };
    }
  } catch {
    taxaRetrabalhoBca = null;
  }

  let aguardandoCredito30Dias: PainelOperacoesEspecificidades['aguardandoCredito30Dias'] = null;
  try {
    if (aguardandoCreditoIds.size > 0) {
      const itens: NonNullable<PainelOperacoesEspecificidades['aguardandoCredito30Dias']>['itens'] =
        [];

      for (const c of input.cards) {
        if (!aguardandoCreditoIds.has(c.fase_id)) continue;
        if (c.arquivado || c.concluido) continue;
        const historico = historicoPorCard.get(c.id) ?? [];
        const entered = resolveEnteredAguardandoCredito(
          c,
          aguardandoCreditoIds,
          fasesOrd,
          historico,
        );
        const dias = diasDesdeEnteredFaseAt(entered);
        if (dias == null || dias <= 30) continue;
        itens.push({
          cardId: c.id,
          titulo: c.titulo?.trim() || c.id.slice(0, 8),
          diasParados: Math.floor(dias),
        });
      }

      itens.sort((a, b) => b.diasParados - a.diasParados);

      aguardandoCredito30Dias = {
        acima30Dias: itens.length,
        itens,
      };
    }
  } catch {
    aguardandoCredito30Dias = null;
  }

  const temAlgum =
    tempoAprovacaoCondominio != null ||
    tempoAprovacaoPrefeitura != null ||
    taxaRetrabalhoBca != null ||
    aguardandoCredito30Dias != null;

  if (!temAlgum) return null;

  return {
    tempoAprovacaoCondominio,
    tempoAprovacaoPrefeitura,
    taxaRetrabalhoBca,
    aguardandoCredito30Dias,
  };
}
