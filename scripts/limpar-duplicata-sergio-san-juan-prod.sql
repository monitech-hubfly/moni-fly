-- Limpeza PROD: duplicatas de Sergio San Juan Dertkigil (Novo Franqueado)
-- Contexto: 3x FK0039 + 1x FK0040, mesmo nome/datas/status "Em Operação"
-- NÃO executar automaticamente — revisar no SQL Editor do Supabase PROD antes do COMMIT.
--
-- Estratégia:
--   1) Conferir as 4 linhas
--   2) Manter UMA linha (prioridade: processo_id preenchido → created_at mais antigo)
--   3) Transferir vínculos (processo, kanban, perfil) para a linha mantida
--   4) Remover as outras 3
--
-- Alternativa pela UI (após deploy): botão "Remover duplicatas" na Rede de Franqueados
-- (agrupa por n_franquia; para FK0039 remove 2; FK0040 pode ficar se nome diferente no agrupamento)

-- =============================================================================
-- PASSO 1 — Inspeção (rodar primeiro, sem transação)
-- =============================================================================
SELECT
  id,
  n_franquia,
  nome_completo,
  status_franquia,
  cpf_frank,
  email_frank,
  data_ass_contrato,
  data_ass_cof,
  processo_id,
  created_at,
  ordem
FROM public.rede_franqueados
WHERE nome_completo ILIKE '%Sergio San Juan Dertkigil%'
   OR n_franquia IN ('FK0039', 'FK0040')
ORDER BY n_franquia, created_at;

-- Processos órfãos ligados a essas linhas (se houver)
SELECT p.id, p.numero_franquia, p.nome_franqueado, p.origem_rede_franqueados_id, p.created_at
FROM public.processo_step_one p
WHERE p.origem_rede_franqueados_id IN (
  SELECT id FROM public.rede_franqueados
  WHERE nome_completo ILIKE '%Sergio San Juan Dertkigil%'
)
ORDER BY p.created_at;

-- =============================================================================
-- PASSO 2 — Limpeza por Nº de Franquia (FK0039: manter 1, remover 2)
-- =============================================================================
BEGIN;

DO $$
DECLARE
  grp RECORD;
  keeper_id UUID;
  dup_id UUID;
  dup_proc UUID;
  keeper_proc UUID;
BEGIN
  -- Grupos FK0039 e FK0040 (e qualquer outro n_franquia duplicado do caso)
  FOR grp IN
    SELECT trim(n_franquia) AS nf
    FROM public.rede_franqueados
    WHERE nome_completo ILIKE '%Sergio San Juan Dertkigil%'
      AND n_franquia IS NOT NULL
      AND trim(n_franquia) <> ''
    GROUP BY trim(n_franquia)
    HAVING COUNT(*) > 1
  LOOP
    SELECT r.id
    INTO keeper_id
    FROM public.rede_franqueados r
    WHERE trim(r.n_franquia) = grp.nf
      AND r.nome_completo ILIKE '%Sergio San Juan Dertkigil%'
    ORDER BY (r.processo_id IS NOT NULL) DESC, r.created_at ASC NULLS LAST, r.id
    LIMIT 1;

    FOR dup_id IN
      SELECT r.id
      FROM public.rede_franqueados r
      WHERE trim(r.n_franquia) = grp.nf
        AND r.nome_completo ILIKE '%Sergio San Juan Dertkigil%'
        AND r.id <> keeper_id
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
        -- processo duplicado pode ser removido se não for o keeper
        DELETE FROM public.etapa_progresso WHERE processo_id = dup_proc;
        DELETE FROM public.processo_step_one WHERE id = dup_proc;
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

-- =============================================================================
-- PASSO 3 — Se ainda restarem 2 linhas (FK0039 + FK0040) do mesmo franqueado,
--           manter só FK0039 (número original das tentativas) e remover FK0040
-- =============================================================================
DO $$
DECLARE
  keeper_id UUID;
  dup_id UUID;
  dup_proc UUID;
  keeper_proc UUID;
BEGIN
  IF (SELECT COUNT(*) FROM public.rede_franqueados WHERE nome_completo ILIKE '%Sergio San Juan Dertkigil%') <= 1 THEN
    RETURN;
  END IF;

  SELECT r.id
  INTO keeper_id
  FROM public.rede_franqueados r
  WHERE r.nome_completo ILIKE '%Sergio San Juan Dertkigil%'
  ORDER BY
    CASE WHEN trim(r.n_franquia) = 'FK0039' THEN 0 ELSE 1 END,
    (r.processo_id IS NOT NULL) DESC,
    r.created_at ASC NULLS LAST,
    r.id
  LIMIT 1;

  FOR dup_id IN
    SELECT r.id
    FROM public.rede_franqueados r
    WHERE r.nome_completo ILIKE '%Sergio San Juan Dertkigil%'
      AND r.id <> keeper_id
  LOOP
    SELECT processo_id INTO dup_proc FROM public.rede_franqueados WHERE id = dup_id;
    SELECT processo_id INTO keeper_proc FROM public.rede_franqueados WHERE id = keeper_id;

    IF dup_proc IS NOT NULL AND keeper_proc IS NULL THEN
      UPDATE public.rede_franqueados SET processo_id = dup_proc WHERE id = keeper_id;
      UPDATE public.processo_step_one SET origem_rede_franqueados_id = keeper_id WHERE id = dup_proc;
    ELSIF dup_proc IS NOT NULL AND keeper_proc IS NOT NULL AND dup_proc <> keeper_proc THEN
      DELETE FROM public.etapa_progresso WHERE processo_id = dup_proc;
      DELETE FROM public.processo_step_one WHERE id = dup_proc;
    END IF;

    UPDATE public.processo_step_one SET origem_rede_franqueados_id = keeper_id WHERE origem_rede_franqueados_id = dup_id;
    UPDATE public.kanban_cards SET rede_franqueado_id = keeper_id WHERE rede_franqueado_id = dup_id;
    UPDATE public.profiles SET rede_franqueado_id = keeper_id WHERE rede_franqueado_id = dup_id;

    DELETE FROM public.rede_franqueados WHERE id = dup_id;
  END LOOP;
END $$;

-- Conferência final
SELECT id, n_franquia, nome_completo, processo_id, created_at
FROM public.rede_franqueados
WHERE nome_completo ILIKE '%Sergio San Juan Dertkigil%'
ORDER BY created_at;

-- Deve retornar exatamente 1 linha (idealmente FK0039 com processo_id preenchido).
-- Se estiver ok:
COMMIT;
-- Se algo estiver errado:
-- ROLLBACK;
