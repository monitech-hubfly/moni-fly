-- Cria indicadores faltantes para metas Atingível - Projeto assumidas via TO DO & Planning
-- sem o indicador "Percentual de Evolução até Entrega (%)" correspondente.
-- Idempotente: NOT EXISTS garante que não cria duplicatas.
INSERT INTO indicadores (area_id, objetivo_id, nome, indicador_chave, tipo, profile_id, semaforo_faixas)
SELECT
  o.area_id,
  o.id,
  'Percentual de Evolução até Entrega (%)',
  true,
  'percentual',
  orr.profile_id,
  jsonb_build_object(
    'is_projeto_relativo', true,
    'data_inicio', orr.data_inicio,
    'data_fim', orr.data_fim,
    'dias_uteis', orr.dias_uteis,
    'escala_tipo', 'percentual',
    'faixas', '[
      {"cor":"#1e7a3a","limite":"75","comparacao":"gte"},
      {"cor":"#52b36f","limite":"60","comparacao":"gte"},
      {"cor":"#f2c94c","limite":"30","comparacao":"gte"},
      {"cor":"#d24141","limite":"0","comparacao":"gte"}
    ]'::jsonb
  )
FROM objetivos o
JOIN objetivo_responsaveis orr
  ON orr.objetivo_id = o.id
  AND orr.data_inicio IS NOT NULL
  AND orr.data_fim IS NOT NULL
WHERE o.tipo ILIKE 'atingivel - projeto'
AND NOT EXISTS (
  SELECT 1 FROM indicadores i
  WHERE i.objetivo_id = o.id
  AND (i.semaforo_faixas ->> 'is_projeto_relativo')::boolean = true
  AND i.profile_id = orr.profile_id
);

NOTIFY pgrst, 'reload schema';
