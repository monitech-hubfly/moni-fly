-- Numerador de exibição das áreas nos filtros de todo o sistema.
-- Supabase → SQL Editor → Run. Depois: NOTIFY ou aguardar refresh do schema.

ALTER TABLE areas ADD COLUMN IF NOT EXISTS ordem int NOT NULL DEFAULT 0;

COMMENT ON COLUMN areas.ordem IS 'Ordem nos filtros (menor = primeiro). Editável em Gerenciar Áreas.';

CREATE INDEX IF NOT EXISTS idx_areas_ordem_nome ON areas(ordem, nome);

-- Opcional (uma vez): distribuir ordem 10, 20, 30… pela ordem alfabética atual (só onde ainda é 0).
-- Comente as linhas abaixo se já tiver definido ordens manualmente.
/*
UPDATE areas a
SET ordem = x.n
FROM (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY nome ASC)) * 10 AS n
  FROM areas
) x
WHERE a.id = x.id AND a.ordem = 0;
*/
