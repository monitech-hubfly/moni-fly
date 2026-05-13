export type PainelFaseDTO = {
  id: string;
  nome: string;
  ordem: number;
  sla_dias: number | null;
};

export type PainelCardDTO = {
  id: string;
  titulo: string;
  fase_id: string;
  created_at: string;
  franqueado_id: string;
  arquivado: boolean;
  concluido: boolean;
  concluido_em: string | null;
  status: string;
  motivo_arquivamento?: string | null;
};

export type PainelAtividadeDTO = {
  id: string;
  card_id: string;
  status: string;
  trava: boolean | null;
  tipo: string | null;
  responsavel_id: string | null;
  responsaveis_ids: string[] | null;
  created_at: string;
  data_vencimento: string | null;
};

export type PainelRetrocessoDTO = {
  card_id: string;
  detalhe: {
    fase_anterior_nome?: string;
    fase_nova_nome?: string;
    fase_anterior_id?: string;
    fase_nova_id?: string;
  } | null;
};

export type PainelPerformanceDataset = {
  mode: 'nativo' | 'legado';
  kanbanNome: string;
  kanbanId: string;
  fases: PainelFaseDTO[];
  cards: PainelCardDTO[];
  atividades: PainelAtividadeDTO[];
  retrocessoRows: PainelRetrocessoDTO[];
  profiles: Record<string, string>;
};

export type PainelPeriodKey = '7d' | '30d' | '90d' | 'all';
