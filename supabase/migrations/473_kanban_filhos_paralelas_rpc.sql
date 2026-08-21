-- Bolinhas paralelas (Operações): filhos visíveis sem depender de service role no app.
-- SECURITY DEFINER bypassa RLS para leitura de existência/fase dos filhos (Acoplamento, PL, Locais, Cash Me).

CREATE OR REPLACE FUNCTION public.kanban_filhos_paralelas_por_pais(p_pai_ids uuid[])
RETURNS TABLE (
  origem_card_id uuid,
  filho_kanban_id uuid,
  fase_nome text,
  fase_slug text,
  concluido boolean,
  arquivado boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH consulta AS (
    SELECT DISTINCT unnest(COALESCE(p_pai_ids, ARRAY[]::uuid[])) AS id
  ),
  consulta_titulos AS (
    SELECT c.id AS consulta_id,
           NULLIF(trim(split_part(COALESCE(c.titulo, ''), ' - ', 1)), '') AS fk_prefix
    FROM consulta q
    JOIN kanban_cards c ON c.id = q.id
  ),
  esteiras AS (
    SELECT unnest(
      ARRAY[
        '15847602-231d-4937-a06f-82027eb87ef3'::uuid,
        '39de341d-aebf-481c-9118-ce6fc6574187'::uuid,
        'c2ab09bd-4bd6-491e-8734-281d7678a6ad'::uuid,
        '6463af1d-850d-4958-b74c-404f8d668e21'::uuid
      ]
    ) AS kanban_id
  ),
  filhos_origem AS (
    SELECT
      f.origem_card_id,
      f.kanban_id AS filho_kanban_id,
      kf.nome AS fase_nome,
      kf.slug AS fase_slug,
      COALESCE(f.concluido, false) AS concluido,
      COALESCE(f.arquivado, false) AS arquivado
    FROM kanban_cards f
    LEFT JOIN kanban_fases kf ON kf.id = f.fase_id
    WHERE f.origem_card_id IN (SELECT id FROM consulta)
      AND f.kanban_id IN (SELECT kanban_id FROM esteiras)
  ),
  filhos_fk AS (
    SELECT
      ct.consulta_id AS origem_card_id,
      f.kanban_id AS filho_kanban_id,
      kf.nome AS fase_nome,
      kf.slug AS fase_slug,
      COALESCE(f.concluido, false) AS concluido,
      COALESCE(f.arquivado, false) AS arquivado
    FROM consulta_titulos ct
    JOIN kanban_cards f
      ON ct.fk_prefix IS NOT NULL
     AND f.titulo ILIKE ct.fk_prefix || '%'
    LEFT JOIN kanban_fases kf ON kf.id = f.fase_id
    WHERE f.kanban_id IN (SELECT kanban_id FROM esteiras)
      AND f.id NOT IN (SELECT id FROM consulta)
  ),
  vinculos AS (
    SELECT
      CASE
        WHEN v.card_origem_id IN (SELECT id FROM consulta) THEN v.card_origem_id
        ELSE v.card_destino_id
      END AS origem_card_id,
      f.kanban_id AS filho_kanban_id,
      kf.nome AS fase_nome,
      kf.slug AS fase_slug,
      COALESCE(f.concluido, false) AS concluido,
      COALESCE(f.arquivado, false) AS arquivado
    FROM kanban_card_vinculos v
    JOIN kanban_cards f ON f.id = CASE
      WHEN v.card_origem_id IN (SELECT id FROM consulta) THEN v.card_destino_id
      ELSE v.card_origem_id
    END
    LEFT JOIN kanban_fases kf ON kf.id = f.fase_id
    WHERE (
      v.card_origem_id IN (SELECT id FROM consulta)
      OR v.card_destino_id IN (SELECT id FROM consulta)
    )
      AND f.kanban_id IN (SELECT kanban_id FROM esteiras)
  )
  SELECT * FROM filhos_origem
  UNION ALL
  SELECT * FROM filhos_fk
  UNION ALL
  SELECT * FROM vinculos;
$$;

REVOKE ALL ON FUNCTION public.kanban_filhos_paralelas_por_pais(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kanban_filhos_paralelas_por_pais(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kanban_filhos_paralelas_por_pais(uuid[]) TO service_role;

NOTIFY pgrst, 'reload schema';
