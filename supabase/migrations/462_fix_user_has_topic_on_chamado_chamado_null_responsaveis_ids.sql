-- =============================================================================
-- Migration: 462_fix_user_has_topic_on_chamado_chamado_null_responsaveis_ids
-- Problema: user_has_topic_on_chamado bloqueava dois casos legítimos:
--   1. Tópicos com chamado_id NULL (vínculo via interacao_id → kanban_atividades)
--   2. responsaveis_ids (array) nunca era checado, só responsavel_id (campo único)
-- Caso real: Larissa Lima, tópico 562, chamado 328
-- =============================================================================
CREATE OR REPLACE FUNCTION public.user_has_topic_on_chamado(p_chamado_id bigint, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sirene_topicos t
    LEFT JOIN public.profiles p ON p.id = p_user_id
    WHERE (
      t.chamado_id = p_chamado_id
      OR (
        t.chamado_id IS NULL
        AND EXISTS (
          SELECT 1 FROM public.kanban_atividades ka
          WHERE ka.id               = t.interacao_id
            AND ka.sirene_chamado_id = p_chamado_id
        )
      )
    )
    AND (
      t.responsavel_id  = p_user_id
      OR t.time_responsavel = p.full_name
      OR p_user_id = ANY(COALESCE(t.responsaveis_ids, '{}'))
    )
  );
$$;
NOTIFY pgrst, 'reload schema';
