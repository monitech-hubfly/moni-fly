import {
  isJuridicoPortfolioTagNome,
  JURIDICO_PORTFOLIO_TAG_CTO_PRECEDENTES,
  JURIDICO_PORTFOLIO_TAG_CTO_SEM_PRECEDENTES,
  JURIDICO_PORTFOLIO_TAG_OPCAO,
  JURIDICO_PORTFOLIO_TAG_TERMO_RECOMPRA,
  JURIDICO_TAG_COF,
  JURIDICO_TAG_CTO_FRANQUIA,
  JURIDICO_TAG_CTO_PARCERIA,
  JURIDICO_TAG_CTO_SHOWROOM,
  JURIDICO_TAG_NDA,
  JURIDICO_TAG_TERMO_RECOMPRA_SHOWROOM,
  type JuridicoPortfolioTagNome,
} from '@/lib/kanban/juridico-portfolio-tag';

/** Valores aceitos em `kanban_cards.juridico_tipo_contrato` (migrations 597 e 620). */
export const JURIDICO_TIPOS_DOCUMENTO = [
  'opcao',
  'cto_com_precedentes',
  'cto_sem_precedentes',
  'termo_recompra',
  'nda',
  'parceria',
  'franquia',
  'cof',
  'aditivo',
  'documento_padrao',
  'demais',
  'cto_showroom',
  'termo_recompra_showroom',
] as const;

export type JuridicoTipoDocumento = (typeof JURIDICO_TIPOS_DOCUMENTO)[number];

export const JURIDICO_TIPO_DOCUMENTO_LABEL: Record<JuridicoTipoDocumento, string> = {
  opcao: 'Opção',
  cto_com_precedentes: 'Cto c/ Precedentes',
  cto_sem_precedentes: 'Cto s/ Precedentes',
  termo_recompra: 'Termo Recompra',
  nda: 'NDA',
  parceria: 'Cto de Parceria',
  franquia: 'Cto de Franquia',
  cof: 'COF',
  aditivo: 'Aditivo',
  documento_padrao: 'Documento Padrão',
  demais: 'Demais',
  cto_showroom: 'Cto Showroom',
  termo_recompra_showroom: 'Termo Recompra Showroom',
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

/** Tipo documental → tag do quadro. Tipos sem tag canônica ficam sem chip. */
export function tagPortfolioPorTipoDocumento(
  tipo: string | null | undefined,
): JuridicoPortfolioTagNome | null {
  if (!isJuridicoTipoDocumento(tipo)) return null;
  const nome = JURIDICO_TIPO_DOCUMENTO_LABEL[tipo];
  return isJuridicoPortfolioTagNome(nome) ? nome : null;
}

/** Tag do bastão → tipo documental. Sem tag, o tipo fica em aberto. */
export function tipoDocumentoPorTagJuridico(
  tagNome: string | null | undefined,
): JuridicoTipoDocumento | null {
  const nome = String(tagNome ?? '').trim();
  if (nome === JURIDICO_PORTFOLIO_TAG_OPCAO) return 'opcao';
  if (nome === JURIDICO_PORTFOLIO_TAG_CTO_PRECEDENTES) return 'cto_com_precedentes';
  if (nome === JURIDICO_PORTFOLIO_TAG_CTO_SEM_PRECEDENTES) return 'cto_sem_precedentes';
  if (nome === JURIDICO_PORTFOLIO_TAG_TERMO_RECOMPRA) return 'termo_recompra';
  if (nome === JURIDICO_TAG_NDA) return 'nda';
  if (nome === JURIDICO_TAG_CTO_PARCERIA) return 'parceria';
  if (nome === JURIDICO_TAG_COF) return 'cof';
  if (nome === JURIDICO_TAG_CTO_FRANQUIA) return 'franquia';
  if (nome === JURIDICO_TAG_CTO_SHOWROOM) return 'cto_showroom';
  if (nome === JURIDICO_TAG_TERMO_RECOMPRA_SHOWROOM) return 'termo_recompra_showroom';
  return null;
}
