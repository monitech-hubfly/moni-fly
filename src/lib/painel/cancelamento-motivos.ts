export const MOTIVOS_CANCELAMENTO = [
  'Terreno inviável',
  'Inviabilidade financeira',
  'Desistência do franqueado',
  'Condomínio não aprovou',
  'Prazo expirado',
  'Outro',
] as const;

export type MotivoCancelamento = (typeof MOTIVOS_CANCELAMENTO)[number];

export const MOTIVOS_REPROVACAO_COMITE = [
  'Documentação incompleta',
  'SPT ausente ou insuficiente',
  'Inviabilidade financeira',
  'Terreno com restrições legais',
  'VGV abaixo do mínimo',
  'Prazo de aprovação inviável',
  'Desistência do franqueado',
  'Reprovação pelo condomínio',
  'Outro',
] as const;

export type MotivoReprovacaoComite = (typeof MOTIVOS_REPROVACAO_COMITE)[number];

export const FASES_CONTABILIDADE_DASHBOARD = [
  'abertura_incorporadora',
  'abertura_spe',
  'abertura_gestora',
  'em_andamento',
  'encerrado',
] as const;

export type FaseContabilidadeDashboard = (typeof FASES_CONTABILIDADE_DASHBOARD)[number];

export const FASES_CREDITO_DASHBOARD = [
  'check_legal_mais_credito',
  'contratacao_credito',
  'credito_aprovado',
  'encerrado',
] as const;

export type FaseCreditoDashboard = (typeof FASES_CREDITO_DASHBOARD)[number];
