import { calcularSlaKanbanCard } from '@/lib/kanban/kanban-card-sla';
import type { KanbanCardBrief, KanbanFase } from './types';

export type KanbanBoardFiltrosStatus = 'ativos' | 'arquivados' | 'concluidos';
export type KanbanBoardFiltrosSla = 'todos' | 'atrasados' | 'vence_hoje' | 'dentro_prazo';

export type KanbanBoardFiltros = {
  /** `todas` ou id da fase */
  fase: 'todas' | string;
  responsavel: 'todos' | 'eu' | string;
  sla: KanbanBoardFiltrosSla;
  status: KanbanBoardFiltrosStatus;
};

export const KANBAN_BOARD_FILTROS_DEFAULT: KanbanBoardFiltros = {
  fase: 'todas',
  responsavel: 'todos',
  sla: 'todos',
  status: 'ativos',
};

export function countKanbanBoardFiltrosAtivos(f: KanbanBoardFiltros): number {
  const d = KANBAN_BOARD_FILTROS_DEFAULT;
  let n = 0;
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
  const sla = calcularSlaKanbanCard({
    created_at: card.created_at,
    entered_fase_at: card.entered_fase_at,
    sla_iniciado_em: card.sla_iniciado_em,
    faseSlug: fase?.slug,
    alvara_url: card.alvara_url,
    docs_terreno_url: card.docs_terreno_url,
    sla_dias: fase?.sla_dias,
  });
  if (sla.status === 'atrasado') return 'atrasado';
  if (sla.label === 'Vence hoje') return 'vence_hoje';
  if (sla.status === 'atencao') return 'atencao_outros';
  return 'ok';
}

export function normalizeBuscaKanbanTexto(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

/** Qualquer token da busca que apareça no texto (sem acento, case-insensitive). */
export function textoMatchBuscaKanbanPalavras(texto: string, query: string): boolean {
  const q = normalizeBuscaKanbanTexto(query);
  if (!q) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  const textoNorm = normalizeBuscaKanbanTexto(texto ?? '');
  const palavras = textoNorm.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return tokens.some(
    (token) => textoNorm.includes(token) || palavras.some((palavra) => palavra.includes(token)),
  );
}

function labelDataCardKanbanBusca(dataIso: string): string {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const data = new Date(`${dataIso}T00:00:00`);
  const diffDias = Math.floor((data.getTime() - hoje.getTime()) / 86400000);
  if (diffDias < 0) return `Atrasado ${Math.abs(diffDias)}d`;
  if (diffDias === 0) return 'Hoje';
  if (diffDias === 1) return 'Amanhã';
  return `Em ${diffDias}d`;
}

/** Texto agregado com tudo que o card fechado exibe no board (para busca). */
export function textoVisivelCardKanbanFechado(
  card: KanbanCardBrief,
  fase?: KanbanFase | null,
): string {
  const partes: string[] = [
    card.titulo,
    card.status,
    card.motivo_arquivamento ?? '',
    card.profiles?.full_name ?? '',
    card.responsavel_fase_nome ?? '',
  ];

  if (card.origem !== 'legado' && card.arquivado) partes.push('ARQUIVADO');
  if (card.origem !== 'legado' && card.concluido) partes.push('CONCLUÍDO');

  if (card.data_reuniao) {
    partes.push('Reunião', labelDataCardKanbanBusca(card.data_reuniao), card.data_reuniao);
  }
  if (card.data_followup) {
    partes.push('Follow-up', 'Follow up', labelDataCardKanbanBusca(card.data_followup), card.data_followup);
  }

  for (const t of card.tagsCard ?? []) {
    partes.push(t.nome);
  }

  const created = new Date(card.created_at);
  if (!Number.isNaN(created.getTime())) {
    partes.push('Criado', created.toLocaleDateString('pt-BR'), created.toISOString().slice(0, 10));
    const sla = calcularSlaKanbanCard({
      created_at: card.created_at,
      entered_fase_at: card.entered_fase_at,
      sla_iniciado_em: card.sla_iniciado_em,
      faseSlug: fase?.slug,
      alvara_url: card.alvara_url,
      docs_terreno_url: card.docs_terreno_url,
      sla_dias: fase?.sla_dias,
    });
    if (sla.label) partes.push(sla.label);
    partes.push(sla.status);
  }

  return partes.filter(Boolean).join(' ');
}

/** Busca em qualquer informação visível no card fechado do Kanban. */
export function cardKanbanMatchBuscaVisivel(
  card: KanbanCardBrief,
  query: string,
  faseMap: Map<string, KanbanFase>,
): boolean {
  const fase = faseMap.get(card.fase_id);
  return textoMatchBuscaKanbanPalavras(textoVisivelCardKanbanFechado(card, fase), query);
}

export function cardPassaFiltrosBoard(
  card: KanbanCardBrief,
  f: KanbanBoardFiltros,
  faseMap: Map<string, KanbanFase>,
  currentUserId: string | null | undefined,
): boolean {
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
