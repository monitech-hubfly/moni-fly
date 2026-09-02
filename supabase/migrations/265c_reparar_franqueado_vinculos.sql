-- 265c: Reparo via kanban_card_vinculos (bidirecional).
-- SQL Editor: re-execute -- PART B até pendentes_vinculos = 0. Depois rode 265d.

-- ══════════════════════════════════════════════════════════════════════════════
-- PART B — vínculos (re-execute até concluir)
-- ══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  batch_size constant int := 100;
  max_passes   constant int := 20;
  n int;
  pass_total int;
  pass_num int := 0;
BEGIN
  LOOP
    pass_num := pass_num + 1;
    EXIT WHEN pass_num > max_passes;

    pass_total := 0;

    LOOP
      UPDATE public.kanban_cards alvo
      SET rede_franqueado_id = fonte.rede_franqueado_id
      FROM public.kanban_card_vinculos v
      JOIN public.kanban_cards fonte ON fonte.id = v.card_origem_id
      WHERE alvo.id = v.card_destino_id
        AND alvo.rede_franqueado_id IS NULL
        AND fonte.rede_franqueado_id IS NOT NULL
        AND alvo.id IN (
          SELECT k.id
          FROM public.kanban_cards k
          JOIN public.kanban_card_vinculos vv ON k.id = vv.card_destino_id
          JOIN public.kanban_cards fo ON fo.id = vv.card_origem_id
          WHERE k.rede_franqueado_id IS NULL
            AND fo.rede_franqueado_id IS NOT NULL
          LIMIT batch_size
        );

      GET DIAGNOSTICS n = ROW_COUNT;
      pass_total := pass_total + n;
      EXIT WHEN n = 0;
    END LOOP;

    LOOP
      UPDATE public.kanban_cards alvo
      SET rede_franqueado_id = fonte.rede_franqueado_id
      FROM public.kanban_card_vinculos v
      JOIN public.kanban_cards fonte ON fonte.id = v.card_destino_id
      WHERE alvo.id = v.card_origem_id
        AND alvo.rede_franqueado_id IS NULL
        AND fonte.rede_franqueado_id IS NOT NULL
        AND alvo.id IN (
          SELECT k.id
          FROM public.kanban_cards k
          JOIN public.kanban_card_vinculos vv ON k.id = vv.card_origem_id
          JOIN public.kanban_cards fo ON fo.id = vv.card_destino_id
          WHERE k.rede_franqueado_id IS NULL
            AND fo.rede_franqueado_id IS NOT NULL
          LIMIT batch_size
        );

      GET DIAGNOSTICS n = ROW_COUNT;
      pass_total := pass_total + n;
      EXIT WHEN n = 0;
    END LOOP;

    EXIT WHEN pass_total = 0;
  END LOOP;

  RAISE NOTICE '265c parte B (vínculos): concluída após % passes', pass_num;
END $$;

-- Verificação (opcional)
SELECT count(*) AS pendentes_vinculos
FROM public.kanban_cards k
JOIN public.kanban_card_vinculos vv ON k.id = vv.card_destino_id OR k.id = vv.card_origem_id
JOIN public.kanban_cards fo ON fo.id = CASE WHEN k.id = vv.card_destino_id THEN vv.card_origem_id ELSE vv.card_destino_id END
WHERE k.rede_franqueado_id IS NULL
  AND fo.rede_franqueado_id IS NOT NULL;
