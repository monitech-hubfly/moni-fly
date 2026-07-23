import type { SupabaseClient } from '@supabase/supabase-js';
import type { KanbanFase } from '@/components/kanban-shared/types';
import type { HistoricoItem } from '@/components/kanban-shared/kanban-card-modal-helpers';
import { calcularDiasUteis, calcularDiasCorridos, adicionarDiasUteis, adicionarDiasCorridos, labelTagSlaFunil, normalizarSlaTipo, type SlaTipo } from '@/lib/dias-uteis';
import { augmentKanbanFasesComFasesDosCards, fetchKanbanFasesAtivas } from '@/lib/kanban/fetch-kanban-fases';
import { loadHistoricoCardModal } from '@/lib/kanban/kanban-card-historico';
import {
  buildNativeFaseTimeline,
  type LinhaCronologiaFase,
} from '@/lib/kanban/kanban-card-timeline';
import type { PipelineCardDisplay } from '@/lib/kanban/pipeline-cards-types';
import {
  diasNaFasePipeline,
  sincronizarLinhaFaseAtualComCard,
} from '@/lib/kanban/pipeline-card-readonly';
import {
  labelStatusOperacionalPipeline,
  statusOperacionalPipeline,
} from '@/lib/kanban/pipeline-progress-utils';

export type PipelineDrawerChamadoSirene = {
  id: string;
  sireneChamadoId: number | null;
  numero: number | null;
  titulo: string;
  status: string;
  href: string;
};

export type PipelineDrawerFaseHistorico = {
  faseId: string;
  faseNome: string;
  ordem: number;
  entrouEm: string | null;
  saiuEm: string | null;
  diasNaFase: number | null;
  slaLabel: string;
  slaClasse: string;
  atrasado: boolean;
  faseAtual: boolean;
};

export type PipelineCardDrawerData = {
  fasesPercorridas: PipelineDrawerFaseHistorico[];
  historicoParcial: boolean;
  chamadosSirene: PipelineDrawerChamadoSirene[];
  statusLabel: string;
  eventosBrutos: HistoricoItem[];
};

function calcularSlaHistoricoFase(
  entrouEm: string,
  saiuEm: string | null,
  slaDias: number | null,
  slaTipo: SlaTipo = 'uteis',
): { label: string; classe: string; atrasado: boolean } {
  if (slaDias == null || slaDias <= 0) {
    return { label: 'Sem SLA', classe: '', atrasado: false };
  }

  const entrada = new Date(entrouEm);
  entrada.setHours(0, 0, 0, 0);
  const referencia = saiuEm ? new Date(saiuEm) : new Date();
  referencia.setHours(0, 0, 0, 0);

  const vencimento =
    slaTipo === 'corridos'
      ? adicionarDiasCorridos(entrada, slaDias)
      : adicionarDiasUteis(entrada, slaDias);
  vencimento.setHours(0, 0, 0, 0);

  const diffDias =
    slaTipo === 'corridos'
      ? (a: Date, b: Date) => calcularDiasCorridos(a, b)
      : (a: Date, b: Date) => calcularDiasUteis(a, b);

  if (vencimento < referencia) {
    const diasAtraso = diffDias(vencimento, referencia);
    return {
      label: labelTagSlaFunil('atrasado', { diasAtraso, slaTipo }),
      classe: 'moni-tag-atrasado',
      atrasado: true,
    };
  }

  if (vencimento.getTime() === referencia.getTime()) {
    return { label: labelTagSlaFunil('atencao'), classe: 'moni-tag-atencao', atrasado: false };
  }

  const restantes = diffDias(referencia, vencimento);
  if (!saiuEm && restantes === 1) {
    return { label: labelTagSlaFunil('atencao'), classe: 'moni-tag-atencao', atrasado: false };
  }

  if (!saiuEm && restantes === 0) {
    return { label: labelTagSlaFunil('atencao'), classe: 'moni-tag-atencao', atrasado: false };
  }

  return {
    label: labelTagSlaFunil('ok'),
    classe: 'moni-tag-concluido',
    atrasado: false,
  };
}

function montarFasesPercorridas(
  linhas: LinhaCronologiaFase[],
  fases: KanbanFase[],
  faseAtualId: string,
  card: PipelineCardDisplay,
): PipelineDrawerFaseHistorico[] {
  const metaPorFase = new Map(fases.map((f) => [f.id, f]));

  return linhas
    .filter((l) => l.entrouEm)
    .sort((a, b) => {
      const oa = metaPorFase.get(a.faseId)?.ordem ?? a.ordem;
      const ob = metaPorFase.get(b.faseId)?.ordem ?? b.ordem;
      return oa - ob;
    })
    .map((l) => {
      const meta = metaPorFase.get(l.faseId);
      const faseAtual = l.faseId === faseAtualId;
      const entrouEm = l.entrouEm!;
      const saiuEm = faseAtual ? null : l.saiuEm;

      let slaLabel = 'Sem SLA';
      let slaClasse = '';
      let atrasado = false;

      if (faseAtual) {
        slaLabel = card.sla.label || 'Sem SLA';
        slaClasse = card.sla.classe;
        atrasado = card.sla.status === 'atrasado';
      } else {
        const sla = calcularSlaHistoricoFase(
          entrouEm,
          saiuEm,
          meta?.sla_dias ?? null,
          normalizarSlaTipo(meta?.sla_tipo),
        );
        slaLabel = sla.label;
        slaClasse = sla.classe;
        atrasado = sla.atrasado;
      }

      const linhaBase = {
        faseId: l.faseId,
        faseNome: faseAtual ? card.fase_nome || l.faseNome : l.faseNome,
        ordem: l.ordem,
        entrouEm,
        saiuEm,
        faseAtual,
      };

      return {
        ...linhaBase,
        diasNaFase: diasNaFasePipeline(linhaBase, card),
        slaLabel,
        slaClasse,
        atrasado,
      };
    });
}

