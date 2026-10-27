-- 671: Funil IMOB — fase Novo Loteador.
-- Checklist copiado da fase Novo Loteador / Entrar em contato do Funil Loteadores.
-- Não cria vínculo entre os funis. Não move cards. Idempotente.

DO $$
DECLARE
  v_imob uuid := 'f3a8c1d4-6b20-4e91-8d47-2c5e9a1b7f03'::uuid;
  v_loteadores uuid := '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid;
  v_fase_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_loteadores) THEN
    SELECT id INTO v_loteadores
    FROM public.kanbans
    WHERE nome IN ('Funil Loteadores', 'Funil Moní INC')
    ORDER BY CASE WHEN nome = 'Funil Loteadores' THEN 0 ELSE 1 END
    LIMIT 1;
  END IF;

  INSERT INTO public.kanbans (id, nome, descricao, ativo)
  SELECT
    v_imob,
    'Funil IMOB',
    'IMOB — Novo Loteador. Campos espelhados do Funil Loteadores, sem vínculo com ele.',
    true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanbans k
    WHERE k.id = v_imob OR k.nome = 'Funil IMOB'
  );

  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_imob) THEN
    SELECT id INTO v_imob
    FROM public.kanbans
    WHERE nome = 'Funil IMOB'
    LIMIT 1;
  END IF;

  IF v_imob IS NULL THEN
    RAISE NOTICE '671: Funil IMOB não encontrado — pulando.';
    RETURN;
  END IF;

  INSERT INTO public.kanban_fases (
    kanban_id, nome, slug, ordem, sla_dias, sla_tipo, fase_conversao, ativo, instrucoes, materiais
  )
  SELECT
    v_imob,
    'Novo Loteador',
    'imob_novo_loteador',
    1,
    COALESCE(src.sla_dias, 1),
    COALESCE(src.sla_tipo, 'uteis'),
    false,
    true,
    src.instrucoes,
    COALESCE(src.materiais, '[]'::jsonb)
  FROM (SELECT 1) AS seed
  LEFT JOIN public.kanban_fases src
    ON src.kanban_id = v_loteadores
   AND src.slug = 'primeiro_contato_moni_inc'
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases f
    WHERE f.kanban_id = v_imob
      AND f.slug = 'imob_novo_loteador'
  );

  UPDATE public.kanban_fases f
  SET
    nome = 'Novo Loteador',
    ordem = 1,
    ativo = true,
    sla_dias = COALESCE(src.sla_dias, f.sla_dias, 1),
    sla_tipo = COALESCE(src.sla_tipo, f.sla_tipo, 'uteis'),
    instrucoes = COALESCE(src.instrucoes, f.instrucoes),
    materiais = COALESCE(src.materiais, f.materiais, '[]'::jsonb)
  FROM public.kanban_fases src
  WHERE src.kanban_id = v_loteadores
    AND src.slug = 'primeiro_contato_moni_inc'
    AND f.kanban_id = v_imob
    AND f.slug = 'imob_novo_loteador';

  UPDATE public.kanban_fases
  SET nome = 'Novo Loteador', ordem = 1, ativo = true
  WHERE kanban_id = v_imob
    AND slug = 'imob_novo_loteador';

  SELECT id INTO v_fase_id
  FROM public.kanban_fases
  WHERE kanban_id = v_imob
    AND slug = 'imob_novo_loteador'
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '671: fase Novo Loteador não criada — pulando checklist.';
    RETURN;
  END IF;

  INSERT INTO public.kanban_fase_checklist_itens (
    fase_id, ordem, label, tipo, obrigatorio, visivel_candidato,
    template_storage_path, placeholder, campo_slug, config_json,
    chave_compartilhada, grupo_exclusivo
  )
  SELECT
    v_fase_id,
    i.ordem,
    i.label,
    i.tipo,
    i.obrigatorio,
    i.visivel_candidato,
    i.template_storage_path,
    i.placeholder,
    i.campo_slug,
    COALESCE(i.config_json, '{}'::jsonb),
    i.chave_compartilhada,
    i.grupo_exclusivo
  FROM public.kanban_fases src
  JOIN public.kanban_fase_checklist_itens i ON i.fase_id = src.id
  WHERE src.kanban_id = v_loteadores
    AND src.slug = 'primeiro_contato_moni_inc'
    AND NOT EXISTS (
      SELECT 1
      FROM public.kanban_fase_checklist_itens d
      WHERE d.fase_id = v_fase_id
        AND d.label = i.label
        AND d.ordem = i.ordem
        AND d.campo_slug IS NOT DISTINCT FROM i.campo_slug
    );

  INSERT INTO public.kanban_fase_checklist_itens (
    fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
  )
  SELECT v_fase_id, 0, 'Responsável do card', 'usuario', false, false, 'responsavel_fase', '{"oculto_ui": true}'::jsonb
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = v_fase_id
      AND i.campo_slug = 'responsavel_fase'
  );

  INSERT INTO public.kanban_fase_checklist_itens (
    fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
  )
  SELECT
    v_fase_id,
    -2,
    'Responsável da fase',
    'select',
    false,
    false,
    'responsavel_da_fase',
    '{"oculto_ui": true, "opcoes": ["Franqueado", "Loteador", "Moní"]}'::jsonb
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = v_fase_id
      AND i.campo_slug = 'responsavel_da_fase'
  );
END $$;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('671', 'funil_imob')
ON CONFLICT (version) DO NOTHING;
