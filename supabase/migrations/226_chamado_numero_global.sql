-- 226: Número único global por chamado (kanban_atividades.numero)
-- Backfill pesado opcional: supabase/scripts/225_226_backfill.sql

-- Garante colunas da migration 225 (caso 225 tenha falhado antes do commit)
ALTER TABLE public.kanban_atividades
  ADD COLUMN IF NOT EXISTS time_abertura_nome TEXT;

ALTER TABLE public.kanban_atividades
  ADD COLUMN IF NOT EXISTS numero INTEGER;

COMMENT ON COLUMN public.kanban_atividades.numero IS
  'Número sequencial global do chamado (#0001). Gerado na abertura; exibido na Sirene, cards e Pastéis.';

-- Backfill rápido: espelha sirene_chamados.numero (1:1 via sirene_chamado_id)
UPDATE public.kanban_atividades ka
SET numero = sc.numero
FROM public.sirene_chamados sc
WHERE ka.sirene_chamado_id = sc.id
  AND ka.numero IS NULL
  AND sc.numero IS NOT NULL;

-- Demais chamados Sirene sem vínculo: aloca em lote (sem nextval por linha)
WITH base AS (
  SELECT COALESCE(
    GREATEST(
      (SELECT MAX(numero) FROM public.sirene_chamados),
      (SELECT MAX(numero) FROM public.kanban_atividades WHERE numero IS NOT NULL),
      0
    ),
    0
  ) AS max_num
),
pendentes AS (
  SELECT
    ka.id,
    ROW_NUMBER() OVER (ORDER BY ka.created_at NULLS LAST, ka.id) AS rn
  FROM public.kanban_atividades ka
  WHERE ka.origem = 'sirene'
    AND ka.numero IS NULL
)
UPDATE public.kanban_atividades ka
SET numero = base.max_num + pendentes.rn
FROM pendentes
CROSS JOIN base
WHERE ka.id = pendentes.id;

-- Índice único (NULL permitido em linhas não-Sirene)
DROP INDEX IF EXISTS public.kanban_atividades_numero_key;
CREATE UNIQUE INDEX kanban_atividades_numero_key
  ON public.kanban_atividades (numero)
  WHERE numero IS NOT NULL;

-- Sirene exige número; demais origens permanecem NULL
ALTER TABLE public.kanban_atividades DROP CONSTRAINT IF EXISTS kanban_atividades_sirene_numero_check;
ALTER TABLE public.kanban_atividades
  ADD CONSTRAINT kanban_atividades_sirene_numero_check
  CHECK (origem <> 'sirene' OR numero IS NOT NULL);

-- Novos chamados Sirene: espelha sirene_chamados.numero ou usa a sequência
CREATE OR REPLACE FUNCTION public.trg_kanban_atividades_numero_sirene()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.origem <> 'sirene' OR NEW.numero IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.sirene_chamado_id IS NOT NULL THEN
    SELECT sc.numero INTO NEW.numero
    FROM public.sirene_chamados sc
    WHERE sc.id = NEW.sirene_chamado_id;
  END IF;

  IF NEW.numero IS NULL THEN
    NEW.numero := nextval('public.sirene_numero_seq');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kanban_atividades_numero_sirene ON public.kanban_atividades;
CREATE TRIGGER trg_kanban_atividades_numero_sirene
  BEFORE INSERT OR UPDATE OF origem, sirene_chamado_id, numero
  ON public.kanban_atividades
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_kanban_atividades_numero_sirene();

-- Sincronizar sequência acima do maior número existente
SELECT setval(
  'public.sirene_numero_seq',
  GREATEST(
    COALESCE((SELECT MAX(numero) FROM public.sirene_chamados), 0),
    COALESCE((SELECT MAX(numero) FROM public.kanban_atividades), 0),
    COALESCE((SELECT last_value FROM public.sirene_numero_seq), 0)
  )
);

-- View unificada: expor numero do chamado
DROP VIEW IF EXISTS public.v_atividades_unificadas;

CREATE VIEW public.v_atividades_unificadas
WITH (security_invoker = true)
AS
SELECT
  a.id,
  a.card_id,
  a.numero AS chamado_numero,

  COALESCE(
    kc.titulo,
    vmap.titulo,
    CASE a.origem
      WHEN 'sirene'   THEN '(chamado direto)'
      WHEN 'externo'  THEN '(externo)'
      ELSE                 '(sem título)'
    END
  ) AS card_titulo,

  COALESCE(kf.nome, '') AS fase_nome,

  COALESCE(
    k.nome,
    CASE a.origem
      WHEN 'sirene'  THEN 'Sirene'
      WHEN 'externo' THEN 'Externo'
      ELSE                ''
    END
  ) AS kanban_nome,

  COALESCE(kc.kanban_id, vmap.kanban_id) AS kanban_id,

  a.responsavel_id,
  COALESCE(rsp.full_name, rsp.email) AS responsavel_nome,

  a.tipo,
  a.categoria,
  a.time_abertura_nome,

  COALESCE(
    NULLIF(trim(a.titulo), ''),
    NULLIF(trim(a.descricao), ''),
    '(sem título)'
  ) AS titulo,

  a.descricao,

  a.status AS atividade_status,

  a.data_vencimento,

  a.time AS time_nome,

  a.times_ids,

  ARRAY(
    SELECT t.nome
    FROM   public.kanban_times t
    WHERE  t.id = ANY (a.times_ids)
    ORDER  BY t.nome
  ) AS times_nomes,

  COALESCE(fp_card.full_name, fp_card.email, fp_leg.full_name, fp_leg.email) AS franqueado_nome,

  a.created_at AS criado_em,

  CASE
    WHEN a.data_vencimento IS NULL    THEN NULL::text
    WHEN a.data_vencimento < CURRENT_DATE THEN 'atrasado'
    WHEN a.data_vencimento = CURRENT_DATE THEN 'vence_hoje'
    ELSE 'ok'
  END::text AS sla_status

FROM public.kanban_atividades a
LEFT JOIN public.kanban_cards kc
  ON kc.id = a.card_id
 AND a.origem = 'nativo'
LEFT JOIN public.v_processo_como_kanban_cards vmap
  ON vmap.id = a.card_id
 AND a.origem = 'legado'
LEFT JOIN public.kanban_fases kf
  ON kf.id = COALESCE(kc.fase_id, vmap.fase_id)
LEFT JOIN public.kanbans k
  ON k.id = COALESCE(kc.kanban_id, vmap.kanban_id)
LEFT JOIN public.profiles rsp
  ON rsp.id = a.responsavel_id
LEFT JOIN public.profiles fp_card
  ON fp_card.id = kc.franqueado_id
LEFT JOIN public.profiles fp_leg
  ON fp_leg.id = vmap.responsavel_id
WHERE
  (a.origem = 'nativo'  AND kc.id   IS NOT NULL)
  OR (a.origem = 'legado'   AND vmap.id IS NOT NULL)
  OR  a.origem = 'sirene'
  OR  a.origem = 'externo';

GRANT SELECT ON public.v_atividades_unificadas TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
