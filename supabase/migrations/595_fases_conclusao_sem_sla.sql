-- 595: Fases de conclusão não têm SLA e não contabilizam atraso.
-- Espelha isFaseConclusaoKanban. Não mexe na última coluna só por ser a última
-- (ex.: Nova Hipótese no Step One) nem em fase_conversao no meio do funil.
-- Idempotente.

UPDATE public.kanban_fases
SET sla_dias = NULL
WHERE sla_dias IS NOT NULL
  AND COALESCE(slug, '') NOT IN ('mkt_grav_decupagem', 'mkt_inc_decupagem')
  AND (
    slug IN (
      'convertidos',
      'assinados_moni_inc',
      'operacoes_entregue',
      'pl_pagamentos',
      'pl_c_projeto_aprovado',
      'pl_p_projeto_aprovado',
      'homolog_criar_produto_database',
      'funding_contrato',
      'mkt_grav_videos_concluidos',
      'mkt_prog_agendamento',
      'mkt_inc_d4_final',
      'care_arquivado',
      'capital_captacao_finalizada',
      'capital_nao_elegivel',
      'acoplamento_aprovado',
      'co_sharepoint_3a',
      'credito_obra_aprovado',
      'hom_aprovado'
    )
    OR lower(COALESCE(slug, '')) ~ '(_concluido|_reprovado|_nao_elegivel)$'
    OR lower(COALESCE(slug, '')) LIKE '%paralisad%'
    OR lower(trim(COALESCE(nome, ''))) IN ('aprovado', 'assinados')
    OR lower(COALESCE(nome, '')) LIKE '%conclu%'
    OR lower(COALESCE(nome, '')) ~ '\mreprovado\M'
    OR lower(trim(COALESCE(nome, ''))) ~ '^paralisados?$'
  );

NOTIFY pgrst, 'reload schema';
