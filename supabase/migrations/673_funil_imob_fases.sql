-- 673: Funil IMOB — esteira de fases.
-- Mantém Novo Loteador (não é fase de conclusão) e acrescenta as fases seguintes.
-- Não move cards. Idempotente.

DO $$
DECLARE
  v_imob uuid := 'f3a8c1d4-6b20-4e91-8d47-2c5e9a1b7f03'::uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_imob) THEN
    SELECT id INTO v_imob
    FROM public.kanbans
    WHERE nome = 'Funil IMOB'
    LIMIT 1;
  END IF;

  IF v_imob IS NULL THEN
    RAISE NOTICE '673: Funil IMOB não encontrado — pulando.';
    RETURN;
  END IF;

  UPDATE public.kanbans
  SET
    descricao = 'IMOB — Novo Loteador até Operação. Novo Loteador não é fase de conclusão.',
    ativo = true
  WHERE id = v_imob;

  INSERT INTO public.kanban_fases (
    kanban_id, nome, slug, ordem, sla_dias, sla_tipo, fase_conversao, ativo, materiais
  )
  SELECT
    v_imob,
    m.nome,
    m.slug,
    m.ordem,
    1,
    'uteis',
    false,
    true,
    '[]'::jsonb
  FROM (
    VALUES
      (1,  'Novo Loteador',                  'imob_novo_loteador'),
      (2,  'Passagem',                       'imob_passagem'),
      (3,  'Reunião inicial e diagnóstico',  'imob_reuniao_inicial_diagnostico'),
      (4,  'Definição de produto',           'imob_definicao_produto'),
      (5,  'Arquitetura e orçamento',        'imob_arquitetura_orcamento'),
      (6,  'Preço e pagamento',              'imob_preco_pagamento'),
      (7,  'Materiais',                      'imob_materiais'),
      (8,  'Treinamento dos corretores',     'imob_treinamento_corretores'),
      (9,  'Ativação da base',               'imob_ativacao_base'),
      (10, 'Operação',                       'imob_operacao')
  ) AS m(ordem, nome, slug)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases f
    WHERE f.kanban_id = v_imob
      AND f.slug = m.slug
  );

  UPDATE public.kanban_fases f
  SET
    nome = m.nome,
    ordem = m.ordem,
    ativo = true,
    fase_conversao = false
  FROM (
    VALUES
      (1,  'Novo Loteador',                  'imob_novo_loteador'),
      (2,  'Passagem',                       'imob_passagem'),
      (3,  'Reunião inicial e diagnóstico',  'imob_reuniao_inicial_diagnostico'),
      (4,  'Definição de produto',           'imob_definicao_produto'),
      (5,  'Arquitetura e orçamento',        'imob_arquitetura_orcamento'),
      (6,  'Preço e pagamento',              'imob_preco_pagamento'),
      (7,  'Materiais',                      'imob_materiais'),
      (8,  'Treinamento dos corretores',     'imob_treinamento_corretores'),
      (9,  'Ativação da base',               'imob_ativacao_base'),
      (10, 'Operação',                       'imob_operacao')
  ) AS m(ordem, nome, slug)
  WHERE f.kanban_id = v_imob
    AND f.slug = m.slug;

  INSERT INTO public.kanban_fase_checklist_itens (
    fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
  )
  SELECT
    f.id,
    0,
    'Responsável do card',
    'usuario',
    false,
    false,
    'responsavel_fase',
    '{"oculto_ui": true}'::jsonb
  FROM public.kanban_fases f
  WHERE f.kanban_id = v_imob
    AND f.slug IN (
      'imob_passagem',
      'imob_reuniao_inicial_diagnostico',
      'imob_definicao_produto',
      'imob_arquitetura_orcamento',
      'imob_preco_pagamento',
      'imob_materiais',
      'imob_treinamento_corretores',
      'imob_ativacao_base',
      'imob_operacao'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.kanban_fase_checklist_itens i
      WHERE i.fase_id = f.id
        AND i.campo_slug = 'responsavel_fase'
    );

  INSERT INTO public.kanban_fase_checklist_itens (
    fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
  )
  SELECT
    f.id,
    -2,
    'Responsável da fase',
    'select',
    false,
    false,
    'responsavel_da_fase',
    '{"oculto_ui": true, "opcoes": ["Franqueado", "Loteador", "Moní"]}'::jsonb
  FROM public.kanban_fases f
  WHERE f.kanban_id = v_imob
    AND f.slug IN (
      'imob_passagem',
      'imob_reuniao_inicial_diagnostico',
      'imob_definicao_produto',
      'imob_arquitetura_orcamento',
      'imob_preco_pagamento',
      'imob_materiais',
      'imob_treinamento_corretores',
      'imob_ativacao_base',
      'imob_operacao'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.kanban_fase_checklist_itens i
      WHERE i.fase_id = f.id
        AND i.campo_slug = 'responsavel_da_fase'
    );
END $$;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('673', 'funil_imob_fases')
ON CONFLICT (version) DO NOTHING;
