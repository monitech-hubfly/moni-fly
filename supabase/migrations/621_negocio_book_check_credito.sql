-- 621: Book do empreendimento e Check Análise de Crédito em Dados do Negócio.
-- Espelhados na lateral (processo_step_one) e nas fases indicadas.
-- Obrigatórios só em Aprovação no Condomínio (Pré Obra e Obra).
-- Idempotente. Não move cards.

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS book_empreendimento text,
  ADD COLUMN IF NOT EXISTS check_analise_credito text;

COMMENT ON COLUMN public.processo_step_one.book_empreendimento IS
  'Link do book do empreendimento. Espelhado no checklist via negocio:book_empreendimento.';

COMMENT ON COLUMN public.processo_step_one.check_analise_credito IS
  'Check Análise de Crédito: true ou false. Espelhado no checklist via negocio:check_analise_credito.';

DO $$
DECLARE
  v_portfolio uuid := 'c57120a0-991c-422b-8def-4d16a9411d45';
  v_operacoes uuid := 'f6bba1de-a7a1-4b14-89d1-10c2f7bba636';
BEGIN
  CREATE TEMP TABLE _neg_book (
    kanban_id uuid,
    fase_slug text,
    campo_slug text,
    label text,
    tipo text,
    obrigatorio boolean,
    ordem int
  ) ON COMMIT DROP;

  INSERT INTO _neg_book (kanban_id, fase_slug, campo_slug, label, tipo, obrigatorio, ordem)
  VALUES
    (v_portfolio, 'cto_precedentes_assinado', 'book_empreendimento', 'Book do empreendimento', 'url', false, 90),
    (v_portfolio, 'contrato_s_precedentes_assinado', 'book_empreendimento', 'Book do empreendimento', 'url', false, 90),
    (v_operacoes, 'aprovacao_condominio', 'book_empreendimento', 'Book do empreendimento', 'url', true, 90),
    (v_portfolio, 'cto_precedentes_assinado', 'check_analise_credito', 'Check Análise de Crédito', 'checkbox', false, 91),
    (v_portfolio, 'contrato_s_precedentes_assinado', 'check_analise_credito', 'Check Análise de Crédito', 'checkbox', false, 91),
    (v_operacoes, 'projeto_legal', 'check_analise_credito', 'Check Análise de Crédito', 'checkbox', false, 91),
    (v_operacoes, 'aprovacao_condominio', 'check_analise_credito', 'Check Análise de Crédito', 'checkbox', true, 91);

  UPDATE public.kanban_fase_checklist_itens i
  SET label = n.label,
      tipo = n.tipo,
      obrigatorio = n.obrigatorio,
      ordem = n.ordem,
      visivel_candidato = false,
      config_json = '{}'::jsonb,
      chave_compartilhada = 'negocio:' || n.campo_slug
  FROM _neg_book n
  JOIN public.kanban_fases kf
    ON kf.kanban_id = n.kanban_id
   AND kf.slug = n.fase_slug
  WHERE i.fase_id = kf.id
    AND i.campo_slug = n.campo_slug;

  INSERT INTO public.kanban_fase_checklist_itens (
    fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json, chave_compartilhada
  )
  SELECT kf.id, n.ordem, n.label, n.tipo, n.obrigatorio, false, n.campo_slug, '{}'::jsonb,
         'negocio:' || n.campo_slug
  FROM _neg_book n
  JOIN public.kanban_fases kf
    ON kf.kanban_id = n.kanban_id
   AND kf.slug = n.fase_slug
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = kf.id
      AND i.campo_slug = n.campo_slug
  );
END $$;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('621', 'negocio_book_check_credito')
ON CONFLICT (version) DO NOTHING;
