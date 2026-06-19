import { buildNativeFaseTimeline } from '@/lib/kanban/kanban-card-timeline';
import { FASE_SLUGS } from '@/lib/constants/kanban-ids';
import { calcularDiasUteis } from '@/lib/dias-uteis';
import type {
  PainelCardDTO,
  PainelCreditoObraOperacoesIrmaoDTO,
  PainelFaseDTO,
  PainelHistoricoMovimentoDTO,
} from '@/lib/kanban/painel-performance-types';

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

function diasNaFaseViaTimeline(
  card: PainelCardDTO,
  faseId: string,
  fasesOrd: PainelFaseDTO[],
  historico: PainelHistoricoMovimentoDTO[],
): { dias: number | null; saiuEm: string | null; entrouEm: string | null } {
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
      if (Number.isFinite(a) && b >= a) {
        return {
          dias: (b - a) / (24 * 60 * 60 * 1000),
          saiuEm: null,
          entrouEm: card.entered_fase_at,
        };
      }
    }
    return { dias: null, saiuEm: null, entrouEm: null };
  }
  const fim = linha.saiuEm ?? new Date().toISOString();
  const a = new Date(linha.entrouEm).getTime();
  const b = new Date(fim).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) {
    return { dias: null, saiuEm: linha.saiuEm ?? null, entrouEm: linha.entrouEm };
  }
  return {
    dias: (b - a) / (24 * 60 * 60 * 1000),
    saiuEm: linha.saiuEm ?? null,
    entrouEm: linha.entrouEm,
  };
}

function concluiuDentroSlaUteis(entrouEm: string, saiuEm: string, slaDias: number): boolean {
  const a = new Date(entrouEm);
  const b = new Date(saiuEm);
  if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime())) return false;
  return calcularDiasUteis(a, b) <= slaDias;
}

function isCreditoObraAguardandoSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '')
    .trim()
    .toLowerCase()
    .includes('aguardando');
}

export type PainelContabilidadeTipoRow = {
  tipo: string;
  mediaDias: number | null;
  amostras: number;
};

export type PainelContabilidadeSlaTipoRow = {
  tipo: string;
  dentroSla: number;
  concluidos: number;
  taxaPct: number | null;
};

export type PainelContabilidadeEspecificidades = {
  tempoAberturaPorTipo: {
    linhas: PainelContabilidadeTipoRow[];
    historicoParcial: boolean;
  } | null;
  bloqueandoCreditoObra: {
    totalBloqueando: number;
    porTipoAbertura: PainelContabilidadeTipoRow[];
    creditoObraIndisponivel: boolean;
    projetoIndisponivel: boolean;
  } | null;
  taxaConclusaoSlaPorTipo: {
    linhas: PainelContabilidadeSlaTipoRow[];
    semSlaConfigurado: boolean;
  } | null;
};

