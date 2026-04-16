import type { ReactNode } from 'react';

/** Nomes de kanban suportados pelo modal compartilhado (exibição / futuros temas). */
export type KanbanNomeDisplay =
  | 'Funil Step One'
  | 'Funil Portfólio'
  | 'Funil Operações'
  | 'Funil Contabilidade'
  | 'Funil Crédito';

export type KanbanFase = {
  id: string;
  nome: string;
  ordem: number;
  sla_dias: number | null;
  /** Preenchido nas fases seedadas (migration 112); Funil Step One pode ser null. */
  slug?: string | null;
};

export type KanbanCardBrief = {
  id: string;
  titulo: string;
  status: string;
  created_at: string;
  fase_id: string;
  franqueado_id: string;
  /** `legado` quando o card veio de `processo_step_one` via view de compatibilidade. */
  origem?: 'legado' | 'nativo';
  profiles?: {
    full_name: string | null;
  } | null;
};

/** Conteúdo extra do checklist por `fase_id` (sobrescreve placeholder). */
export type CamposPorFaseMap = Record<string, ReactNode>;
