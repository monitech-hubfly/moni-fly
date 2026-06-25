-- 400: SLAs Funil Pré Obra e Obra (Operações) + coluna sla_tipo + remoção fase Habite-se Emitido.
-- sla_tipo: 'uteis' (d.u., default) | 'corridos' (d.c.)
-- Habite-se Emitido (slug operacoes_habite_se) → cards movidos para operacoes_entregue (sucessor).

-- ─── 1. Coluna sla_tipo ───────────────────────────────────────────────────────
ALTER TABLE public.kanban_fases
  ADD COLUMN IF NOT EXISTS sla_tipo text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'kanban_fases_sla_tipo_check'
      AND conrelid = 'public.kanban_fases'::regclass
  ) THEN
    ALTER TABLE public.kanban_fases
      ADD CONSTRAINT kanban_fases_sla_tipo_check
      CHECK (sla_tipo IS NULL OR sla_tipo IN ('uteis', 'corridos'));
  END IF;
END;
$$;

UPDATE public.kanban_fases
SET sla_tipo = COALESCE(sla_tipo, 'uteis')
WHERE sla_tipo IS NULL;

ALTER TABLE public.kanban_fases
  ALTER COLUMN sla_tipo SET DEFAULT 'uteis';

COMMENT ON COLUMN public.kanban_fases.sla_tipo IS
  'Tipo de SLA da fase: uteis (dias úteis) ou corridos (dias corridos). Default uteis.';

-- ─── 2. Atualizar SLAs por slug (Funil Operações) ─────────────────────────────
DO $$
DECLARE
  v_kanban_id uuid := 'f6bba1de-a7a1-4b14-89d1-10c2f7bba636'::uuid;
BEGIN
  UPDATE public.kanban_fases SET sla_dias = 3,  sla_tipo = 'uteis'    WHERE kanban_id = v_kanban_id AND slug = 'planialtimetrico';
  UPDATE public.kanban_fases SET sla_dias = 5,  sla_tipo = 'uteis'    WHERE kanban_id = v_kanban_id AND slug = 'projeto_legal';
  UPDATE public.kanban_fases SET sla_dias = NULL, sla_tipo = 'uteis'  WHERE kanban_id = v_kanban_id AND slug = 'aprovacao_condominio';
  UPDATE public.kanban_fases SET sla_dias = NULL, sla_tipo = 'uteis'  WHERE kanban_id = v_kanban_id AND slug = 'aprovacao_prefeitura';
  UPDATE public.kanban_fases SET sla_dias = 3,  sla_tipo = 'uteis'    WHERE kanban_id = v_kanban_id AND slug = 'revisao_bca';
  UPDATE public.kanban_fases SET sla_dias = NULL, sla_tipo = 'uteis'  WHERE kanban_id = v_kanban_id AND slug = 'processos_cartorarios';
  UPDATE public.kanban_fases SET sla_dias = 30, sla_tipo = 'corridos' WHERE kanban_id = v_kanban_id AND slug = 'aguardando_credito';
  UPDATE public.kanban_fases SET sla_dias = 180, sla_tipo = 'corridos' WHERE kanban_id = v_kanban_id AND slug = 'em_obra';
END;
$$;

-- ─── 3. Remover fase Habite-se Emitido (operacoes_habite_se) ──────────────────
DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_habite_id UUID;
  v_fase_entregue_id UUID;
  v_habite_ordem INT;
  v_cards_movidos INT;
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE id = 'f6bba1de-a7a1-4b14-89d1-10c2f7bba636'::uuid
     OR (nome = 'Funil Operações' AND COALESCE(ativo, true) = true)
  ORDER BY CASE WHEN id = 'f6bba1de-a7a1-4b14-89d1-10c2f7bba636'::uuid THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '400: Funil Operações não encontrado; pulando remoção Habite-se.';
    RETURN;
  END IF;

  SELECT id, ordem
  INTO v_fase_habite_id, v_habite_ordem
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug = 'operacoes_habite_se'
  LIMIT 1;

  IF v_fase_habite_id IS NULL THEN
    RAISE NOTICE '400: fase operacoes_habite_se não encontrada; pulando remoção Habite-se.';
    RETURN;
  END IF;

  SELECT id
  INTO v_fase_entregue_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug = 'operacoes_entregue'
  LIMIT 1;

  -- Checklist da fase Habite-se
  DELETE FROM public.kanban_fase_checklist_respostas r
  USING public.kanban_fase_checklist_itens i
  WHERE r.item_id = i.id
    AND i.fase_id = v_fase_habite_id;

  DELETE FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_habite_id;

  UPDATE public.kanban_fases
  SET instrucoes = NULL
  WHERE id = v_fase_habite_id;

  -- Cards nativos → operacoes_entregue (fase sucessora)
  IF v_fase_entregue_id IS NOT NULL THEN
    UPDATE public.kanban_cards c
    SET fase_id = v_fase_entregue_id,
        updated_at = now()
    WHERE c.fase_id = v_fase_habite_id;

    GET DIAGNOSTICS v_cards_movidos = ROW_COUNT;
    RAISE NOTICE '400: % card(s) movidos de operacoes_habite_se → operacoes_entregue.', v_cards_movidos;
  END IF;

  -- Legado processo_step_one (Painel Novos Negócios)
  UPDATE public.processo_step_one p
  SET etapa_painel = 'operacoes_entregue',
      updated_at = now()
  WHERE p.etapa_painel IN ('operacoes_habite_se', 'habite_se_emitido');

  -- Desativa fase (não deleta)
  UPDATE public.kanban_fases
  SET ativo = false,
      instrucoes = NULL,
      nome = 'Habite-se Emitido — removida 400'
  WHERE id = v_fase_habite_id
    AND COALESCE(ativo, true) = true;

  -- Renumera fases ativas posteriores
  IF v_habite_ordem IS NOT NULL THEN
    UPDATE public.kanban_fases
    SET ordem = ordem - 1
    WHERE kanban_id = v_kanban_id
      AND COALESCE(ativo, true) = true
      AND ordem > v_habite_ordem;
  END IF;
END;
$$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('400', 'operacoes_sla_tipo_habite_se')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
