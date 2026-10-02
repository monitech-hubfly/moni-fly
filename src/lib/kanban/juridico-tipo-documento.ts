import {
  JURIDICO_PORTFOLIO_TAG_CTO_PRECEDENTES,
  JURIDICO_PORTFOLIO_TAG_CTO_SEM_PRECEDENTES,
  JURIDICO_PORTFOLIO_TAG_OPCAO,
  JURIDICO_TAG_COF,
  JURIDICO_TAG_CTO_FRANQUIA,
  JURIDICO_TAG_CTO_PARCERIA,
  JURIDICO_TAG_NDA,
} from '@/lib/kanban/juridico-portfolio-tag';

/** Valores aceitos em `kanban_cards.juridico_tipo_contrato` (migration 597). */
export const JURIDICO_TIPOS_DOCUMENTO = [
  'opcao',
  'cto_com_precedentes',
  'cto_sem_precedentes',
  'nda',
  'parceria',
  'franquia',
  'cof',
  'aditivo',
  'documento_padrao',
  'demais',
] as const;

export type JuridicoTipoDocumento = (typeof JURIDICO_TIPOS_DOCUMENTO)[number];

export const JURIDICO_TIPO_DOCUMENTO_LABEL: Record<JuridicoTipoDocumento, string> = {
  opcao: 'Opção',
  cto_com_precedentes: 'Cto c/ Precedentes',
  cto_sem_precedentes: 'Cto s/ Precedentes',
  nda: 'NDA',
  parceria: 'Cto de Parceria',
  franquia: 'Cto de Franquia',
  cof: 'COF',
  aditivo: 'Aditivo',
  documento_padrao: 'Documento Padrão',
  demais: 'Demais',
};

/** Tipos que o bastão Loteadores → Jurídico abre: NDA e Cto de Parceria. */
export const LOTEADORES_TIPOS_DOCUMENTO_JURIDICO = ['nda', 'parceria'] as const;

/**
 * Rodada atual do atendimento = `kanban_cards.juridico_bolinha_count`.
 * O número persistido já é a rodada. Não é revisões + 1.
 */
export function isJuridicoTipoDocumento(
  valor: string | null | undefined,
): valor is JuridicoTipoDocumento {
  const v = String(valor ?? '').trim();
  return (JURIDICO_TIPOS_DOCUMENTO as readonly string[]).includes(v);
}

/** Tag do bastão → tipo documental. Sem tag, o tipo fica em aberto. */
export function tipoDocumentoPorTagJuridico(
  tagNome: string | null | undefined,
): JuridicoTipoDocumento | null {
  const nome = String(tagNome ?? '').trim();
  if (nome === JURIDICO_PORTFOLIO_TAG_OPCAO) return 'opcao';
  if (nome === JURIDICO_PORTFOLIO_TAG_CTO_PRECEDENTES) return 'cto_com_precedentes';
  if (nome === JURIDICO_PORTFOLIO_TAG_CTO_SEM_PRECEDENTES) return 'cto_sem_precedentes';
  if (nome === JURIDICO_TAG_NDA) return 'nda';
  if (nome === JURIDICO_TAG_CTO_PARCERIA) return 'parceria';
  if (nome === JURIDICO_TAG_COF) return 'cof';
  if (nome === JURIDICO_TAG_CTO_FRANQUIA) return 'franquia';
  return null;
}
