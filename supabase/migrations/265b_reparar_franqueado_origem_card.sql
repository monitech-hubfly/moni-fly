-- 265b: Reparo cadeia origem_card_id (pais → filhos).
-- SQL Editor: rode o bloco -- PART A repetidamente até retornar "0 rows" ou use 266b (1 lote manual).
-- batch_size=100; máx. 40 passes internos por execução (re-execute o arquivo se ainda houver pendentes).

-- ══════════════════════════════════════════════════════════════════════════════
-- PART A — origem_card_id (re-execute até concluir)
-- ══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  batch_size constant int := 100;
  max_passes   constant int := 40;
  n int;
  pass_total int;
  pass_num int := 0;
BEGIN
  LOOP
    pass_num := pass_num + 1;
    EXIT WHEN pass_num > max_passes;

    pass_total := 0;
    LOOP
      UPDATE public.kanban_cards filho
      SET rede_franqueado_id = pai.rede_franqueado_id
      FROM public.kanban_cards pai
      WHERE filho.origem_card_id = pai.id
        AND filho.rede_franqueado_id IS NULL
        AND pai.rede_franqueado_id IS NOT NULL
        AND filho.id IN (
          SELECT f.id
          FROM public.kanban_cards f
          INNER JOIN public.kanban_cards p ON f.origem_card_id = p.id
          WHERE f.rede_franqueado_id IS NULL
            AND p.rede_franqueado_id IS NOT NULL
          LIMIT batch_size
        );

      GET DIAGNOSTICS n = ROW_COUNT;
      pass_total := pass_total + n;
      EXIT WHEN n = 0;
    END LOOP;

    EXIT WHEN pass_total = 0;
  END LOOP;

  RAISE NOTICE '265b parte A: concluída após % passes (batch %)', pass_num, batch_size;
END $$;

-- Verificação (opcional): deve retornar 0 quando PART A terminou
SELECT count(*) AS pendentes_origem
FROM public.kanban_cards f
INNER JOIN public.kanban_cards p ON f.origem_card_id = p.id
WHERE f.rede_franqueado_id IS NULL
  AND p.rede_franqueado_id IS NOT NULL;
