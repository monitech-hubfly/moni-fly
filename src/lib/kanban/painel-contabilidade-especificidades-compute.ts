import { buildNativeFaseTimeline } from '@/lib/kanban/kanban-card-timeline';
import { FASE_SLUGS } from '@/lib/constants/kanban-ids';
import { calcularDiasUteis } from '@/lib/dias-uteis';
import { periodSinceMs } from '@/lib/kanban/painel-performance-compute';
import type {
  PainelCardDTO,
  PainelCreditoObraOperacoesIrmaoDTO,
  PainelFaseDTO,
  PainelHistoricoMovimentoDTO,
  PainelPeriodKey,
} from '@/lib/kanban/painel-performance-types';

const SLA_FALLBACK_DIAS = 7;

const TIPOS_ABERTURA = [
  { label: 'Incorporadora', slug: FASE_SLUGS.CONTABILIDADE_INCORPORADORA },
  { label: 'SPE', slug: FASE_SLUGS.CONTABILIDADE_SPE },
  { label: 'Gestora', slug: FASE_SLUGS.CONTABILIDADE_GESTORA },
] as const;

function campoDisponivel(cards: PainelCardDTO[], key: keyof PainelCardDTO): boolean {
  return cards.some((c) => c[key] !== undefined);
}

function faseIdsPorSlugs(fases: PainelFaseDTO[], slugs: readonly string[]): string[] {
  const want = new Set(slugs.map((s) => s.trim()));
  return fases.filter((f) => want.has(String(f.slug ?? '').trim())).map((f) => f.id);
}

function fasePorId(fases: PainelFaseDTO[], faseId: string): PainelFaseDTO | undefined {
  return fases.find((f) => f.id === faseId);
}

function slaDiasFase(fase: PainelFaseDTO | undefined): number {
  const s = fase?.sla_dias;
  if (s != null && s > 0 && s < 999) return s;
  return SLA_FALLBACK_DIAS;
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

function cardAtivo(c: { arquivado: boolean; concluido: boolean }): boolean {
  return !c.arquivado && !c.concluido;
}

function timestampInPeriod(iso: string | null | undefined, sinceMs: number | null): boolean {
  if (sinceMs === null) return Boolean(iso);
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= sinceMs;
}

function diasUteisEntreIso(inicio: string, fim: string): number | null {
  const a = new Date(inicio);
  const b = new Date(fim);
  if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime()) || b < a) return null;
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return calcularDiasUteis(a, b);
}

function permanenciaNaFase(
  card: PainelCardDTO,
  faseId: string,
  fasesOrd: PainelFaseDTO[],
  historico: PainelHistoricoMovimentoDTO[],
): { diasUteis: number | null; saiuEm: string | null; entrouEm: string | null } {
  const linhas = buildNativeFaseTimeline(
    fasesOrd,
    { created_at: card.created_at, fase_id: card.fase_id },
    historico.map((h) => ({ acao: h.acao, detalhe: h.detalhe, criado_em: h.criado_em })),
  );
  const linha = linhas.find((l) => l.faseId === faseId);
  const entrouEm = linha?.entrouEm ?? (card.fase_id === faseId ? card.entered_fase_at : null);
  if (!entrouEm) return { diasUteis: null, saiuEm: null, entrouEm: null };

  const saiuEm = linha?.saiuEm ?? (card.fase_id === faseId ? null : new Date().toISOString());
  const fim = saiuEm ?? new Date().toISOString();
  return {
    diasUteis: diasUteisEntreIso(entrouEm, fim),
    saiuEm: linha?.saiuEm ?? null,
    entrouEm,
  };
}

export type PainelContabilidadeTipoTempoRow = {
  tipo: string;
  mediaDiasUteis: number | null;
  slaDias: number;
  vsSlaDias: number | null;
  amostras: number;
  acimaSla: boolean;
};

export type PainelContabilidadeSlaTipoRow = {
  tipo: string;
  concluidos: number;
  dentroSla: number;
  taxaPct: number | null;
};

