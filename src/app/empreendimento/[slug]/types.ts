// src/app/empreendimento/[slug]/types.ts

export type LotePublicoEmp = {
  id: string;
  codigo: string;
  valor: number;
  acoplamento: number; // valor de acoplamento do lote (vem da planilha, coluna Acoplamento)
  /** Dimensões — a planilha pública ainda não traz esses campos (TODO). */
  frente_m: number | null;
  fundo_m: number | null;
  lateral1_m: number | null;
  lateral2_m: number | null;
  area_m2: number | null;
  topografia: string | null;
};

export type ItemCustomizacao = {
  id: string;
  categoria: 'kit_moni' | 'gadget';
  nome: string;
  descricao: string | null;
  valor: number;
  ordem: number;
};

export type OfertaEmpreendimento = {
  /** id da oferta da Helenna (`simulacoes_pagamento`). */
  id: string;
  nome: string | null;
  ordem: number;
  /** Valor total à vista da calculadora da Helenna. */
  valor_avista: number | null;
  /** Bloco IMOB pai (FK da sessão). Não é o card listado no passo 2. */
  imob_empreendimento_id: string | null;
  /** Custo de construção no card IMOB; input do engine. */
  valor_base_casa: number | null;
  /** Acoplamento de referência da oferta da Helenna (preview step 2). */
  valor_acoplamento: number | null;
  /** Lote que a Helenna usou na calculadora (preview step 2). */
  valor_lote_oferta: number | null;
  /** Customização que a Helenna usou na calculadora (preview step 2). */
  valor_customizacao_oferta: number | null;
  titulo_oferta: string | null;
  produto_modelo: string | null;
  descricao: string | null;
};

export type TemplateConfigPublico = {
  id: string;
  link_token: string;
  prazo_obra_meses: number;
  valor_lote_padrao: number | null;
  taxa_juros_financiamento_anual: number | null;
  taxa_juros_parcelado_mes: number | null;
  perc_entrada_minima: number | null;
  perc_entrada_sugerida: number | null;
  perc_parcela_mensal: number | null;
  perc_cp: number | null;
  num_meses_cp: number | null;
  itbi_percentual: number | null;
  pct_taxa_plataforma?: number | null;
  pct_taxa_gestao?: number | null;
  tipo_taxa_gestao?: string | null;
  taxa_gestao_valor?: number | null;
  tipo_juros_cp?: 'mes_a_mes' | 'total';
  percentual_plataforma_entrada?: number | null;
  pct_plataforma_entrada?: number | null;
  pct_impostos?: number | null;
  pct_comissao_corretor?: number | null;
  pct_lucro_loteadora?: number | null;
  pct_lucro_moni?: number | null;
  pct_lucro_franqueado?: number | null;
};

export type EmpreendimentoPublico = {
  card_id: string;
  slug: string;
  titulo: string;
  descricao: string | null;
  status_imovel: string | null;
  imagem_principal_path: string | null;
  planilha_lotes_path: string | null;
  planilha_lotes_nome: string | null;
  template: TemplateConfigPublico | null;
  itens_customizacao: ItemCustomizacao[];
  ofertas: OfertaEmpreendimento[];
  lotes: LotePublicoEmp[];
};

export type ModoTerrenoJornada = 'disponivel' | 'informar';

// Estado da sessão do cliente (salvo no banco)
export type JornadaSessao = {
  session_token: string;
  etapa_atual: number;
  nome_cliente: string | null;
  telefone_cliente: string | null;
  lote_codigo: string | null;
  lote_valor: number | null;
  lote_ja_adquirido: boolean | null;
  valor_ja_pago: number | null;
  empreendimento_id: string | null;
  itens_selecionados: string[];
  valor_acoplamento: number | null;
  valor_kit: number | null;
  valor_gadgets: number | null;
  valor_lote: number | null;
  valor_casa: number | null;
  valor_customizacao: number | null;
  simulacao_id: string | null;
  concluida: boolean;
};

export type JornadaLocal = {
  etapa: number;
  sessaoToken: string | null;

  nomeCliente: string;
  telefoneCliente: string;

  ofertaSelecionada: OfertaEmpreendimento | null;
  previewVteAvista: number | null;

  modoTerreno: ModoTerrenoJornada | null;
  loteSelecionado: LotePublicoEmp | null;
  valorJaPago: number;

  gadgetsSelecionados: Set<string>;
  kitSelecionado: boolean;

  valorAcoplamento: number;
  valorKit: number;
  valorGadgets: number;
  /** Preço-base da casa da oferta (valor_base_casa), não o VTE. */
  valorCasa: number;
  valorCustomizacao: number;
  valorLote: number;

  simulacaoId: string | null;
  rendaMensal: number | null;
  prazoObraMeses: number;
  prazoFinanciamento: number;
  taxaJuros: number;
};
