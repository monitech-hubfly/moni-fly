-- Colunas do Funil Jurídico (origem, contador de retrocessos, decisão de retroalimentação).
ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS juridico_origem text;

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS juridico_bolinha_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS juridico_retroalimentar boolean;

COMMENT ON COLUMN public.kanban_cards.juridico_origem IS
  'Origem do card no Funil Jurídico: portfolio | loteadores | operacoes';

COMMENT ON COLUMN public.kanban_cards.juridico_bolinha_count IS
  'Quantas vezes o card retrocedeu de juridico_assinatura para juridico_tratativas';

COMMENT ON COLUMN public.kanban_cards.juridico_retroalimentar IS
  'Fase 05 Pós-Assinatura: se true, forka para Retroalimentação (09); se false, para Atendimentos Concluídos (10)';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'kanban_cards_juridico_origem_check'
  ) THEN
    ALTER TABLE public.kanban_cards
      ADD CONSTRAINT kanban_cards_juridico_origem_check
      CHECK (
        juridico_origem IS NULL
        OR juridico_origem IN ('portfolio', 'loteadores', 'operacoes')
      );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
