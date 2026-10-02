-- 596: Funil Jurídico — fundação do atendimento.
-- Reutiliza colunas já existentes. Não cria fase, não faz DROP de coluna/tabela/fase.
-- Rodada atual = juridico_bolinha_count (o número persistido já é a rodada, não rodada+1).
-- Idempotente. UUID: KANBAN_IDS.JURIDICO.

-- Tipo documental: vocabulário novo. Nenhum card em DEV/PROD usava os códigos antigos
-- cto_com_permuta / cto_sem_permuta no momento desta migration.
UPDATE public.kanban_cards
SET juridico_tipo_contrato = CASE juridico_tipo_contrato
  WHEN 'cto_com_permuta' THEN 'cto_com_precedentes'
  WHEN 'cto_sem_permuta' THEN 'cto_sem_precedentes'
  ELSE juridico_tipo_contrato
END
WHERE juridico_tipo_contrato IN ('cto_com_permuta', 'cto_sem_permuta');

ALTER TABLE public.kanban_cards
  DROP CONSTRAINT IF EXISTS kanban_cards_juridico_tipo_contrato_check;

ALTER TABLE public.kanban_cards
  ADD CONSTRAINT kanban_cards_juridico_tipo_contrato_check
  CHECK (
    juridico_tipo_contrato IS NULL
    OR juridico_tipo_contrato IN (
      'opcao',
      'cto_com_precedentes',
      'cto_sem_precedentes',
      'nda',
      'showroom',
      'parceria',
      'franquia',
      'cof'
    )
  );

COMMENT ON COLUMN public.kanban_cards.juridico_tipo_contrato IS
  'Funil Jurídico — tipo documental do atendimento: opcao | cto_com_precedentes | cto_sem_precedentes | nda | showroom | parceria | franquia | cof.';

COMMENT ON COLUMN public.kanban_cards.juridico_bolinha_count IS
  'Funil Jurídico — rodada atual do atendimento. O valor persistido é a rodada (não é revisões+1). Novo atendimento = 1. Soma 1 ao voltar de Enviado ao Parceiro, Subir p/ Assinatura ou Aguardando Assinaturas para Em alterações e respostas.';

COMMENT ON COLUMN public.kanban_cards.juridico_origem IS
  'Funil Jurídico — origem do atendimento: portfolio | loteadores | comercial. comercial = abertura manual ou chamado de Pré Obra e Obra.';

COMMENT ON COLUMN public.kanban_cards.juridico_retroalimentar IS
  'Legado. Não é regra das 8 fases ativas. A retroalimentação futura sai dos Pontos Jurídicos.';

COMMENT ON COLUMN public.kanban_cards.juridico_ok IS
  'Flag legada no card pai. Não move o card de origem. A movimentação do pai virá em bastões posteriores.';

-- Atendimento jurídico novo começa na rodada 1. Cards de outros funis permanecem em 0.
CREATE OR REPLACE FUNCTION public.fn_juridico_rodada_na_fase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kanban uuid := '35fb5c8d-50c0-4999-bc16-89d53c2e758f'::uuid;
  v_slug_antiga text;
  v_slug_nova text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.kanban_id = v_kanban AND COALESCE(NEW.juridico_bolinha_count, 0) < 1 THEN
      NEW.juridico_bolinha_count := 1;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.fase_id IS NOT DISTINCT FROM OLD.fase_id THEN
    RETURN NEW;
  END IF;

  IF NEW.kanban_id IS DISTINCT FROM v_kanban THEN
    RETURN NEW;
  END IF;

  SELECT slug INTO v_slug_antiga FROM public.kanban_fases WHERE id = OLD.fase_id;
  SELECT slug INTO v_slug_nova FROM public.kanban_fases WHERE id = NEW.fase_id;

  IF v_slug_nova = 'juridico_alteracoes_respostas'
     AND v_slug_antiga IN (
       'juridico_enviado_parceiro',
       'juridico_subir_assinatura',
       'juridico_aguardando_assinaturas'
     )
  THEN
    NEW.juridico_bolinha_count := GREATEST(COALESCE(OLD.juridico_bolinha_count, 1), 1) + 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_juridico_rodada_na_fase ON public.kanban_cards;
CREATE TRIGGER trg_juridico_rodada_na_fase
  BEFORE INSERT OR UPDATE OF fase_id
  ON public.kanban_cards
  FOR EACH ROW
  EXECUTE PROCEDURE public.fn_juridico_rodada_na_fase();

