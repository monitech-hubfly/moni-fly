/** Quem executa a fase por padrão (Responsável da fase). */
export type TipoResponsavelDaFasePadrao = 'moni' | 'franqueado';

/**
 * Padrão por slug de fase (fases ativas — alinhado ao catálogo PROD/DEV).
 * Franqueado → profile da rede vinculada ao card; Moní → owner padrão do funil.
 */
export const RESPONSAVEL_DA_FASE_PADRAO_POR_SLUG: Record<string, TipoResponsavelDaFasePadrao> = {
  // Funil Step One
  onboarding: 'moni',
  dados_candidato: 'franqueado',
  dados_cidade: 'franqueado',
  mapa_competidores: 'franqueado',
  dados_condominios: 'franqueado',
  lotes_disponiveis: 'franqueado',
  batalha: 'franqueado',
  configurador_casas: 'franqueado',
  bca: 'franqueado',
  batalha_casas: 'franqueado',
  escolha: 'franqueado',
  hipoteses: 'franqueado',

  // Funil Portfólio
  step_2: 'moni',
  aprovacao_moni_novo_negocio: 'moni',
  step_3: 'franqueado',
  step_4: 'franqueado',
  acoplamento: 'moni',
  step_5: 'moni',
  cto_condicoes_precedentes: 'moni',
  step_6: 'moni',
  step_7: 'franqueado',
  captacao_moni_capital: 'moni',
  passagem_wayser: 'moni',

  // Funil Acoplamento
  modelagem_terreno: 'moni',
  modelagem_casa_gbox: 'moni',
  validacao_acoplamento: 'moni',
  alteracoes_acoplamento: 'moni',
  acoplamento_aprovado: 'moni',
  acoplamento_reprovado: 'moni',

  // Funil Contabilidade
  contabilidade_incorporadora: 'franqueado',
  contabilidade_spe: 'franqueado',
  contabilidade_gestora: 'franqueado',
  contabilidade_concluido: 'franqueado',

  // Funil Crédito Obra
  co_novo_projeto: 'moni',
  co_envio_cashme: 'moni',
  co_outro_parceiro: 'moni',
  co_documentacao_alvara: 'moni',
  co_validacao_contrato: 'moni',
  co_contrato_assinaturas: 'moni',
  co_followup_cartorio: 'moni',
  co_aguardando_1a_tranche: 'moni',
  co_solicitacao_tranche: 'moni',
  co_sharepoint_cashme: 'moni',
  co_acompanhamento_tranche: 'moni',
  co_necessidade_3a_tranche: 'moni',
  co_sharepoint_3a: 'moni',
  co_acompanhamento_3a: 'moni',
  co_necessidade_4a_tranche: 'moni',
  co_sharepoint_4a: 'moni',
  co_acompanhamento_4a: 'moni',
  co_necessidade_5a_tranche: 'moni',
  co_sharepoint_5a: 'moni',
  co_acompanhamento_5a: 'moni',
  co_necessidade_6a_tranche: 'moni',
  co_sharepoint_6a: 'moni',
  co_acompanhamento_6a: 'moni',
  credito_obra_aprovado: 'moni',
  credito_obra_reprovado: 'moni',

  // Funil Loteadores
  r1_conceito_moni_inc: 'moni',
  viabilidade_moni_inc: 'moni',
  acoplamento_moni_inc: 'moni',
  execucao_material_moni_inc: 'moni',
  r2_plano_teorico_moni_inc: 'moni',
  batalha_casas_moni_inc: 'moni',
  comite_moni_inc: 'moni',
  revisoes_moni_inc: 'moni',
  r3_ajustes_finais_moni_inc: 'moni',
  fechar_contrato_moni_inc: 'moni',
  abertura_spe_moni_inc: 'moni',
  diligencia_moni_inc: 'moni',
  moni_capital_moni_inc: 'moni',
  contrato_parceria_moni_inc: 'moni',

  // Funil Operações
  planialtimetrico: 'franqueado',
  projeto_legal: 'franqueado',
  aprovacao_condominio: 'franqueado',
  aprovacao_prefeitura: 'franqueado',
  revisao_bca: 'moni',
  processos_cartorarios: 'franqueado',
  aguardando_credito: 'moni',
  em_obra: 'franqueado',
  operacoes_entregue: 'franqueado',

  // Funil Jurídico
  juridico_recebimento: 'moni',
  juridico_analise: 'moni',
  juridico_diligencia: 'moni',
  juridico_parecer: 'moni',
  juridico_pendencias: 'moni',
  juridico_concluido: 'moni',
  juridico_arquivado: 'moni',

  // Funil Moní Capital
  capital_recebimento: 'moni',
  capital_abertura_spe: 'moni',
  capital_cadastro_plataforma: 'moni',
  capital_materiais_projeto: 'moni',
  capital_informacoes_obrigatorias: 'moni',
  capital_formalizacao: 'moni',
  capital_concluido: 'moni',
  capital_nao_elegivel: 'moni',
  funding_leads: 'moni',
  funding_r1: 'moni',
  funding_evento: 'moni',
  funding_qualif: 'moni',
  funding_modelo: 'moni',
  funding_docs: 'moni',
  funding_contrato: 'moni',

  // Funil Contratações
  rh_vaga: 'moni',
  rh_triagem: 'moni',
  rh_entrevistas: 'moni',
  rh_oferta: 'moni',
  rh_admissao: 'moni',
  rh_comunicacao: 'moni',
  rh_docs_demissao: 'moni',
  rh_desligamento: 'moni',
  rh_concluido: 'moni',

  // Funil Produto (HDM)
  prod_brief: 'moni',
  prod_mercado: 'moni',
  prod_programa: 'moni',
  prod_ante: 'moni',
  prod_bca: 'moni',
  prod_aprovacao: 'moni',
  prod_executivo: 'moni',
  prod_publicado: 'moni',

  // Funil Modelo Virtual
  mv_recebimento: 'moni',
  mv_modelagem: 'moni',
  mv_renderizacao: 'moni',
  mv_tour: 'moni',
  mv_revisao: 'moni',
  mv_publicado: 'moni',

  // Funil Homologações (migration 462)
  homolog_novas_homologacoes: 'moni',
  homolog_buscar_fornecedores: 'moni',
  homolog_definir_composicao: 'moni',
  homolog_criar_produto_database: 'moni',
  /** @deprecated fases legadas desativadas */
  hom_candidatura: 'moni',
  hom_documentacao: 'moni',
  hom_tecnica: 'moni',
  hom_negociacao: 'moni',
  hom_aprovado: 'moni',
  hom_reprovado: 'moni',

  // Funil Projeto Legal
  pl_nova_demanda: 'moni',
  pl_pontos_em_aberto: 'moni',
  pl_em_execucao: 'moni',
  pl_em_validacao: 'moni',
  pl_c_protocolo_andamento: 'moni',
  pl_c_em_comuniquese: 'moni',
  pl_c_validacao_comuniquese: 'moni',
  pl_c_projeto_aprovado: 'moni',
  pl_aguardando_prefeitura: 'moni',
  pl_p_protocolo_andamento: 'moni',
  pl_p_em_comuniquese: 'moni',
  pl_p_validacao_comuniquese: 'moni',
  pl_p_projeto_aprovado: 'moni',
  pl_pagamentos: 'moni',

  // Funil Projetos Locais (grupos 100–900)
  pl_000_novo_projeto: 'moni',
  pl_100_layout: 'moni',
  pl_200_preparacao_terreno: 'moni',
  pl_300_estruturas: 'moni',
  pl_400_infraestrutura: 'moni',
  pl_500_garagem: 'moni',
  pl_600_piscina: 'moni',
  pl_700_deck: 'moni',
  pl_800_escada_pisantes: 'moni',
  pl_900_paisagismo: 'moni',
  projetos_locais_concluido: 'moni',

  // Funil Projetos Legais
  projetos_legais_protocolo: 'franqueado',
  projetos_legais_exigencias: 'franqueado',
  projetos_legais_aguardando: 'franqueado',
  projetos_legais_alvara: 'franqueado',
  projetos_legais_concluido: 'franqueado',
};

export function tipoResponsavelDaFasePorSlug(
  slug: string | null | undefined,
): TipoResponsavelDaFasePadrao | null {
  const s = String(slug ?? '').trim();
  if (!s) return null;
  return RESPONSAVEL_DA_FASE_PADRAO_POR_SLUG[s] ?? null;
}
