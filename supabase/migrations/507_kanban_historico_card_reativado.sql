-- 507: kanban_historico — ação card_reativado (reativação de perda no Funding)

ALTER TABLE public.kanban_historico
  DROP CONSTRAINT IF EXISTS kanban_historico_acao_check;

ALTER TABLE public.kanban_historico
  ADD CONSTRAINT kanban_historico_acao_check
  CHECK (acao IN (
    'card_criado',
    'fase_avancada',
    'fase_retrocedida',
    'interacao_criada',
    'interacao_editada',
    'interacao_arquivada',
    'campo_alterado',
    'card_arquivado',
    'card_concluido',
    'card_finalizado',
    'comentario_criado',
    'tag_vinculada',
    'tag_removida',
    'bastao_retorno',
    'sla_justificado',
    'links_gbox_acoplamento',
    'card_reativado'
  ));

NOTIFY pgrst, 'reload schema';
