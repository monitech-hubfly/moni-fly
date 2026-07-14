-- =============================================================================
-- Migration: 460_fix_carometro_vinculos_item_id_uuid.sql
-- Projeto: Hub Fly (Next.js 14 + Supabase)
-- Descrição: Corrige item_id em sirene_pericia_carometro_vinculos de bigint
--             para uuid, caso a tabela tenha sido criada com tipo errado por
--             uma versão anterior da migration 459.
-- Idempotente: sim (verifica tipo antes de alterar)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sirene_pericia_carometro_vinculos'
      AND column_name = 'item_id'
      AND data_type = 'bigint'
  ) THEN
    -- Remove constraint CHECK para poder recriar a coluna
    ALTER TABLE sirene_pericia_carometro_vinculos
      DROP CONSTRAINT IF EXISTS sirene_pericia_carometro_vinculos_item_tipo_check;

    -- Recria coluna como uuid (seguro: tabela estava vazia em bigint)
    ALTER TABLE sirene_pericia_carometro_vinculos DROP COLUMN item_id;
    ALTER TABLE sirene_pericia_carometro_vinculos ADD COLUMN item_id uuid NOT NULL DEFAULT gen_random_uuid();

    -- Restaura constraint de item_tipo
    ALTER TABLE sirene_pericia_carometro_vinculos
      ADD CONSTRAINT sirene_pericia_carometro_vinculos_item_tipo_check
      CHECK (item_tipo IN ('acao', 'tarefa'));

    RAISE NOTICE 'item_id alterado de bigint para uuid com sucesso.';
  ELSE
    RAISE NOTICE 'item_id ja e uuid ou nao existe — nada a fazer.';
  END IF;
END;
$$;

-- Recriar índice garantindo coluna correta
DROP INDEX IF EXISTS idx_carometro_vinculos_item;
CREATE INDEX IF NOT EXISTS idx_carometro_vinculos_item
  ON sirene_pericia_carometro_vinculos(item_tipo, item_id);

NOTIFY pgrst, 'reload schema';
