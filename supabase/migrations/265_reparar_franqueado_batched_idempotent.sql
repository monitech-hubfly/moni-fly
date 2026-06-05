-- 265: Reparo idempotente de rede_franqueado_id (substitui loops completos da 262 original).
-- Seguro se a 262 antiga estourou timeout no meio ou não foi registrada.
-- Rodar no SQL editor: uma migration; batch_size=500 (ajuste para 200 se ainda timeout).

CREATE INDEX IF NOT EXISTS idx_kanban_cards_rede_null_origem
  ON kanban_cards (origem_card_id)
  WHERE rede_franqueado_id IS NULL AND origem_card_id IS NOT NULL;

-- ── Parte A: cadeia origem_card_id ──────────────────────────────────────────
DO $$
DECLARE
  batch_size constant int := 500;
  n int;
  pass_total int;
  pass_num int := 0;
BEGIN
  LOOP
    pass_num := pass_num + 1;
    EXIT WHEN pass_num > 32;

    pass_total := 0;
    LOOP
      UPDATE kanban_cards filho
      SET rede_franqueado_id = pai.rede_franqueado_id
      FROM kanban_cards pai
      WHERE filho.origem_card_id = pai.id
        AND filho.rede_franqueado_id IS NULL
        AND pai.rede_franqueado_id IS NOT NULL
        AND filho.id IN (
          SELECT f.id
          FROM kanban_cards f
          INNER JOIN kanban_cards p ON f.origem_card_id = p.id
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

  RAISE NOTICE '265 parte A (origem_card_id): concluída após % passes', pass_num;
END $$;

-- ── Parte B: vínculos bidirecionais ─────────────────────────────────────────
DO $$
DECLARE
  batch_size constant int := 500;
  n int;
  pass_total int;
  pass_num int := 0;
BEGIN
  LOOP
    pass_num := pass_num + 1;
    EXIT WHEN pass_num > 16;

    pass_total := 0;

    LOOP
      UPDATE kanban_cards alvo
      SET rede_franqueado_id = fonte.rede_franqueado_id
      FROM kanban_card_vinculos v
      JOIN kanban_cards fonte ON fonte.id = v.card_origem_id
      WHERE alvo.id = v.card_destino_id
        AND alvo.rede_franqueado_id IS NULL
        AND fonte.rede_franqueado_id IS NOT NULL
        AND alvo.id IN (
          SELECT k.id
          FROM kanban_cards k
          JOIN kanban_card_vinculos vv ON k.id = vv.card_destino_id
          JOIN kanban_cards fo ON fo.id = vv.card_origem_id
          WHERE k.rede_franqueado_id IS NULL
            AND fo.rede_franqueado_id IS NOT NULL
          LIMIT batch_size
        );

      GET DIAGNOSTICS n = ROW_COUNT;
      pass_total := pass_total + n;
      EXIT WHEN n = 0;
    END LOOP;

    LOOP
      UPDATE kanban_cards alvo
      SET rede_franqueado_id = fonte.rede_franqueado_id
      FROM kanban_card_vinculos v
      JOIN kanban_cards fonte ON fonte.id = v.card_destino_id
      WHERE alvo.id = v.card_origem_id
        AND alvo.rede_franqueado_id IS NULL
        AND fonte.rede_franqueado_id IS NOT NULL
        AND alvo.id IN (
          SELECT k.id
          FROM kanban_cards k
          JOIN kanban_card_vinculos vv ON k.id = vv.card_origem_id
          JOIN kanban_cards fo ON fo.id = vv.card_destino_id
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

  RAISE NOTICE '265 parte B (vínculos): concluída após % passes', pass_num;
END $$;

-- ── Parte C: espelho em processo_step_one ───────────────────────────────────
DO $$
DECLARE
  batch_size constant int := 500;
  n int;
  total int := 0;
BEGIN
  LOOP
    UPDATE processo_step_one ps
    SET
      origem_rede_franqueados_id = batch.rede_franqueado_id,
      numero_franquia = coalesce(ps.numero_franquia, batch.n_franquia),
      updated_at = now()
    FROM (
      SELECT
        ps2.id,
        k.rede_franqueado_id,
        rf.n_franquia
      FROM processo_step_one ps2
      JOIN kanban_cards k ON (
        ps2.id = k.id
        OR ps2.id = k.projeto_id
        OR k.projeto_id = ps2.id
      )
      JOIN rede_franqueados rf ON rf.id = k.rede_franqueado_id
      WHERE ps2.origem_rede_franqueados_id IS NULL
        AND k.rede_franqueado_id IS NOT NULL
      LIMIT batch_size
    ) batch
    WHERE ps.id = batch.id;

    GET DIAGNOSTICS n = ROW_COUNT;
    total := total + n;
    EXIT WHEN n = 0;
  END LOOP;

  RAISE NOTICE '265 parte C (processo_step_one): % linha(s) atualizada(s)', total;
END $$;
