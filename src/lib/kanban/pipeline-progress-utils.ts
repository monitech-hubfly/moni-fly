import {
  formatDataEntradaFaseAtualKanbanCard,
  calcularDiasNaFase,
} from '@/lib/kanban/pipeline-card-readonly';
import {
  ESTEIRA_PRINCIPAL_ETAPAS,
  indiceEstagioEsteiraPrincipal,
  isFunilEsteiraPrincipal,
  ordemFaseMaxEstimadaEsteira,
} from '@/lib/kanban/pipeline-esteira-principal';
import type { PipelineCardDisplay } from '@/lib/kanban/pipeline-cards-types';
import { slaCategoriaPipeline } from '@/lib/kanban/pipeline-cards-utils';

export type PipelineStatusOperacional = 'em_dia' | 'atrasado' | 'vencendo_breve' | 'sem_movimentacao';

export type PipelineEsteiraEtapaProgresso = {
  id: string;
  label: string;
  kanbanId: string;
  estado: 'concluida' | 'atual' | 'futura';
  /** 0–1 — preenchimento dentro da etapa atual (fase real do kanban). */
  progressoIntrafase: number;
};

export type PipelineEsteiraProgresso = {
  etapas: PipelineEsteiraEtapaProgresso[];
  indiceAtual: number;
  funilAtualNome: string;
  faseAtualNome: string;
  funilParalelo: boolean;
};

export type PipelineProgressCardMeta = {
  cardId: string;
  titulo: string;
  unidadeLabel: string;
  funilAtual: string;
  faseAtual: string;
  dataEntradaFase: string | null;
  diasNaFase: number;
  slaLabel: string;
  slaClasse: string;
  slaPausado: boolean;
  statusOperacional: PipelineStatusOperacional;
  statusLabel: string;
  progresso: PipelineEsteiraProgresso;
};

const STATUS_LABEL: Record<PipelineStatusOperacional, string> = {
  em_dia: 'Em dia',
  atrasado: 'Atrasado',
  vencendo_breve: 'Vencendo em breve',
  sem_movimentacao: 'Sem movimentação',
};

export function statusOperacionalPipeline(card: PipelineCardDisplay): PipelineStatusOperacional {
  if (card.inativo) return 'sem_movimentacao';
  const cat = slaCategoriaPipeline(card);
  if (cat === 'atrasado') return 'atrasado';
  if (cat === 'vence_hoje' || cat === 'atencao_outros') return 'vencendo_breve';
  return 'em_dia';
}

export function labelStatusOperacionalPipeline(status: PipelineStatusOperacional): string {
  return STATUS_LABEL[status];
}

export { calcularDiasNaFase } from '@/lib/kanban/pipeline-card-readonly';

function progressoIntrafaseCard(card: PipelineCardDisplay): number {
  const ordem = Math.max(0, Number(card.fase_ordem ?? 0));
  const max = Math.max(1, ordemFaseMaxEstimadaEsteira(card.kanban_id));
  if (ordem <= 0) return 0.08;
  return Math.min(0.98, ordem / max);
}

export function montarProgressoEsteiraPrincipal(card: PipelineCardDisplay): PipelineEsteiraProgresso {
  const indiceAtual = indiceEstagioEsteiraPrincipal(card.kanban_id);
  const intrafase = progressoIntrafaseCard(card);
  const funilParalelo = !isFunilEsteiraPrincipal(card.kanban_id);

  const etapas: PipelineEsteiraEtapaProgresso[] = ESTEIRA_PRINCIPAL_ETAPAS.map((etapa, idx) => {
    let estado: PipelineEsteiraEtapaProgresso['estado'];
    if (idx < indiceAtual) estado = 'concluida';
    else if (idx === indiceAtual) estado = 'atual';
    else estado = 'futura';

    return {
      id: etapa.id,
      label: etapa.label,
      kanbanId: etapa.kanbanId,
      estado,
      progressoIntrafase: estado === 'atual' ? intrafase : estado === 'concluida' ? 1 : 0,
    };
  });

  return {
    etapas,
    indiceAtual,
    funilAtualNome: card.kanban_nome,
    faseAtualNome: card.fase_nome,
    funilParalelo,
  };
}

function labelUnidadePipeline(card: PipelineCardDisplay): string {
  const fk = String(card.n_franquia ?? '').trim();
  const nome = String(card.franqueado_nome ?? '').trim();
  if (fk && nome) return `${fk} — ${nome}`;
  return fk || nome || '—';
}

export function montarPipelineProgressCardMeta(card: PipelineCardDisplay): PipelineProgressCardMeta {
  const statusOperacional = statusOperacionalPipeline(card);

  return {
    cardId: card.id,
    titulo: card.titulo,
    unidadeLabel: labelUnidadePipeline(card),
    funilAtual: card.kanban_nome,
    faseAtual: card.fase_nome,
    dataEntradaFase: formatDataEntradaFaseAtualKanbanCard(card),
    diasNaFase: calcularDiasNaFase(card),
    slaLabel: card.sla.label,
    slaClasse: card.sla.classe,
    slaPausado: card.sla.pausado,
    statusOperacional,
    statusLabel: labelStatusOperacionalPipeline(statusOperacional),
    progresso: montarProgressoEsteiraPrincipal(card),
  };
}
