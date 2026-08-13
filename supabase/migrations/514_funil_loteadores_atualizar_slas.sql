-- 514: Funil Loteadores — atualizar SLAs (`sla_dias`) de fases existentes.
-- Não altera nome, slug, ordem, ativo nem outros campos.
-- Idempotente.

DO $$
DECLARE
  v_kanban_id UUID := '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban_id) THEN
    RAISE NOTICE '514: Funil Loteadores não encontrado — pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases
  SET sla_dias = 1
  WHERE kanban_id = v_kanban_id AND slug = 'primeiro_contato_moni_inc';

  UPDATE public.kanban_fases
  SET sla_dias = 1
  WHERE kanban_id = v_kanban_id AND slug = 'viabilidade_moni_inc';

  UPDATE public.kanban_fases
  SET sla_dias = 1
  WHERE kanban_id = v_kanban_id AND slug = 'acoplamento_moni_inc';

  UPDATE public.kanban_fases
  SET sla_dias = 1
  WHERE kanban_id = v_kanban_id AND slug = 'execucao_material_moni_inc';

  UPDATE public.kanban_fases
  SET sla_dias = 5
  WHERE kanban_id = v_kanban_id AND slug = 'r2_plano_teorico_moni_inc';

  UPDATE public.kanban_fases
  SET sla_dias = 2
  WHERE kanban_id = v_kanban_id AND slug = 'revisoes_moni_inc';

  RAISE NOTICE '514: SLAs Loteadores atualizados.';
END $$;