export type PainelContabilidadeBloqueioItem = {
  projetoId: string;
  contabilidadeCardId: string;
  titulo: string;
  tipoAbertura: string;
};

export type PainelContabilidadeEspecificidades = {
  tempoAberturaPorTipo: {
    linhas: PainelContabilidadeTipoTempoRow[];
    historicoParcial: boolean;
    tiposAcimaSla: number;
  } | null;
  bloqueandoCreditoObra: {
    totalBloqueando: number;
    itens: PainelContabilidadeBloqueioItem[];
    creditoObraIndisponivel: boolean;
    projetoIndisponivel: boolean;
  } | null;
  taxaConclusaoSlaPorTipo: {
    linhas: PainelContabilidadeSlaTipoRow[];
    taxaMediaPct: number | null;
  } | null;
};

/** Métricas específicas do Funil Contabilidade. Degrada por bloco quando dados ausentes. */
export function computeContabilidadeEspecificidades(input: {
  period: PainelPeriodKey;
  fases: PainelFaseDTO[];
  cards: PainelCardDTO[];
  historicoMovimentos: PainelHistoricoMovimentoDTO[];
  creditoObraIrmaos?: PainelCreditoObraOperacoesIrmaoDTO[];
  creditoObraFases?: PainelFaseDTO[];
  creditoObraIrmaosAvailable?: boolean;
  contabilidadeFieldsAvailable?: boolean;
}): PainelContabilidadeEspecificidades | null {
  const historicoPorCard = buildHistoricoPorCard(input.historicoMovimentos);
  const fasesOrd = [...input.fases].sort((a, b) => a.ordem - b.ordem);
  const concluidoIds = new Set(faseIdsPorSlugs(input.fases, [FASE_SLUGS.CONTABILIDADE_CONCLUIDO]));
  const sinceMs = periodSinceMs(input.period);

  const slugPorFaseId = new Map(input.fases.map((f) => [f.id, String(f.slug ?? '').trim()]));

  let tempoAberturaPorTipo: PainelContabilidadeEspecificidades['tempoAberturaPorTipo'] = null;
  try {
    const linhas: PainelContabilidadeTipoTempoRow[] = [];
    let historicoParcial = false;

    for (const tipo of TIPOS_ABERTURA) {
      const faseIds = faseIdsPorSlugs(input.fases, [tipo.slug]);
      if (faseIds.length === 0) continue;

      const fase = fasePorId(input.fases, faseIds[0]!);
      const slaDias = slaDiasFase(fase);
      const tempos: number[] = [];

      for (const c of input.cards) {
        const historico = historicoPorCard.get(c.id) ?? [];
        const temMov = historico.some(
          (h) =>
            h.acao === 'fase_avancada' || h.acao === 'fase_retrocedida' || h.acao === 'card_criado',
        );
        if (!temMov) historicoParcial = true;

        for (const faseId of faseIds) {
          const { diasUteis } = permanenciaNaFase(c, faseId, fasesOrd, historico);
          if (diasUteis != null) tempos.push(diasUteis);
        }
      }

      const mediaDiasUteis =
        tempos.length === 0 ? null : tempos.reduce((s, n) => s + n, 0) / tempos.length;
      const vsSlaDias =
        mediaDiasUteis == null ? null : Math.round((mediaDiasUteis - slaDias) * 10) / 10;

      linhas.push({
        tipo: tipo.label,
        mediaDiasUteis,
        slaDias,
        vsSlaDias,
        amostras: tempos.length,
        acimaSla: mediaDiasUteis != null && mediaDiasUteis > slaDias,
      });
    }

    if (linhas.length > 0) {
      tempoAberturaPorTipo = {
        linhas,
        historicoParcial,
        tiposAcimaSla: linhas.filter((l) => l.acimaSla).length,
      };
    }
  } catch {
    tempoAberturaPorTipo = null;
  }

  let bloqueandoCreditoObra: PainelContabilidadeEspecificidades['bloqueandoCreditoObra'] = null;
  try {
    const projetoIndisponivel =
      input.contabilidadeFieldsAvailable === false ||
      (input.contabilidadeFieldsAvailable !== true && !campoDisponivel(input.cards, 'projeto_id'));

    const creditoObraIndisponivel =
      input.creditoObraIrmaosAvailable === false ||
      !input.creditoObraIrmaos?.length;

    const irmaosAtivosPorProjeto = new Map<string, PainelCreditoObraOperacoesIrmaoDTO>();
    for (const irmao of input.creditoObraIrmaos ?? []) {
      if (!cardAtivo(irmao)) continue;
      const pid = irmao.projeto_id.trim();
      if (!pid) continue;
      if (!irmaosAtivosPorProjeto.has(pid)) irmaosAtivosPorProjeto.set(pid, irmao);
    }

    const itens: PainelContabilidadeBloqueioItem[] = [];

    if (!projetoIndisponivel && !creditoObraIndisponivel) {
      for (const c of input.cards) {
        if (!cardAtivo(c)) continue;
        if (concluidoIds.has(c.fase_id)) continue;
        const pid = c.projeto_id?.trim();
        if (!pid) continue;
        if (!irmaosAtivosPorProjeto.has(pid)) continue;

        const slugAtual = slugPorFaseId.get(c.fase_id) ?? '';
        const tipo =
          TIPOS_ABERTURA.find((t) => t.slug === slugAtual)?.label ??
          (slugAtual || 'Tipo não identificado');

        itens.push({
          projetoId: pid,
          contabilidadeCardId: c.id,
          titulo: c.titulo?.trim() || c.projeto_titulo?.trim() || pid.slice(0, 8),
          tipoAbertura: tipo,
        });
      }
    }

    bloqueandoCreditoObra = {
      totalBloqueando: itens.length,
      itens,
      creditoObraIndisponivel,
      projetoIndisponivel,
    };
  } catch {
    bloqueandoCreditoObra = null;
  }

  let taxaConclusaoSlaPorTipo: PainelContabilidadeEspecificidades['taxaConclusaoSlaPorTipo'] = null;
  try {
    const linhas: PainelContabilidadeSlaTipoRow[] = [];
    let totalDentro = 0;
    let totalConcluidos = 0;

    for (const tipo of TIPOS_ABERTURA) {
      const faseIds = faseIdsPorSlugs(input.fases, [tipo.slug]);
      if (faseIds.length === 0) continue;

      let dentroSla = 0;
      let concluidos = 0;

      for (const faseId of faseIds) {
        const fase = fasePorId(input.fases, faseId);
        const slaDias = slaDiasFase(fase);

        for (const c of input.cards) {
          const historico = historicoPorCard.get(c.id) ?? [];
          const { saiuEm, entrouEm, diasUteis } = permanenciaNaFase(
            c,
            faseId,
            fasesOrd,
            historico,
          );
          if (!saiuEm || !entrouEm || diasUteis == null) continue;
          if (!timestampInPeriod(saiuEm, sinceMs)) continue;

          concluidos += 1;
          if (diasUteis <= slaDias) dentroSla += 1;
        }
      }

      if (concluidos > 0 || faseIds.length > 0) {
        linhas.push({
          tipo: tipo.label,
          concluidos,
          dentroSla,
          taxaPct: concluidos === 0 ? null : (dentroSla / concluidos) * 100,
        });
        totalDentro += dentroSla;
        totalConcluidos += concluidos;
      }
    }

    if (linhas.length > 0) {
      taxaConclusaoSlaPorTipo = {
        linhas,
        taxaMediaPct: totalConcluidos === 0 ? null : (totalDentro / totalConcluidos) * 100,
      };
    }
  } catch {
    taxaConclusaoSlaPorTipo = null;
  }

  const temAlgum =
    tempoAberturaPorTipo != null ||
    bloqueandoCreditoObra != null ||
    taxaConclusaoSlaPorTipo != null;

  if (!temAlgum) return null;

  return {
    tempoAberturaPorTipo,
    bloqueandoCreditoObra,
    taxaConclusaoSlaPorTipo,
  };
}
