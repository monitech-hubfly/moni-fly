import { calcularStatusSLA } from '@/lib/dias-uteis';
import type { KanbanCardBrief, KanbanFase } from './types';

export type KanbanBoardFiltrosStatus = 'ativos' | 'arquivados' | 'concluidos';
export type KanbanBoardFiltrosSla = 'todos' | 'atrasados' | 'vence_hoje' | 'dentro_prazo';

export type KanbanBoardFiltros = {
  busca: string;
  /** `todas` ou id da fase */
  fase: 'todas' | string;
  responsavel: 'todos' | 'eu' | string;
  sla: KanbanBoardFiltrosSla;
  status: KanbanBoardFiltrosStatus;
};

export const KANBAN_BOARD_FILTROS_DEFAULT: KanbanBoardFiltros = {
  busca: '',
  fase: 'todas',
  responsavel: 'todos',
  sla: 'todos',
  status: 'ativos',
};

export function countKanbanBoardFiltrosAtivos(f: KanbanBoardFiltros): number {
  const d = KANBAN_BOARD_FILTROS_DEFAULT;
  let n = 0;
  if (f.busca.trim() !== '') n++;
  if (f.fase !== d.fase) n++;
  if (f.responsavel !== d.responsavel) n++;
  if (f.sla !== d.sla) n++;
  if (f.status !== d.status) n++;
  return n;
}

function isCardArquivado(c: KanbanCardBrief): boolean {
  return c.origem !== 'legado' && Boolean(c.arquivado);
}

function isCardConcluido(c: KanbanCardBrief): boolean {
  return c.origem !== 'legado' && Boolean(c.concluido);
}

/** Pool visível conforme STATUS (antes dos filtros de busca / fase / responsável / SLA). */
export function poolCardsPorStatus(
  status: KanbanBoardFiltrosStatus,
  cards: KanbanCardBrief[],
  cardsConcluidos: KanbanCardBrief[],
): KanbanCardBrief[] {
  if (status === 'arquivados') return cards.filter((c) => isCardArquivado(c));
  if (status === 'concluidos') return cardsConcluidos;
  return cards.filter((c) => {
    if (c.origem === 'legado') return true;
    return !c.arquivado && !c.concluido;
  });
}

function slaCategoria(
  card: KanbanCardBrief,
  faseMap: Map<string, KanbanFase>,
): 'atrasado' | 'vence_hoje' | 'atencao_outros' | 'ok' {
  const fase = faseMap.get(card.fase_id);
  const slaDias = fase?.sla_dias ?? 999;
  const created = new Date(card.created_at);
  const sla = calcularStatusSLA(created, slaDias);
  if (sla.status === 'atrasado') return 'atrasado';
  if (sla.label === 'Vence hoje') return 'vence_hoje';
  if (sla.status === 'atencao') return 'atencao_outros';
  return 'ok';
}

export function cardPassaFiltrosBoard(
  card: KanbanCardBrief,
  f: KanbanBoardFiltros,
  faseMap: Map<string, KanbanFase>,
  currentUserId: string | null | undefined,
): boolean {
  const q = f.busca.trim().toLowerCase();
  if (q) {
    const titulo = (card.titulo ?? '').toLowerCase();
    const nome = (card.profiles?.full_name ?? '').toLowerCase();
    if (!titulo.includes(q) && !nome.includes(q)) return false;
  }

  if (f.fase !== 'todas' && card.fase_id !== f.fase) return false;

  if (f.responsavel === 'eu') {
    if (!currentUserId || card.franqueado_id !== currentUserId) return false;
  } else if (f.responsavel !== 'todos') {
    if (card.franqueado_id !== f.responsavel) return false;
  }

  if (f.sla !== 'todos') {
    const cat = slaCategoria(card, faseMap);
    if (f.sla === 'atrasados' && cat !== 'atrasado') return false;
    if (f.sla === 'vence_hoje' && cat !== 'vence_hoje') return false;
    if (f.sla === 'dentro_prazo' && (cat === 'atrasado' || cat === 'vence_hoje')) return false;
  }

  return true;
}
