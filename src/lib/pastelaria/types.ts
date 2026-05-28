import type { Json } from '@/types/database.gen';

export type PastelariaColuna = 'inbox' | 'mapped' | 'doing' | 'done';
export type PastelariaEstimativaUnidade = 'h' | 'min';
export type PastelariaReclassAction = 'redirect' | 'return';

export type PastelariaLogAcao =
  | 'criado'
  | 'coluna_alterada'
  | 'aceito'
  | 'reclassificado'
  | 'horas_registradas'
  | 'editado'
  | 'excluido'
  | 'pessoa_adicionada';

export interface PastelariaCardRow {
  id: string;
  nome: string;
  area_id: string | null;
  estimativa_valor: number;
  estimativa_unidade: PastelariaEstimativaUnidade;
  coluna: PastelariaColuna;
  semana_origem: string;
  source: string | null;
  opened_by: string | null;
  completed_week: string | null;
  reclassificado: boolean | null;
  reclassificado_em: string | null;
  reclassificado_destino: string | null;
  reclassificado_justificativa: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  sirene_chamado_id?: number | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PastelariaHorasRow {
  id: string;
  card_id: string;
  semana: string;
  seg: number | null;
  ter: number | null;
  qua: number | null;
  qui: number | null;
  sex: number | null;
  seg_unidade: PastelariaEstimativaUnidade | null;
  ter_unidade: PastelariaEstimativaUnidade | null;
  qua_unidade: PastelariaEstimativaUnidade | null;
  qui_unidade: PastelariaEstimativaUnidade | null;
  sex_unidade: PastelariaEstimativaUnidade | null;
  /** Legado — leitura antiga; preferir *_unidade por dia */
  unidade?: PastelariaEstimativaUnidade | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CreatePastelariaCardBody {
  nome?: string;
  area_id?: string | null;
  estimativa_valor?: number;
  estimativa_unidade?: PastelariaEstimativaUnidade;
  semana_origem?: string;
  source?: string | null;
  opened_by?: string | null;
  responsavel_id?: string | null;
  responsavel_nome?: string | null;
}

export interface UpdatePastelariaCardBody {
  nome?: string;
  area_id?: string | null;
  estimativa_valor?: number;
  estimativa_unidade?: PastelariaEstimativaUnidade;
  coluna?: PastelariaColuna;
  completed_week?: string | null;
  responsavel_id?: string | null;
  responsavel_nome?: string | null;
}

export interface ReclassificarPastelariaCardBody {
  action?: PastelariaReclassAction;
  destino?: string | null;
  justificativa?: string;
}

export interface UpsertPastelariaHorasBody {
  semana?: string;
  seg?: number;
  ter?: number;
  qua?: number;
  qui?: number;
  sex?: number;
  seg_unidade?: PastelariaEstimativaUnidade;
  ter_unidade?: PastelariaEstimativaUnidade;
  qua_unidade?: PastelariaEstimativaUnidade;
  qui_unidade?: PastelariaEstimativaUnidade;
  sex_unidade?: PastelariaEstimativaUnidade;
}

export type PastelariaHorasSemanaSave = {
  semana: string;
  seg: number;
  seg_unidade: PastelariaEstimativaUnidade;
  ter: number;
  ter_unidade: PastelariaEstimativaUnidade;
  qua: number;
  qua_unidade: PastelariaEstimativaUnidade;
  qui: number;
  qui_unidade: PastelariaEstimativaUnidade;
  sex: number;
  sex_unidade: PastelariaEstimativaUnidade;
};

export interface ReclassificarPastelariaCardResponse {
  ok: boolean;
  action: PastelariaReclassAction;
  destino: string | null;
}

export interface PastelariaGanttSemanaRow {
  semana: string;
  total_cards: number;
  total_horas: number;
  cards: Json;
}

export type PastelariaLogDetalhes = Json;
