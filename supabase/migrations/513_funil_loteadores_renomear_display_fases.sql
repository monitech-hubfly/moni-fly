-- 513: Funil Loteadores — renomear display de fases existentes (somente `nome`).
-- Não altera slug, UUID, ordem, SLA, ativo nem qualquer outro campo.
-- Idempotente.

DO $$
DECLARE
  v_kanban_id UUID := '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban_id) THEN
    RAISE NOTICE '513: Funil Loteadores não encontrado — pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases
  SET nome = 'R1 Conceito'
  WHERE kanban_id = v_kanban_id AND slug = 'r1_conceito_moni_inc';

  UPDATE public.kanban_fases
  SET nome = 'Viabilidade / Premissas'
  WHERE kanban_id = v_kanban_id AND slug = 'viabilidade_moni_inc';

  UPDATE public.kanban_fases
  SET nome = 'Executar Material'
  WHERE kanban_id = v_kanban_id AND slug = 'execucao_material_moni_inc';

  UPDATE public.kanban_fases
  SET nome = 'R2 Apresentação'
  WHERE kanban_id = v_kanban_id AND slug = 'r2_plano_teorico_moni_inc';

  UPDATE public.kanban_fases
  SET nome = 'Revisões + Forma Pgto'
  WHERE kanban_id = v_kanban_id AND slug = 'revisoes_moni_inc';

  UPDATE public.kanban_fases
  SET nome = 'Cto de Parceria'
  WHERE kanban_id = v_kanban_id AND slug = 'contrato_parceria_moni_inc';

  RAISE NOTICE '513: renomes de display Loteadores aplicados.';
END $$;
