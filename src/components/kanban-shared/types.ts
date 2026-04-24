import type { ReactNode } from 'react';

/** Nomes de kanban suportados pelo modal compartilhado (exibição / futuros temas). */
export type KanbanNomeDisplay =
  | 'Funil Step One'
  | 'Funil Moní INC'
  | 'Funil Portfólio'
  | 'Funil Acoplamento'
  | 'Funil Operações'
  | 'Funil Contabilidade'
  | 'Funil Crédito';

export type KanbanFaseMaterialTipo = 'link' | 'documento' | 'video';

export type KanbanFaseMaterial = {
  titulo: string;
  url: string;
  tipo: KanbanFaseMaterialTipo;
};

export type KanbanFase = {
  id: string;
  nome: string;
  ordem: number;
  sla_dias: number | null;
  /** Preenchido nas fases seedadas (migration 112); Funil Step One pode ser null. */
  slug?: string | null;
  /** Texto orientativo da fase (migration 129). */
  instrucoes?: string | null;
  /** Links / referências (migration 129). */
  materiais?: KanbanFaseMaterial[] | null;
};

export type KanbanCardBrief = {
  id: string;
  titulo: string;
  status: string;
  created_at: string;
  fase_id: string;
  franqueado_id: string;
  /** Cards nativos arquivados (`kanban_cards.arquivado`). Legado: ausente / false. */
  arquivado?: boolean;
  motivo_arquivamento?: string | null;
  /** Nativo: finalizado pelo usuário (`kanban_cards.concluido`). Legado: ausente / false. */
  concluido?: boolean;
  concluido_em?: string | null;
  /** `legado` quando o card veio de `processo_step_one` via view de compatibilidade. */
  origem?: 'legado' | 'nativo';
  profiles?: {
    full_name: string | null;
  } | null;
};

/** Conteúdo extra do checklist por `fase_id` (sobrescreve placeholder). */
export type CamposPorFaseMap = Record<string, ReactNode>;
