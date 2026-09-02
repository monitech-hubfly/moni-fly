export type PortfolioSaudeRow = {
  card_id: string;
  titulo: string;
  rede_franqueado_id: string | null;
  franqueado_nome: string | null;
  n_franquia: string | null;
  fase_slug: string | null;
  fase_nome: string | null;
  fase_ordem: number;
  acoplamento_concluido: boolean;
  credito_terreno_ok: boolean;
  contabilidade_ok: boolean;
  juridico_ok: boolean;
  capital_ok: boolean;
  credito_obra_ok: boolean;
  capital_aplicavel: boolean;
  created_at: string;
  updated_at: string;
  data_step3_opcao: string | null;
  data_step5_comite: string | null;
  data_step7_contrato: string | null;
};

export type PortfolioSaudeFranqueadoBase = {
  rede_franqueado_id: string;
  franqueado_nome: string | null;
  n_franquia: string | null;
  ordem: number;
};

/** Bloco por unidade de franquia: cabeçalho do franqueado + cards ativos no Portfolio (pode ser vazio). */
export type PortfolioSaudeBlocoFranqueado = PortfolioSaudeFranqueadoBase & {
  cards: PortfolioSaudeRow[];
};
