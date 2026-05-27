-- Remove linhas duplicadas em public.rede_franqueados (mesmo n_franquia).
-- Mantém 1 linha por número: prioridade processo_id preenchido, depois created_at mais antigo.
-- Transfere vínculos (processo, kanban, perfil, comunidade) para a linha mantida.
--
-- Rode no Supabase → SQL Editor. Recomendado: backup ou rodar em transação e conferir antes do COMMIT.
--
-- Pré-requisito (opcional mas recomendado): migration 199_kanban_cards_rede_franqueado_on_delete_set_null.sql

BEGIN;

DO $$
DECLARE
  grp RECORD;
  keeper_id UUID;
  dup_id UUID;
  dup_proc UUID;
  keeper_proc UUID;
BEGIN
  FOR grp IN
    SELECT trim(n_franquia) AS nf
    FROM public.rede_franqueados
    WHERE n_franquia IS NOT NULL AND trim(n_franquia) <> ''
    GROUP BY trim(n_franquia)
    HAVING COUNT(*) > 1
  LOOP
    SELECT r.id
    INTO keeper_id
    FROM public.rede_franqueados r
    WHERE trim(r.n_franquia) = grp.nf
    ORDER BY (r.processo_id IS NOT NULL) DESC, r.created_at ASC NULLS LAST, r.id
    LIMIT 1;

    FOR dup_id IN
      SELECT r.id
      FROM public.rede_franqueados r
      WHERE trim(r.n_franquia) = grp.nf AND r.id <> keeper_id
    LOOP
      SELECT processo_id INTO dup_proc FROM public.rede_franqueados WHERE id = dup_id;
      SELECT processo_id INTO keeper_proc FROM public.rede_franqueados WHERE id = keeper_id;

      IF dup_proc IS NOT NULL AND keeper_proc IS NULL THEN
        UPDATE public.rede_franqueados SET processo_id = dup_proc WHERE id = keeper_id;
        UPDATE public.processo_step_one
        SET origem_rede_franqueados_id = keeper_id
        WHERE id = dup_proc;
        keeper_proc := dup_proc;
      ELSIF dup_proc IS NOT NULL AND keeper_proc IS NOT NULL AND dup_proc <> keeper_proc THEN
        UPDATE public.processo_step_one
        SET origem_rede_franqueados_id = keeper_id
        WHERE origem_rede_franqueados_id = dup_id;
      END IF;

      UPDATE public.processo_step_one
      SET origem_rede_franqueados_id = keeper_id
      WHERE origem_rede_franqueados_id = dup_id;

      UPDATE public.kanban_cards SET rede_franqueado_id = keeper_id WHERE rede_franqueado_id = dup_id;
      UPDATE public.profiles SET rede_franqueado_id = keeper_id WHERE rede_franqueado_id = dup_id;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'community_posts' AND column_name = 'franqueado_id'
      ) THEN
        EXECUTE 'UPDATE public.community_posts SET franqueado_id = $1 WHERE franqueado_id = $2'
        USING keeper_id, dup_id;
      END IF;

      DELETE FROM public.rede_franqueados WHERE id = dup_id;
    END LOOP;
  END LOOP;
END $$;

-- Conferência: não deve retornar linhas
SELECT n_franquia, COUNT(*) AS qtd
FROM public.rede_franqueados
WHERE n_franquia IS NOT NULL AND trim(n_franquia) <> ''
GROUP BY n_franquia
HAVING COUNT(*) > 1
ORDER BY qtd DESC;

-- Se estiver ok:
COMMIT;
-- Se algo estiver errado:
-- ROLLBACK;
