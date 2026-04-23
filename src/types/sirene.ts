/**
 * Tipos Sirene — Central de Chamados (ex-R.I.P.)
 * Inclui exceção HDM: tipo 'padrao' | 'hdm', hdm_responsavel, redirecionamento.
 */

export type ChamadoStatus =
  | 'nao_iniciado'
  | 'em_andamento'
  | 'concluido'
  | 'aguardando_aprovacao_criador';

export type TopicoStatus = 'nao_iniciado' | 'em_andamento' | 'concluido' | 'aprovado';

export type ChamadoTipo = 'padrao' | 'hdm';

export type HdmTime = 'Homologações' | 'Produto' | 'Modelo Virtual';

export interface Chamado {
  id: number;
  numero: number;
  data_abertura: string;
  time_abertura: string | null;
  /** Responsável escolhido no modal de abertura (lista fixa por time). */
  abertura_responsavel_nome?: string | null;
  frank_id: string | null;
  frank_nome: string | null;
  aberto_por: string | null;
  aberto_por_nome: string | null;
  trava: boolean;
  incendio: string;
  te_trata: boolean | null;
  prioridade: string;
  status: ChamadoStatus;
  resolucao_pontual: string | null;
  data_inicio_atendimento: string | null;
  data_conclusao: string | null;
  tema: string | null;
  mapeamento_pericia: string | null;
  parecer_final: string | null;
  resolucao_suficiente: boolean | null;
  motivo_insuficiente: string | null;
  created_at: string;
  updated_at: string;
  // HDM
  tipo: ChamadoTipo;
  hdm_responsavel: HdmTime | null;
  hdm_redirecionado_por: string | null;
  hdm_redirecionado_em: string | null;
}

export interface Topico {
  id: number;
  chamado_id: number;
  ordem: number;
  descricao: string;
  time_responsavel: string;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  trava: boolean;
  status: TopicoStatus;
  resolucao_time: string | null;
  aprovado_bombeiro: boolean | null;
  motivo_reprovacao: string | null;
  created_at: string;
  updated_at: string;
}

export interface Mensagem {
  id: number;
  chamado_id: number;
  autor_id: string | null;
  autor_nome: string | null;
  autor_time: string | null;
  texto: string;
  mencoes: string[] | null;
  created_at: string;
}

export interface Notificacao {
  id: number;
  user_id: string;
  chamado_id: number | null;
  tipo: string;
  lida: boolean;
  texto: string | null;
  created_at: string;
}

export interface Pericia {
  id: number;
  nome_pericia: string;
  time_responsavel: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  data_inicio: string | null;
  status: string;
  prioridade: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export type RedirecionarHDMInput = {
  chamadoId: number;
  hdmResponsavel: HdmTime;
  observacao?: string;
};
