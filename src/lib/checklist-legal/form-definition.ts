export type ChecklistLegalFieldType = 'text' | 'textarea' | 'checkbox_group' | 'file';

export type ChecklistLegalFieldDef = {
  key: string;
  label: string;
  type: ChecklistLegalFieldType;
  required?: boolean;
  options?: readonly string[];
  arquivoKey?: string;
  multiple?: boolean;
  hint?: string;
};

export type ChecklistLegalSectionDef = {
  id: string;
  title: string;
  fields: ChecklistLegalFieldDef[];
};

import {
  CHECKLIST_LEGAL_DOC_APROVACAO_OPCOES,
  CHECKLIST_LEGAL_OBRAS_DOC_OPCOES,
} from '@/lib/checklist-legal/types';

/** Definição versionada do formulário (10 seções conforme Google Forms). */
export const CHECKLIST_LEGAL_SECTIONS: ChecklistLegalSectionDef[] = [
  {
    id: 'cadastro',
    title: '1. Cadastro acoplamento',
    fields: [
      { key: 'cadastro_franqueado', label: 'Franqueado (opcional)', type: 'text', required: false },
      { key: 'cadastro_condominio', label: 'Condomínio (opcional)', type: 'text', required: false },
      { key: 'cadastro_quadra', label: 'Quadra (opcional)', type: 'text', required: false },
      { key: 'cadastro_lote', label: 'Lote (opcional)', type: 'text', required: false },
      { key: 'cadastro_modelo_moni', label: 'Modelo Moní (opcional)', type: 'text', required: false },
    ],
  },
  {
    id: 'aprovacoes',
    title: '2. Dos processos de aprovação',
    fields: [
      { key: 'q1_aprov_tel_setor', label: 'Telefone do setor de aprovações do condomínio', type: 'text', required: true },
      { key: 'q2_aprov_tel_subprefeitura', label: 'Telefone do setor de aprovações da Subprefeitura', type: 'text', required: true },
      {
        key: 'q3_aprov_pre_fabricadas',
        label: 'Condomínio permite pré-fabricadas / steel frame / estrutura leve / modulares?',
        type: 'text',
        required: true,
      },
      {
        key: 'aprovacao_matricula_pdf',
        label: 'Terreno possui matrícula? (anexe PDF, opcional)',
        type: 'file',
        arquivoKey: 'aprovacao_matricula_pdf',
      },
      {
        key: 'aprovacao_planialtimetrico_pdf',
        label: 'Terreno possui levantamento planialtimétrico? (anexe PDF, opcional)',
        type: 'file',
        arquivoKey: 'aprovacao_planialtimetrico_pdf',
      },
      {
        key: 'q6_aprov_taxas',
        label: 'Existem taxas no processo de aprovação? Quais e valores',
        type: 'textarea',
        required: true,
        hint: 'Ex.: Taxa de Análise ou Aprovação de Projeto — prefeitura ou condomínio.',
      },
      {
        key: 'q7_aprov_laud_sondagem',
        label: 'Solicita laudo de sondagem? Se sim, quais?',
        type: 'textarea',
        required: true,
      },
      {
        key: 'aprovacao_spt_pdf',
        label: 'Caso já tenha o SPT, anexe abaixo (opcional)',
        type: 'file',
        arquivoKey: 'aprovacao_spt_pdf',
      },
      {
        key: 'q9_aprov_doc_solicitados_selecionados',
        label: 'Documentos que o condomínio solicita para aprovação do projeto',
        type: 'checkbox_group',
        required: true,
        options: CHECKLIST_LEGAL_DOC_APROVACAO_OPCOES,
      },
      {
        key: 'q9_aprov_doc_solicitados_outro_text',
        label: 'Outro documento (descreva)',
        type: 'text',
      },
      {
        key: 'q10_aprov_prazo_condominio',
        label: 'Prazo solicitado pelo condomínio (dias úteis ou corridos)',
        type: 'text',
        required: true,
      },
      {
        key: 'q11_aprov_prazo_prefeitura',
        label: 'Prazo solicitado pela prefeitura (dias úteis ou corridos)',
        type: 'text',
        required: true,
      },
    ],
  },
  {
    id: 'obras',
    title: '3. Das obras',
    fields: [
      {
        key: 'q_obras_docs_selecionados',
        label: 'Documentos exigidos para execução de obras',
        type: 'checkbox_group',
        required: true,
        options: CHECKLIST_LEGAL_OBRAS_DOC_OPCOES,
      },
      { key: 'q_obras_docs_outro_text', label: 'Outro documento de obra (descreva)', type: 'text' },
      { key: 'q_obras_prazo', label: 'Prazos de obra / restrições', type: 'textarea', required: true },
      { key: 'q_obras_horarios', label: 'Horários permitidos para obra', type: 'textarea', required: true },
      { key: 'q_obras_pernoite', label: 'Permite pernoite de operários?', type: 'text', required: true },
      { key: 'q_obras_tapumes', label: 'Regras de tapumes / isolamento', type: 'textarea', required: true },
      { key: 'q_obras_metodo_provisorio', label: 'Método provisório de acesso / energia / água', type: 'textarea', required: true },
    ],
  },
  {
    id: 'terreno',
    title: '4. Do terreno',
    fields: [
      { key: 'q12_terreno_recuo_frontal', label: 'Recuo frontal mínimo', type: 'text', required: true },
      { key: 'q13_terreno_recuo_lateral', label: 'Recuo lateral mínimo', type: 'text', required: true },
      { key: 'q14_terreno_recuo_fundos', label: 'Recuo de fundos mínimo', type: 'text', required: true },
      { key: 'q15_terreno_taxa_ocupacao', label: 'Taxa de ocupação máxima', type: 'text', required: true },
      { key: 'q16_terreno_coeficiente_aproveitamento', label: 'Coeficiente de aproveitamento máximo', type: 'text', required: true },
      { key: 'q17_terreno_permeabilidade_minima', label: 'Taxa de permeabilidade mínima', type: 'text', required: true },
      { key: 'q18_terreno_regra_area_permeavel', label: 'Regra de área permeável', type: 'textarea', required: true },
      { key: 'q19_terreno_area_construida_minima', label: 'Área construída mínima', type: 'text', required: true },
      { key: 'q20_terreno_cobertura_recuos', label: 'Projeções / coberturas nos recuos', type: 'textarea', required: true },
      { key: 'q21_terreno_piscinas_recuos', label: 'Piscinas e recuos', type: 'textarea', required: true },
      { key: 'q22_terreno_ediculas_permitidas', label: 'Edículas permitidas?', type: 'text', required: true },
      {
        key: 'terreno_abrigos_medidores_pdf',
        label: 'Padrão de abrigos de medidores (anexe PDF, opcional)',
        type: 'file',
        arquivoKey: 'terreno_abrigos_medidores_pdf',
      },
      { key: 'q24_terreno_ediculas_especificacoes', label: 'Especificações de edículas (opcional)', type: 'textarea' },
    ],
  },
  {
    id: 'gabarito',
    title: '5. Do gabarito',
    fields: [
      { key: 'q25_gabarito_altura_maxima', label: 'Altura máxima permitida', type: 'text', required: true },
      { key: 'q26_gabarito_pavimentos', label: 'Número de pavimentos', type: 'text', required: true },
      { key: 'q27_gabarito_subsolos', label: 'Subsolo(s) permitido(s)?', type: 'text', required: true },
      { key: 'q28_gabarito_excecoes', label: 'Exceções / observações de gabarito', type: 'textarea', required: true },
    ],
  },
  {
    id: 'divisas',
    title: '6. Das divisas do lote',
    fields: [
      { key: 'q29_divisas_altura_muros', label: 'Altura de muros/divisas', type: 'text', required: true },
      { key: 'q30_divisas_restricao_area_comum', label: 'Restrição em área comum', type: 'textarea', required: true },
      { key: 'q31_divisas_muro_arrimo_opcional', label: 'Muro de arrimo (opcional)', type: 'textarea' },
      { key: 'q32_divisas_areas_gourmet', label: 'Áreas gourmet / convivência nas divisas', type: 'textarea', required: true },
    ],
  },
  {
    id: 'passeios',
    title: '7. Dos passeios',
    fields: [
      { key: 'q33_passeios_alteracoes', label: 'Alterações permitidas no passeio', type: 'textarea', required: true },
      { key: 'q34_passeios_paginacao', label: 'Paginação / acabamento do passeio', type: 'textarea', required: true },
      { key: 'q35_passeios_plantio_arvores', label: 'Plantio de árvores / jardim', type: 'textarea', required: true },
    ],
  },
  {
    id: 'instalacoes',
    title: '8. Das instalações prediais',
    fields: [
      { key: 'q36_inst_medidores_posicionamento', label: 'Posicionamento de medidores', type: 'textarea', required: true },
      { key: 'q37_inst_pocos_fossas', label: 'Poços / fossas', type: 'textarea', required: true },
      { key: 'q38_inst_esgoto_orientado', label: 'Esgoto — orientações', type: 'textarea', required: true },
      { key: 'q39_inst_faixa_servitude', label: 'Faixa de servidão / utilidades', type: 'textarea', required: true },
    ],
  },
  {
    id: 'observacoes',
    title: '9. Outras observações',
    fields: [
      { key: 'q40_outras_observacoes', label: 'Outras observações relevantes', type: 'textarea' },
    ],
  },
  {
    id: 'uploads',
    title: '10. Uploads',
    fields: [
      {
        key: 'manual_condominio_pdf',
        label: 'PDF do Manual do Condomínio',
        type: 'file',
        required: true,
        arquivoKey: 'manual_condominio_pdf',
      },
      {
        key: 'codigo_obras_pdf',
        label: 'PDF do Código de Obras da Subprefeitura',
        type: 'file',
        required: true,
        arquivoKey: 'codigo_obras_pdf',
      },
      {
        key: 'outros_documentos_pdf',
        label: 'Outros códigos, padrões ou documentos (opcional)',
        type: 'file',
        arquivoKey: 'outros_documentos_pdf',
        multiple: true,
      },
    ],
  },
];

export const CHECKLIST_LEGAL_SECTION_COUNT = CHECKLIST_LEGAL_SECTIONS.length;