function detectarHistoricoParcial(
  historico: HistoricoItem[],
  fasesPercorridas: PipelineDrawerFaseHistorico[],
): boolean {
  const moves = historico.filter(
    (h) => h.acao === 'fase_avancada' || h.acao === 'fase_retrocedida',
  );
  if (fasesPercorridas.length === 0) return true;
  if (moves.length === 0) return true;
  if (fasesPercorridas.some((f) => !f.entrouEm)) return true;
  return false;
}

async function fetchChamadosSireneCard(
  supabase: SupabaseClient,
  cardId: string,
): Promise<PipelineDrawerChamadoSirene[]> {
  const map = new Map<string, PipelineDrawerChamadoSirene>();

  const { data: atividades } = await supabase
    .from('kanban_atividades')
    .select('id, titulo, sirene_chamado_id, numero, status')
    .eq('card_id', cardId)
    .eq('arquivado', false);

  for (const row of atividades ?? []) {
    const id = String((row as { id?: string }).id ?? '').trim();
    if (!id) continue;
    const sidRaw = (row as { sirene_chamado_id?: number | null }).sirene_chamado_id;
    const sid = sidRaw != null && Number.isFinite(Number(sidRaw)) ? Number(sidRaw) : null;
    const numeroRaw = (row as { numero?: number | null }).numero;
    const numero = numeroRaw != null && Number.isFinite(Number(numeroRaw)) ? Number(numeroRaw) : null;
    map.set(`ka-${id}`, {
      id,
      sireneChamadoId: sid,
      numero,
      titulo: String((row as { titulo?: string | null }).titulo ?? '').trim() || 'Chamado',
      status: String((row as { status?: string | null }).status ?? '').trim() || '—',
      href: `/sirene/chamados?interacao=${encodeURIComponent(id)}`,
    });
  }

  const { data: sireneRows } = await supabase
    .from('sirene_chamados')
    .select('id, titulo, numero, status')
    .eq('card_id', cardId);

  for (const row of sireneRows ?? []) {
    const sid = Number((row as { id?: number }).id);
    if (!Number.isFinite(sid)) continue;
    const key = `sc-${sid}`;
    if ([...map.values()].some((c) => c.sireneChamadoId === sid)) continue;
    const numeroRaw = (row as { numero?: number | null }).numero;
    const numero = numeroRaw != null && Number.isFinite(Number(numeroRaw)) ? Number(numeroRaw) : sid;
    map.set(key, {
      id: String(sid),
      sireneChamadoId: sid,
      numero,
      titulo: String((row as { titulo?: string | null }).titulo ?? '').trim() || 'Chamado Sirene',
      status: String((row as { status?: string | null }).status ?? '').trim() || '—',
      href: `/sirene/chamados?id=${encodeURIComponent(String(sid))}`,
    });
  }

  return [...map.values()].sort((a, b) => {
    const na = a.numero ?? 0;
    const nb = b.numero ?? 0;
    if (na !== nb) return na - nb;
    return a.titulo.localeCompare(b.titulo, 'pt-BR');
  });
}

/** Carrega cronologia de fases e chamados Sirene reais para o mini-drawer do pipeline. */
export async function loadPipelineCardDrawerData(
  supabase: SupabaseClient,
  card: PipelineCardDisplay,
): Promise<PipelineCardDrawerData> {
  const [historico, fasesBase, chamadosSirene] = await Promise.all([
    loadHistoricoCardModal(
      supabase,
      card.id,
      card.origem,
      [],
      card.kanban_id,
      card.processo_step_one_id ?? null,
    ),
    fetchKanbanFasesAtivas(supabase, card.kanban_id),
    fetchChamadosSireneCard(supabase, card.id),
  ]);

  const fases = await augmentKanbanFasesComFasesDosCards(
    supabase,
    card.kanban_id,
    fasesBase,
    [card.fase_id],
  );

  const linhasCronologiaRaw = buildNativeFaseTimeline(
    fases,
    { created_at: card.created_at, fase_id: card.fase_id },
    historico.map((h) => ({ acao: h.acao, detalhe: h.detalhe, criado_em: h.criado_em })),
  );

  const linhasCronologia = sincronizarLinhaFaseAtualComCard(linhasCronologiaRaw, card);

  const fasesPercorridas = montarFasesPercorridas(linhasCronologia, fases, card.fase_id, card);
  const historicoParcial = detectarHistoricoParcial(historico, fasesPercorridas);
  const status = statusOperacionalPipeline(card);

  return {
    fasesPercorridas,
    historicoParcial,
    chamadosSirene,
    statusLabel: labelStatusOperacionalPipeline(status),
    eventosBrutos: historico,
  };
}

export function labelUnidadePipelineDrawer(card: PipelineCardDisplay): string {
  const fk = String(card.n_franquia ?? '').trim();
  const nome = String(card.franqueado_nome ?? '').trim();
  if (fk && nome) return `${fk} — ${nome}`;
  return fk || nome || '—';
}
