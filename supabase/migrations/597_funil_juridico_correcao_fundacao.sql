-- 597: correção da fundação do Funil Jurídico (596 já aplicada no DEV).
-- Não altera fases. Não apaga respostas de checklist.
-- Idempotente. Não converter showroom: se existir, a migration para.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.kanban_cards
    WHERE juridico_tipo_contrato = 'showroom'
  ) THEN
    RAISE EXCEPTION
      '597: existe kanban_cards.juridico_tipo_contrato = showroom. Constraint não alterada.';
  END IF;
END $$;

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
      'parceria',
      'franquia',
      'cof',
      'aditivo',
      'documento_padrao',
      'demais'
    )
  );

COMMENT ON COLUMN public.kanban_cards.juridico_tipo_contrato IS
  'Funil Jurídico — tipo documental: opcao | cto_com_precedentes | cto_sem_precedentes | nda | parceria | franquia | cof | aditivo | documento_padrao | demais.';

COMMENT ON COLUMN public.kanban_cards.juridico_origem IS
  'Classificação macro quando já conhecida: portfolio | loteadores | comercial. comercial é reserva do Comercial (COF / Cto de Franquia) e não identifica Pré Obra e Obra. A origem real do card pai está em origem_kanban_id / origem_kanban_nome.';

-- Tira da fase Análise Inicial os quatro itens criados na 596.
-- Resposta existente impede o delete (FK é ON DELETE CASCADE).
UPDATE public.kanban_fase_checklist_itens i
SET
  obrigatorio = false,
  config_json = COALESCE(i.config_json, '{}'::jsonb) || '{"oculto_ui": true}'::jsonb
FROM public.kanban_fases f
WHERE i.fase_id = f.id
  AND f.kanban_id = '35fb5c8d-50c0-4999-bc16-89d53c2e758f'::uuid
  AND f.slug = 'juridico_analise_inicial'
  AND i.campo_slug IN (
    'juridico_documento_correto',
    'juridico_partes_identificadas',
    'juridico_minuta_identificada',
    'juridico_tipo_contrato_confirmado'
  )
  AND EXISTS (
    SELECT 1
    FROM public.kanban_fase_checklist_respostas r
    WHERE r.item_id = i.id
  );

DELETE FROM public.kanban_fase_checklist_itens i
USING public.kanban_fases f
WHERE i.fase_id = f.id
  AND f.kanban_id = '35fb5c8d-50c0-4999-bc16-89d53c2e758f'::uuid
  AND f.slug = 'juridico_analise_inicial'
  AND i.campo_slug IN (
    'juridico_documento_correto',
    'juridico_partes_identificadas',
    'juridico_minuta_identificada',
    'juridico_tipo_contrato_confirmado'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_fase_checklist_respostas r
    WHERE r.item_id = i.id
  );

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('597', 'funil_juridico_correcao_fundacao')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
