-- 440: Motor 01 — campos compartilhados de imagens/simulador/fachada como anexo_multiplo
-- Idempotente. Aplica apenas onde tipo ainda é 'anexo'.

UPDATE public.kanban_fase_checklist_itens
SET tipo = 'anexo_multiplo'
WHERE chave_compartilhada IN (
  'imagens_modelo_1', 'imagens_modelo_2', 'imagens_modelo_3',
  'simulador_modelo_1', 'simulador_modelo_2', 'simulador_modelo_3',
  'possibilidades_fachada_1', 'possibilidades_fachada_2', 'possibilidades_fachada_3'
)
AND tipo = 'anexo';

DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.kanban_fase_checklist_itens
  WHERE chave_compartilhada IN (
    'imagens_modelo_1', 'imagens_modelo_2', 'imagens_modelo_3',
    'simulador_modelo_1', 'simulador_modelo_2', 'simulador_modelo_3',
    'possibilidades_fachada_1', 'possibilidades_fachada_2', 'possibilidades_fachada_3'
  )
    AND tipo = 'anexo_multiplo';

  RAISE NOTICE '440: itens anexo_multiplo (9 chaves) = % (esperado 48)', v_count;
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('440', 'motor01_anexo_multiplo_compartilhado')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
