/**
 * Tipos de domínio do processo Step One - Viabilidade Moní
 */

export type Role = "frank" | "consultor" | "admin";

export const ETAPAS = [
  { id: 1, slug: "analise-praca", nome: "Dados da Cidade", descricao: "Dados automáticos e referência de imagens: escolas, hospitais, eixos, regiões por renda, praças, shoppings, parques" },
  { id: 2, slug: "condominios-checklist", nome: "Condomínios e checklist", descricao: "Listar condomínios >5MM e responder checklist (lotes, casas, locação, giro, legal)" },
  { id: 3, slug: "tabela-resumo", nome: "Tabela resumo e conclusão", descricao: "Resumo por condomínio + ranking e conclusão" },
  { id: 4, slug: "listagem-lotes", nome: "Listagem de lotes", descricao: "Lotes por condomínio ranqueados" },
  { id: 5, slug: "listagem-casas-zap", nome: "Listagem de casas (banco)", descricao: "Listar todas as casas por região/condomínio, sem modelo nem batalha — salva para uso no Step 2" },
  { id: 6, slug: "listagem-modelo-batalha", nome: "Listagem, modelo e batalha", descricao: "Usar a listagem de casas já existente do Step 1 em uso; escolher os 3 modelos do catálogo e preencher a batalha para o estudo de viabilidade" },
  { id: 7, slug: "escolha-lote", nome: "Escolha do lote", descricao: "Escolher o lote para o estudo de viabilidade a partir da listagem do Step 1" },
  { id: 10, slug: "bca", nome: "Preenchimento BCA", descricao: "3 opções de BCA para envio" },
  { id: 11, slug: "pdf-hipoteses", nome: "PDF de hipóteses", descricao: "Consolidar e enviar PDF para aprovação" },
] as const;

export type EtapaId = (typeof ETAPAS)[number]["id"];

export type EtapaStatus = "nao_iniciada" | "em_andamento" | "concluida" | "refeita";

export interface EtapaProgresso {
  id: string;
  user_id: string;
  processo_id: string;
  etapa_id: EtapaId;
  status: EtapaStatus;
  iniciada_em: string | null;
  concluida_em: string | null;
  tentativas: number;
  dados_json?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProcessoStepOne {
  id: string;
  user_id: string;
  cidade: string;
  estado?: string;
  status: "rascunho" | "em_andamento" | "concluido";
  etapa_atual: EtapaId;
  created_at: string;
  updated_at: string;
}
