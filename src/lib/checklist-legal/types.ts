export type ChecklistLegalFileMeta = { storage_path: string; nome_original: string | null };

export type ChecklistLegalArquivos = Partial<{
  manual_condominio_pdf: ChecklistLegalFileMeta[];
  codigo_obras_pdf: ChecklistLegalFileMeta[];
  outros_documentos_pdf: ChecklistLegalFileMeta[];
  aprovacao_matricula_pdf: ChecklistLegalFileMeta[];
  aprovacao_planialtimetrico_pdf: ChecklistLegalFileMeta[];
  aprovacao_spt_pdf: ChecklistLegalFileMeta[];
  terreno_abrigos_medidores_pdf: ChecklistLegalFileMeta[];
}>;

export type ChecklistLegalRespostas = {
  cadastro_franqueado?: string;
  cadastro_condominio?: string;
  cadastro_quadra?: string;
  cadastro_lote?: string;
  cadastro_modelo_moni?: string;

  q1_aprov_tel_setor?: string;
  q2_aprov_tel_subprefeitura?: string;
  q3_aprov_pre_fabricadas?: string;
  q6_aprov_taxas?: string;
  q7_aprov_laud_sondagem?: string;
  q9_aprov_doc_solicitados_selecionados?: string[];
  q9_aprov_doc_solicitados_outro_text?: string;
  q10_aprov_prazo_condominio?: string;
  q11_aprov_prazo_prefeitura?: string;

  q_obras_docs_selecionados?: string[];
  q_obras_docs_outro_text?: string;
  q_obras_prazo?: string;
  q_obras_horarios?: string;
  q_obras_pernoite?: string;
  q_obras_tapumes?: string;
  q_obras_metodo_provisorio?: string;

  q12_terreno_recuo_frontal?: string;
  q13_terreno_recuo_lateral?: string;
  q14_terreno_recuo_fundos?: string;
  q15_terreno_taxa_ocupacao?: string;
  q16_terreno_coeficiente_aproveitamento?: string;
  q17_terreno_permeabilidade_minima?: string;
  q18_terreno_regra_area_permeavel?: string;
  q19_terreno_area_construida_minima?: string;
  q20_terreno_cobertura_recuos?: string;
  q21_terreno_piscinas_recuos?: string;
  q22_terreno_ediculas_permitidas?: string;
  q24_terreno_ediculas_especificacoes?: string;

  q25_gabarito_altura_maxima?: string;
  q26_gabarito_pavimentos?: string;
  q27_gabarito_subsolos?: string;
  q28_gabarito_excecoes?: string;

  q29_divisas_altura_muros?: string;
  q30_divisas_restricao_area_comum?: string;
  q31_divisas_muro_arrimo_opcional?: string;
  q32_divisas_areas_gourmet?: string;

  q33_passeios_alteracoes?: string;
  q34_passeios_paginacao?: string;
  q35_passeios_plantio_arvores?: string;

  q36_inst_medidores_posicionamento?: string;
  q37_inst_pocos_fossas?: string;
  q38_inst_esgoto_orientado?: string;
  q39_inst_faixa_servitude?: string;

  q40_outras_observacoes?: string;

  [key: string]: unknown;
};

export type ChecklistLegalCondominioRecord = {
  id: string;
  condominio_id: string;
  versao: number;
  status: 'rascunho' | 'concluido';
  respostas_json: ChecklistLegalRespostas;
  arquivos_json: ChecklistLegalArquivos;
  form_version: number;
  card_origem_id: string | null;
  updated_at: string;
};

export const CHECKLIST_LEGAL_FORM_VERSION = 1;

export const CHECKLIST_LEGAL_ARQUIVO_KEYS = [
  'manual_condominio_pdf',
  'codigo_obras_pdf',
  'outros_documentos_pdf',
  'aprovacao_matricula_pdf',
  'aprovacao_planialtimetrico_pdf',
  'aprovacao_spt_pdf',
  'terreno_abrigos_medidores_pdf',
] as const;

export type ChecklistLegalArquivoKey = (typeof CHECKLIST_LEGAL_ARQUIVO_KEYS)[number];

export const EMPTY_CHECKLIST_LEGAL_ARQUIVOS: ChecklistLegalArquivos = {
  manual_condominio_pdf: [],
  codigo_obras_pdf: [],
  outros_documentos_pdf: [],
  aprovacao_matricula_pdf: [],
  aprovacao_planialtimetrico_pdf: [],
  aprovacao_spt_pdf: [],
  terreno_abrigos_medidores_pdf: [],
};

export const EMPTY_CHECKLIST_LEGAL_RESPOSTAS: ChecklistLegalRespostas = {
  cadastro_franqueado: '',
  cadastro_condominio: '',
  cadastro_quadra: '',
  cadastro_lote: '',
  cadastro_modelo_moni: '',
  q1_aprov_tel_setor: '',
  q2_aprov_tel_subprefeitura: '',
  q3_aprov_pre_fabricadas: '',
  q6_aprov_taxas: '',
  q7_aprov_laud_sondagem: '',
  q9_aprov_doc_solicitados_selecionados: [],
  q9_aprov_doc_solicitados_outro_text: '',
  q10_aprov_prazo_condominio: '',
  q11_aprov_prazo_prefeitura: '',
  q_obras_docs_selecionados: [],
  q_obras_docs_outro_text: '',
  q_obras_prazo: '',
  q_obras_horarios: '',
  q_obras_pernoite: '',
  q_obras_tapumes: '',
  q_obras_metodo_provisorio: '',
  q12_terreno_recuo_frontal: '',
  q13_terreno_recuo_lateral: '',
  q14_terreno_recuo_fundos: '',
  q15_terreno_taxa_ocupacao: '',
  q16_terreno_coeficiente_aproveitamento: '',
  q17_terreno_permeabilidade_minima: '',
  q18_terreno_regra_area_permeavel: '',
  q19_terreno_area_construida_minima: '',
  q20_terreno_cobertura_recuos: '',
  q21_terreno_piscinas_recuos: '',
  q22_terreno_ediculas_permitidas: '',
  q24_terreno_ediculas_especificacoes: '',
  q25_gabarito_altura_maxima: '',
  q26_gabarito_pavimentos: '',
  q27_gabarito_subsolos: '',
  q28_gabarito_excecoes: '',
  q29_divisas_altura_muros: '',
  q30_divisas_restricao_area_comum: '',
  q31_divisas_muro_arrimo_opcional: '',
  q32_divisas_areas_gourmet: '',
  q33_passeios_alteracoes: '',
  q34_passeios_paginacao: '',
  q35_passeios_plantio_arvores: '',
  q36_inst_medidores_posicionamento: '',
  q37_inst_pocos_fossas: '',
  q38_inst_esgoto_orientado: '',
  q39_inst_faixa_servitude: '',
  q40_outras_observacoes: '',
};

export const CHECKLIST_LEGAL_DOC_APROVACAO_OPCOES = [
  'RG do proprietário',
  'CPF do proprietário',
  'CNH do proprietário',
  'Escritura do terreno',
  'Projeto Legal',
  'Projeto Arquitetônico',
  'Memorial Descritivo',
  'Relatório Técnico de Sondagem a Percussão (SPT)',
  'Outro',
] as const;

export const CHECKLIST_LEGAL_OBRAS_DOC_OPCOES = [
  'ART do responsável técnico',
  'Cronograma de obra',
  'Plano de tapumes',
  'Plano de gestão de resíduos',
  'Seguro de responsabilidade civil',
  'Outro',
] as const;