UPDATE public.kanban_cards
SET juridico_bolinha_count = 1
WHERE kanban_id = '35fb5c8d-50c0-4999-bc16-89d53c2e758f'::uuid
  AND COALESCE(juridico_bolinha_count, 0) < 1;

-- Checklists das 8 fases. Não apaga respostas existentes.
DO $$
DECLARE
  v_kanban_id uuid := '35fb5c8d-50c0-4999-bc16-89d53c2e758f'::uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban_id) THEN
    SELECT id INTO v_kanban_id
    FROM public.kanbans
    WHERE nome = 'Funil Jurídico'
    ORDER BY id
    LIMIT 1;
  END IF;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '596: Funil Jurídico não encontrado — pulando checklists.';
    RETURN;
  END IF;

  UPDATE public.kanban_fase_checklist_itens i
  SET obrigatorio = false
  FROM public.kanban_fases f
  WHERE i.fase_id = f.id
    AND f.kanban_id = v_kanban_id
    AND f.slug = 'juridico_pos_assinatura'
    AND i.campo_slug = 'juridico_retroalimentar_checklist'
    AND i.obrigatorio IS DISTINCT FROM false;

  INSERT INTO public.kanban_fase_checklist_itens (
    fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
  )
  SELECT f.id, i.ordem, i.label, i.tipo, i.obrigatorio, false, i.campo_slug, '{}'::jsonb
  FROM public.kanban_fases f
  CROSS JOIN (
    VALUES
      (1, 'Demanda identificada (condomínio, quadra e lote ou candidato)', 'checkbox', true, 'juridico_demanda_identificada'),
      (2, 'Origem da demanda registrada', 'checkbox', true, 'juridico_origem_registrada')
  ) AS i(ordem, label, tipo, obrigatorio, campo_slug)
  WHERE f.kanban_id = v_kanban_id
    AND f.slug = 'juridico_recebimento'
    AND NOT EXISTS (
      SELECT 1 FROM public.kanban_fase_checklist_itens x
      WHERE x.fase_id = f.id AND x.campo_slug = i.campo_slug
    );

  INSERT INTO public.kanban_fase_checklist_itens (
    fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
  )
  SELECT f.id, i.ordem, i.label, i.tipo, true, false, i.campo_slug, '{}'::jsonb
  FROM public.kanban_fases f
  CROSS JOIN (
    VALUES
      (1, 'Documento correto', 'checkbox', 'juridico_documento_correto'),
      (2, 'Partes identificadas', 'checkbox', 'juridico_partes_identificadas'),
      (3, 'Minuta ou base identificada', 'checkbox', 'juridico_minuta_identificada')
  ) AS i(ordem, label, tipo, campo_slug)
  WHERE f.kanban_id = v_kanban_id
    AND f.slug = 'juridico_analise_inicial'
    AND NOT EXISTS (
      SELECT 1 FROM public.kanban_fase_checklist_itens x
      WHERE x.fase_id = f.id AND x.campo_slug = i.campo_slug
    );

  INSERT INTO public.kanban_fase_checklist_itens (
    fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
  )
  SELECT
    f.id,
    4,
    'Tipo documental confirmado',
    'select',
    true,
    false,
    'juridico_tipo_contrato_confirmado',
    jsonb_build_object(
      'opcoes', jsonb_build_array(
        jsonb_build_object('value', 'opcao', 'label', 'Opção'),
        jsonb_build_object('value', 'cto_com_precedentes', 'label', 'Cto c/ Precedentes'),
        jsonb_build_object('value', 'cto_sem_precedentes', 'label', 'Cto s/ Precedentes'),
        jsonb_build_object('value', 'nda', 'label', 'NDA'),
        jsonb_build_object('value', 'showroom', 'label', 'Showroom'),
        jsonb_build_object('value', 'parceria', 'label', 'Parceria'),
        jsonb_build_object('value', 'franquia', 'label', 'Franquia'),
        jsonb_build_object('value', 'cof', 'label', 'COF')
      )
    )
  FROM public.kanban_fases f
  WHERE f.kanban_id = v_kanban_id
    AND f.slug = 'juridico_analise_inicial'
    AND NOT EXISTS (
      SELECT 1 FROM public.kanban_fase_checklist_itens x
      WHERE x.fase_id = f.id AND x.campo_slug = 'juridico_tipo_contrato_confirmado'
    );
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('596', 'funil_juridico_fundacao')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
