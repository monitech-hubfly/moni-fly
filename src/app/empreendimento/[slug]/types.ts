// src/app/empreendimento/[slug]/types.ts

export type LotePublicoEmp = {
  id: string;
  codigo: string;
  valor: number;
  acoplamento: number; // valor de acoplamento do lote (vem da planilha, coluna Acoplamento)
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
  id: string;
  nome: string | null;
  ordem: number;
  valor_avista: number | null; // preço da casa definido pela Helena na criação da oferta
  titulo_oferta: string | null;
  produto_modelo: string | null; // nome do modelo de casa (ex: "Casa Helena 3Q")
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
  // lotes são carregados separado (da planilha)
  lotes: LotePublicoEmp[];
};

// Estado da sessão do cliente (salvo no banco)
export type JornadaSessao = {
  session_token: string;
  etapa_atual: number;
  nome_cliente: string | null;
  telefone_cliente: string | null;
  lote_codigo: string | null;
  lote_valor: number | null;
  empreendimento_id: string | null; // ID da oferta selecionada
  itens_selecionados: string[]; // IDs dos gadgets/kit selecionados
  valor_acoplamento: number | null;
  valor_kit: number | null;
  valor_gadgets: number | null;
  valor_lote: number | null;
  valor_casa: number | null;
  valor_customizacao: number | null;
  simulacao_id: string | null;
  concluida: boolean;
};

// Estado local da jornada (no cliente, antes de salvar)
export type JornadaLocal = {
  etapa: number;
  sessaoToken: string | null;

  // Passo 1
  nomeCliente: string;
  telefoneCliente: string;

  // Passo 2
  loteSelecionado: LotePublicoEmp | null;

  // Passo 3 — oferta selecionada (já inclui qual modelo de casa)
  ofertaSelecionada: OfertaEmpreendimento | null;

  // Passo 4 — customização
  gadgetsSelecionados: Set<string>; // IDs
  kitSelecionado: boolean;

  // Valores calculados (Passo 4 → Passo 5)
  valorAcoplamento: number; // do lote selecionado (obrigatório)
  valorKit: number;         // kit moní, se selecionado
  valorGadgets: number;     // soma dos gadgets selecionados
  valorCasa: number;        // valor_avista da oferta (preço da casa)
  valorCustomizacao: number; // acoplamento + kit + gadgets
  valorLote: number;        // = lote.valor

  // Passo 5
  simulacaoId: string | null;
};
