-- 516: Funil Loteadores — renomear slug Contrato → Cto Showroom.
-- fechar_contrato_moni_inc → cto_showroom_moni_inc (display: Cto Showroom).
--
-- Schema: kanban_cards NÃO tem coluna fase_slug — usa fase_id (FK).
-- Cards permanecem na mesma fase pelo UUID; só o slug da fase muda.
-- Também atualiza slugs textuais em kanban_card_vinculos, se houver.
-- Idempotente.

DO $$
DECLARE
  v_kanban_id UUID := '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid;
  v_from UUID;
  v_to UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban_id) THEN
    RAISE NOTICE '516: Funil Loteadores não encontrado — pulando.';
    RETURN;
  END IF;

  SELECT id INTO v_from
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'fechar_contrato_moni_inc'
  LIMIT 1;

  SELECT id INTO v_to
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'cto_showroom_moni_inc'
  LIMIT 1;

  IF v_from IS NOT NULL AND v_to IS NOT NULL AND v_from <> v_to THEN
    -- Já existe destino (ex.: re-run / migration 511): mover cards e desativar legado
    UPDATE public.kanban_cards
    SET fase_id = v_to
    WHERE kanban_id = v_kanban_id AND fase_id = v_from;

    UPDATE public.kanban_fases
    SET ativo = false, nome = 'Contrato (legado)'
    WHERE id = v_from;

    UPDATE public.kanban_fases
    SET nome = 'Cto Showroom', ativo = true
    WHERE id = v_to;

    RAISE NOTICE '516: unificado fechar_contrato → cto_showroom existente (from=% to=%)', v_from, v_to;

  ELSIF v_from IS NOT NULL AND v_to IS NULL THEN
    UPDATE public.kanban_fases
    SET
      slug = 'cto_showroom_moni_inc',
      nome = 'Cto Showroom'
    WHERE id = v_from;

    RAISE NOTICE '516: slug renomeado fechar_contrato_moni_inc → cto_showroom_moni_inc (id=%)', v_from;

  ELSIF v_from IS NULL AND v_to IS NOT NULL THEN
    UPDATE public.kanban_fases
    SET nome = 'Cto Showroom', ativo = true
    WHERE id = v_to;
    RAISE NOTICE '516: cto_showroom_moni_inc já existia — display garantido.';

  ELSE
    RAISE NOTICE '516: nem fechar_contrato nem cto_showroom encontrados — pulando rename.';
  END IF;

  -- Referências textuais de slug em vínculos (bastão / histórico de vínculo)
  UPDATE public.kanban_card_vinculos
  SET fase_origem_slug = 'cto_showroom_moni_inc'
  WHERE fase_origem_slug = 'fechar_contrato_moni_inc';

  UPDATE public.kanban_card_vinculos
  SET fase_destino_slug = 'cto_showroom_moni_inc'
  WHERE fase_destino_slug = 'fechar_contrato_moni_inc';

  RAISE NOTICE '516: rename Contrato → Cto Showroom concluído.';
END $$;

NOTIFY pgrst, 'reload schema';
