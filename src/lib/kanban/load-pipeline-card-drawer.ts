import type { SupabaseClient } from '@supabase/supabase-js';
import type { KanbanFase } from '@/components/kanban-shared/types';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { creditoLateralFromRaw, creditoLateralVazio, type CreditoLateral } from '@/lib/kanban/credito-lateral';
import type { FaseNegocioPrazoOpcao } from '@/lib/kanban/dados-negocio-prazo';
import {
  operacoesPreObraDraftFromCard,
  type OperacoesPreObraDraft,
} from '@/lib/kanban/previsibilidade-operacoes';
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
  fetchKanbanCardModalDetalhes,
  type KanbanCardModalDetalhes,
} from '@/lib/kanban/kanban-card-modal-detalhes';
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
  detalhes: KanbanCardModalDetalhes | null;
  /** Campos da lateral que ficam no card (Pré Obra e Crédito), inclusive dos cards vinculados ao projeto. */
  preObra: OperacoesPreObraDraft;
  credito: CreditoLateral;
  fases: KanbanFase[];
  fasesPrazo: FaseNegocioPrazoOpcao[];
  linhasCronologia: LinhaCronologiaFase[];
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

const SIDEBAR_CARD_SELECT = [
  'id',
  'kanban_id',
  'credito_lateral',
  'docs_condominio',
  'docs_lote',
  'link_projeto_legal',
  'condominio_aprovada_em',
  'datas_comunique_se_condominio',
  'prefeitura_aprovada_em',
  'datas_comunique_se_prefeitura',
  'alvara_emitido_em',
  'data_envio_credito_obra',
  'data_aprovacao_credito_obra',
  'data_inicio_obra',
].join(',');

const PREOBRA_KEYS = [
  'docs_condominio',
  'docs_lote',
  'link_projeto_legal',
  'condominio_aprovada_em',
  'datas_comunique_se_condominio',
  'prefeitura_aprovada_em',
  'datas_comunique_se_prefeitura',
  'alvara_emitido_em',
  'data_envio_credito_obra',
  'data_aprovacao_credito_obra',
  'data_inicio_obra',
] as const;

function valorPreenchido(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function scoreCredito(raw: unknown): number {
  const credito = creditoLateralFromRaw(raw);
  const tranches = [
    ...credito.terreno_tranches,
    ...credito.obra_tranches,
    ...credito.alavancagem_tranches,
  ];
  return (
    tranches.filter((t) => t.valor.trim() || t.data).length +
    (credito.alavancagem_valor.trim() ? 1 : 0)
  );
}

/** Junta Pré Obra e Crédito dos cards do mesmo projeto (o valor preenchido vale, mesmo se estiver no card irmão). */
async function fetchSidebarExtrasProjeto(
  supabase: SupabaseClient,
  card: PipelineCardDisplay,
): Promise<{ preObra: OperacoesPreObraDraft; credito: CreditoLateral }> {
  const vazio = {
    preObra: operacoesPreObraDraftFromCard(null),
    credito: creditoLateralVazio(),
  };

  const procId = String(card.processo_step_one_id ?? '').trim();
  const projetoId = String(card.projeto_id ?? '').trim();
  const filtros = [`id.eq.${card.id}`];
  if (procId) filtros.push(`processo_step_one_id.eq.${procId}`);
  if (projetoId && projetoId !== procId) filtros.push(`projeto_id.eq.${projetoId}`);

  const { data, error } = await supabase
    .from('kanban_cards')
    .select(SIDEBAR_CARD_SELECT)
    .or(filtros.join(','));

  if (error || !data?.length) {
    if (error) console.error('[fetchSidebarExtrasProjeto]', error.message);
    return vazio;
  }

  const rows = data as unknown as Record<string, unknown>[];
  const clicked = rows.find((row) => String(row.id) === card.id);
  const operacoes = rows.filter((row) => String(row.kanban_id) === KANBAN_IDS.OPERACOES);
  const ordem = [clicked, ...operacoes, ...rows].filter((row): row is Record<string, unknown> => row != null);

  const merged: Record<string, unknown> = {};
  for (const key of PREOBRA_KEYS) {
    for (const row of ordem) {
      if (!valorPreenchido(row[key])) continue;
      merged[key] = row[key];
      break;
    }
  }

  let creditoRaw: unknown = null;
  let melhor = -1;
  for (const row of ordem) {
    const score = scoreCredito(row.credito_lateral);
    if (score > melhor) {
      melhor = score;
      creditoRaw = row.credito_lateral;
    }
  }

  return {
    preObra: operacoesPreObraDraftFromCard(merged),
    credito: creditoLateralFromRaw(creditoRaw),
  };
}

/** Carrega cronologia de fases e chamados Sirene reais para o mini-drawer do pipeline. */
export async function loadPipelineCardDrawerData(
  supabase: SupabaseClient,
  card: PipelineCardDisplay,
): Promise<PipelineCardDrawerData> {
  const [historico, fasesBase, chamadosSirene, detalhes, sidebar] = await Promise.all([
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
    fetchKanbanCardModalDetalhes(supabase, {
      origem: card.origem,
      cardId: card.id,
      cardTitulo: card.titulo,
      redeFranqueadoId: card.rede_franqueado_id,
      cardProjetoId: card.projeto_id ?? null,
      cardProcessoStepOneId: card.processo_step_one_id ?? null,
    }),
    fetchSidebarExtrasProjeto(supabase, card),
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
    detalhes,
    preObra: sidebar.preObra,
    credito: sidebar.credito,
    fases,
    fasesPrazo: fases.map((fase) => ({ id: fase.id, label: fase.nome })),
    linhasCronologia,
  };
}

export function labelUnidadePipelineDrawer(card: PipelineCardDisplay): string {
  const fk = String(card.n_franquia ?? '').trim();
  const nome = String(card.franqueado_nome ?? '').trim();
  if (fk && nome) return `${fk} — ${nome}`;
  return fk || nome || '—';
}
