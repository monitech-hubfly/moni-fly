-- 470: corrige 2 gaps em user_has_topic_on_chamado.
--
-- Gap 1 (PROVADO): tópicos com chamado_id NULL vinculados via
--   interacao_id → kanban_atividades.sirene_chamado_id nunca passavam em
--   "t.chamado_id = p_chamado_id", bloqueando acesso mesmo com responsavel_id
--   correto. Exemplo: Larissa, tópico 562, chamado 328.
--
-- Gap 2 (LATENTE): função só checava t.responsavel_id (scalar), ignorando
--   t.responsaveis_ids (UUID[]). Provável causa do bug Ingrid Hora (3 vs 13).
--
-- Fix:
--   (a) WHERE passa a aceitar tanto chamado_id direto quanto resolução indireta
--       via kanban_atividades (mesmo "caminho b" da policy sirene_topicos_all).
--   (b) condição de responsável inclui responsaveis_ids.

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
      -- caminho (a): vínculo direto
      t.chamado_id = p_chamado_id
      OR
      -- caminho (b): vínculo indireto via interacao_id → kanban_atividades
      (
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