/** Métricas específicas do Funil Contabilidade. Degrada por bloco quando dados ausentes. */
export function computeContabilidadeEspecificidades(input: {
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

  const slugPorFaseId = new Map(input.fases.map((f) => [f.id, String(f.slug ?? '').trim()]));
  const coSlugPorFaseId = new Map(
    (input.creditoObraFases ?? []).map((f) => [f.id, String(f.slug ?? '').trim()]),
  );

  let tempoAberturaPorTipo: PainelContabilidadeEspecificidades['tempoAberturaPorTipo'] = null;
  try {
    const linhas: PainelContabilidadeTipoRow[] = [];
    let historicoParcial = false;

    for (const tipo of TIPOS_ABERTURA) {
      const faseIds = faseIdsPorSlugs(input.fases, [tipo.slug]);
      if (faseIds.length === 0) continue;

      const tempos: number[] = [];
      for (const c of input.cards) {
        const historico = historicoPorCard.get(c.id) ?? [];
        const temMov = historico.some(
          (h) =>
            h.acao === 'fase_avancada' || h.acao === 'fase_retrocedida' || h.acao === 'card_criado',
        );
        if (!temMov) historicoParcial = true;

        for (const faseId of faseIds) {
          const { dias } = diasNaFaseViaTimeline(c, faseId, fasesOrd, historico);
          if (dias != null) tempos.push(dias);
        }
      }

      linhas.push({
        tipo: tipo.label,
        mediaDias:
          tempos.length === 0 ? null : tempos.reduce((s, n) => s + n, 0) / tempos.length,
        amostras: tempos.length,
      });
    }

    if (linhas.length > 0) {
      tempoAberturaPorTipo = { linhas, historicoParcial };
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
      !input.creditoObraFases?.length ||
      !input.creditoObraIrmaos?.length;

    const irmaosAguardandoPorProjeto = new Map<string, PainelCreditoObraOperacoesIrmaoDTO>();
    for (const irmao of input.creditoObraIrmaos ?? []) {
      if (!cardAtivo(irmao)) continue;
      const slug = coSlugPorFaseId.get(irmao.fase_id) ?? '';
      if (!isCreditoObraAguardandoSlug(slug)) continue;
      const pid = irmao.projeto_id.trim();
      if (!pid) continue;
      if (!irmaosAguardandoPorProjeto.has(pid)) irmaosAguardandoPorProjeto.set(pid, irmao);
    }

    const porTipoMap = new Map<string, number>();
    for (const t of TIPOS_ABERTURA) porTipoMap.set(t.label, 0);

    let totalBloqueando = 0;

    if (!projetoIndisponivel && !creditoObraIndisponivel) {
      for (const c of input.cards) {
        if (!cardAtivo(c)) continue;
        if (concluidoIds.has(c.fase_id)) continue;
        const pid = c.projeto_id?.trim();
        if (!pid) continue;
        if (!irmaosAguardandoPorProjeto.has(pid)) continue;

        totalBloqueando += 1;
        const slugAtual = slugPorFaseId.get(c.fase_id) ?? '';
        const tipo =
          TIPOS_ABERTURA.find((t) => t.slug === slugAtual)?.label ??
          (slugAtual ? slugAtual : 'Tipo não identificado');
        porTipoMap.set(tipo, (porTipoMap.get(tipo) ?? 0) + 1);
      }
    }

    bloqueandoCreditoObra = {
      totalBloqueando,
      porTipoAbertura: [...porTipoMap.entries()]
        .filter(([, n]) => n > 0)
        .map(([tipo, amostras]) => ({ tipo, mediaDias: null, amostras })),
      creditoObraIndisponivel,
      projetoIndisponivel,
    };
  } catch {
    bloqueandoCreditoObra = null;
  }

  let taxaConclusaoSlaPorTipo: PainelContabilidadeEspecificidades['taxaConclusaoSlaPorTipo'] = null;
  try {
    const linhas: PainelContabilidadeSlaTipoRow[] = [];
    let semSlaConfigurado = true;

    for (const tipo of TIPOS_ABERTURA) {
      const faseIds = faseIdsPorSlugs(input.fases, [tipo.slug]);
      if (faseIds.length === 0) continue;

      let dentroSla = 0;
      let concluidos = 0;

      for (const faseId of faseIds) {
        const fase = fasePorId(input.fases, faseId);
        const slaDias = fase?.sla_dias;
        if (slaDias != null && slaDias > 0 && slaDias < 999) semSlaConfigurado = false;

        for (const c of input.cards) {
          const historico = historicoPorCard.get(c.id) ?? [];
          const { saiuEm, entrouEm } = diasNaFaseViaTimeline(c, faseId, fasesOrd, historico);
          if (!saiuEm || !entrouEm) continue;
          if (slaDias == null || slaDias <= 0 || slaDias >= 999) continue;

          concluidos += 1;
          if (concluiuDentroSlaUteis(entrouEm, saiuEm, slaDias)) dentroSla += 1;
        }
      }

      if (concluidos > 0 || faseIds.length > 0) {
        linhas.push({
          tipo: tipo.label,
          dentroSla,
          concluidos,
          taxaPct: concluidos === 0 ? null : (dentroSla / concluidos) * 100,
        });
      }
    }

    if (linhas.length > 0) {
      taxaConclusaoSlaPorTipo = { linhas, semSlaConfigurado };
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
