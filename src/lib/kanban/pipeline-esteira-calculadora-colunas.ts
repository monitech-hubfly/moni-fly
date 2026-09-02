import { FASE_SLUGS } from '@/lib/constants/kanban-ids';

export type EsteiraCalculadoraSegmento = 'port' | 'op';

export type EsteiraCalculadoraColuna = {
  /** Chave única da coluna na tabela. */
  slug: string;
  label: string;
  segmento: EsteiraCalculadoraSegmento;
  /** Slugs canônicos da fase na calculadora (primeiro match vence). */
  faseSlugs: readonly string[];
};

/** Colunas da Esteira Pipeline — datas fim da Calculadora (Portfólio + Pré Obra e Obra). */
export const ESTEIRA_CALCULADORA_COLUNAS: readonly EsteiraCalculadoraColuna[] = [
  {
    slug: 'opcao',
    label: 'Opção',
    segmento: 'port',
    faseSlugs: [FASE_SLUGS.OPCAO, FASE_SLUGS.STEP_3],
  },
  {
    slug: 'acoplamento',
    label: 'Acoplamento',
    segmento: 'port',
    faseSlugs: [FASE_SLUGS.ACOPLAMENTO],
  },
  {
    slug: 'comite',
    label: 'Comitê',
    segmento: 'port',
    faseSlugs: [FASE_SLUGS.STEP_5],
  },
  {
    slug: 'contrato',
    label: 'Contrato',
    segmento: 'port',
    faseSlugs: [FASE_SLUGS.STEP_7, 'contrato'],
  },
  {
    slug: 'projeto_legal',
    label: 'Projeto Legal',
    segmento: 'op',
    faseSlugs: [FASE_SLUGS.PROJETO_LEGAL],
  },
  {
    slug: 'aprovacao_condominio',
    label: 'Aprov. Condomínio',
    segmento: 'op',
    faseSlugs: [FASE_SLUGS.APROVACAO_CONDOMINIO],
  },
  {
    slug: 'aprovacao_prefeitura',
    label: 'Aprov. Prefeitura',
    segmento: 'op',
    faseSlugs: [FASE_SLUGS.APROVACAO_PREFEITURA],
  },
  {
    slug: 'revisao_bca',
    label: 'Revisão BCA + IG',
    segmento: 'op',
    faseSlugs: ['revisao_bca'],
  },
  {
    slug: 'transferencia_terreno',
    label: 'Transf. Terreno',
    segmento: 'op',
    faseSlugs: [FASE_SLUGS.PROCESSOS_CARTORARIOS],
  },
  {
    slug: 'aguardando_credito',
    label: 'Ag. Crédito',
    segmento: 'op',
    faseSlugs: [FASE_SLUGS.AGUARDANDO_CREDITO],
  },
  {
    slug: 'em_obra',
    label: 'Em Obra',
    segmento: 'op',
    faseSlugs: [FASE_SLUGS.EM_OBRA],
  },
] as const;

export const ESTEIRA_CALCULADORA_COLUNAS_PORT = ESTEIRA_CALCULADORA_COLUNAS.filter(
  (c) => c.segmento === 'port',
);
export const ESTEIRA_CALCULADORA_COLUNAS_OP = ESTEIRA_CALCULADORA_COLUNAS.filter(
  (c) => c.segmento === 'op',
);
