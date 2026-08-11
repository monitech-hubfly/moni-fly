/** Textos de tooltip dos cabeçalhos de diagnóstico na tabela Rede de Franqueados. */

export type DiagnosticoHeaderKey =
  | 'score'
  | 'd'
  | 'c'
  | 'k'
  | 'nps'
  | 'csat'
  | 'contratos12m'
  | 'prio'
  | 'perfil'
  | 'grupo'
  | 'tendencia'
  | 'proximaAcao';

export type DiagnosticoHeaderTooltip = {
  title: string;
  subtitle?: string;
  description: string;
};

export const REDE_DIAG_HEADER_TOOLTIPS: Record<DiagnosticoHeaderKey, DiagnosticoHeaderTooltip> = {
  score: {
    title: 'Score',
    subtitle: 'Engajamento %',
    description: 'Percentual calculado: D×40% + C×35% + K×25%, de 0 a 100%.',
  },
  d: {
    title: 'D — Dinheiro / Capital',
    subtitle: 'Consegue?',
    description: 'Dimensão financeira: o franqueado tem capital e viabilidade para operar? (0 = não, 2 = moderado, 3 = sim).',
  },
  c: {
    title: 'C — Comportamento',
    subtitle: 'Faz?',
    description: 'Dimensão de execução: o franqueado ativa e executa as ações esperadas? (0 = não, 2 = moderado, 3 = sim).',
  },
  k: {
    title: 'K — Conhecimento',
    subtitle: 'Sabe?',
    description: 'Dimensão de capacitação: domina processos e ferramentas? (0 = gap, 2 = moderado, 3 = sim).',
  },
  nps: {
    title: 'NPS',
    subtitle: 'Recomenda?',
    description: 'Net Promoter Score (0–10): disposição do franqueado em recomendar a Casa Moní.',
  },
  csat: {
    title: 'CSAT',
    subtitle: 'Satisfação',
    description: 'Customer Satisfaction (1–5): satisfação do franqueado com a relação e o suporte.',
  },
  contratos12m: {
    title: 'Contratos 12m',
    subtitle: 'Meta: 4/ano',
    description: 'Contratos fechados nos últimos 12 meses, comparados à meta anual (padrão 4).',
  },
  prio: {
    title: 'Prioridade',
    description: 'Classificação P1–P7 (ou AD/NC): urgência de intervenção com base no diagnóstico completo.',
  },
  perfil: {
    title: 'Perfil',
    description: 'Rótulo interpretativo (ex.: Estruturação Financeira, Alta Performance) derivado da prioridade.',
  },
  grupo: {
    title: 'Grupo de ação',
    description: 'Grupo principal GA1–GA7 que orienta o plano de intervenção da rede.',
  },
  tendencia: {
    title: 'Tendência',
    description: 'Setas ↑ → ↓ de engajamento, relação e indicador: direção recente de cada eixo.',
  },
  proximaAcao: {
    title: 'Próxima ação',
    description: 'Próxima melhor ação registrada para este franqueado no plano de gestão.',
  },
};
