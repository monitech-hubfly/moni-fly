import { KANBAN_IDS } from '@/lib/constants/kanban-ids';

export type FunilDef = {
  id: string;
  label: string;
  href: string;
};

export type GrupoDef = {
  titulo: string;
  cor: string;
  funis: FunilDef[];
};

export const HUB_FUNIS_GRUPOS: GrupoDef[] = [
  {
    titulo: 'Novos Negócios',
    cor: '#2f4a3a',
    funis: [
      { id: KANBAN_IDS.STEP_ONE, label: 'Step One', href: '/funil-stepone' },
      { id: KANBAN_IDS.PORTFOLIO, label: 'Portfólio', href: '/portfolio' },
      { id: KANBAN_IDS.LOTEADORES, label: 'Loteadores', href: '/loteadores' },
      { id: KANBAN_IDS.ACOPLAMENTO, label: 'Acoplamento', href: '/funil-acoplamento' },
      { id: KANBAN_IDS.MOTOR01, label: 'Motor 01', href: '/funil-motor01' },
    ],
  },
  {
    titulo: 'Moní Capital',
    cor: '#7a5c1e',
    funis: [
      { id: KANBAN_IDS.MONI_CAPITAL, label: 'Divify', href: '/funil-moni-capital' },
      { id: KANBAN_IDS.FUNDING, label: 'Funding', href: '/funil-funding' },
      { id: KANBAN_IDS.CREDITO_OBRA, label: 'Crédito Obra', href: '/funil-credito-obra' },
    ],
  },
  {
    titulo: 'Operações',
    cor: '#4a3929',
    funis: [
      { id: KANBAN_IDS.OPERACOES, label: 'Pré Obra e Obra', href: '/operacoes' },
      { id: KANBAN_IDS.PROJETO_LEGAL, label: 'Projeto Legal', href: '/funil-projeto-legal' },
      { id: KANBAN_IDS.PROJETOS_LOCAIS, label: 'Projetos Locais', href: '/projetos-locais' },
    ],
  },
  {
    titulo: 'HDM',
    cor: '#0c2633',
    funis: [
      { id: KANBAN_IDS.HDM_PRODUTO, label: 'Produto', href: '/funil-produto' },
      { id: KANBAN_IDS.HDM_MODELO_VIRTUAL, label: 'Modelo Virtual', href: '/funil-modelo-virtual' },
      { id: KANBAN_IDS.HDM_HOMOLOGACOES, label: 'Homologações', href: '/funil-homologacoes' },
    ],
  },
  {
    titulo: 'ADM',
    cor: '#3d3d3d',
    funis: [
      { id: KANBAN_IDS.CONTRATACOES, label: 'Contratações', href: '/funil-contratacoes' },
      { id: KANBAN_IDS.CONTABILIDADE, label: 'Contabilidade', href: '/painel-contabilidade' },
    ],
  },
];

export const HUB_FUNIS_TODOS = HUB_FUNIS_GRUPOS.flatMap((g) => g.funis);
