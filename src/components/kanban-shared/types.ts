import type { ReactNode } from 'react';

/** Nomes de kanban suportados pelo modal compartilhado (exibição / futuros temas). */
export type KanbanNomeDisplay =
  | 'Funil Step One'
  | 'Funil Loteadores'
  | 'Funil Portfólio'
  | 'Funil Acoplamento'
  | 'Funil Jurídico'
  | 'Funil Moní Capital'
  | 'Funil Contratações'
  | 'Funil Produto'
  | 'Funil Modelo Virtual'
  | 'Funil Homologações'
  | 'Funil Projeto Legal'
  | 'Funil Projetos Locais'
  | 'Funil Projetos Legais'
  | 'Funil Pré Obra e Obra'
  | 'Funil Contabilidade'
  | 'Funil Crédito Obra';

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
  /** Marcada pelo admin como fase de conversão (migration 387). */
  fase_conversao?: boolean;
};

export type KanbanCardBrief = {
  id: string;
  titulo: string;
  status: string;
  created_at: string;
  fase_id: string;
  franqueado_id: string;
  kanban_id?: string;
  projeto_id?: string | null;
  tagsCard?: { tag_id: string; nome: string; cor: string }[];
  /** Cards nativos arquivados (`kanban_cards.arquivado`). Legado: ausente / false. */
  arquivado?: boolean;
  motivo_arquivamento?: string | null;
  /** Nativo: finalizado pelo usuário (`kanban_cards.concluido`). Legado: ausente / false. */
  concluido?: boolean;
  concluido_em?: string | null;
  /** `legado` quando o card veio de `processo_step_one` via view de compatibilidade. */
  origem?: 'legado' | 'nativo';
  /** Linha secundária no card do board (ex.: interlocutor no Funil Loteadores). */
  subtitulo?: string | null;
  profiles?: {
    full_name: string | null;
  } | null;
  /** ISO date `YYYY-MM-DD` ou null (nativo e legado). */
  data_reuniao?: string | null;
  data_followup?: string | null;
  /** Retorno de bastões paralelos (migration 208). */
  acoplamento_concluido?: boolean;
  /** Fase atual do filho no Funil Acoplamento (tag no card pai). */
  acoplamento_filho_fase_nome?: string | null;
  acoplamento_filho_fase_slug?: string | null;
  credito_terreno_ok?: boolean;
  contabilidade_ok?: boolean;
  capital_ok?: boolean;
  juridico_ok?: boolean;
  credito_obra_ok?: boolean;
  /** Step One: fase atual do card Portfolio com mesmo `projeto_id`. */
  portfolio_vinculo_rotulo?: string | null;
  /** Portfolio: existe card filho no Funil Jurídico (`origem_card_id`). */
  tem_filho_juridico?: boolean;
  /** Portfolio: existe card filho no Funil Acoplamento (`origem_card_id`). */
  tem_filho_acoplamento?: boolean;
  /** Portfolio: filho Acoplamento arquivado (sem filho ativo). */
  filho_acoplamento_arquivado?: boolean;
  /** Ordem na coluna (menor = mais acima). Nativo: `kanban_cards.ordem_coluna`; legado: `processo_step_one.ordem_coluna_painel`. */
  ordem_coluna?: number | null;
  /** Funil Crédito Obra — fase co_documentacao_alvara */
  alvara_url?: string | null;
  docs_terreno_url?: string | null;
  /** Entrada na fase atual — base do SLA por fase (migration 213). */
  entered_fase_at?: string | null;
  /** Início do SLA (após documentação completa ou outras regras de fase). */
  sla_iniciado_em?: string | null;
  /** Responsável preenchido no checklist da fase atual (`responsavel_fase`). */
  responsavel_fase_id?: string | null;
  responsavel_fase_nome?: string | null;
};

/** Conteúdo extra do checklist por `fase_id` (sobrescreve placeholder). */
export type CamposPorFaseMap = Record<string, ReactNode>;
