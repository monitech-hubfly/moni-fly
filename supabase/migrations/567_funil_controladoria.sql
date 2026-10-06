-- 567: Funil Controladoria — Rotina Contábil (6 fases) + Rotina Fiscal (3 fases).
-- Idempotente. UUIDs fixos para alinhamento com kanban-ids.ts.
-- Não adiciona colunas em kanban_cards (cards nativos, título livre).
-- RLS: herda políticas existentes de kanban_cards / kanban_fases.

-- ─── Garante cor_hex em kanbans ──────────────────────────────────────────────
ALTER TABLE public.kanbans
  ADD COLUMN IF NOT EXISTS cor_hex text;

-- ─── Kanban 1: Rotina Contábil ────────────────────────────────────────────────
INSERT INTO public.kanbans (id, nome, descricao, ativo, cor_hex)
SELECT
  'c7ada001-0000-0000-0000-000000000001'::uuid,
  'Funil Controladoria — Rotina Contábil',
  'Rotina mensal contábil por CNPJ/empresa. Cards gerados no 1º dia útil de cada mês.',
  true,
  '#2d3d4a'
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanbans
  WHERE id = 'c7ada001-0000-0000-0000-000000000001'::uuid
     OR nome = 'Funil Controladoria — Rotina Contábil'
);

UPDATE public.kanbans
SET descricao = 'Rotina mensal contábil por CNPJ/empresa. Cards gerados no 1º dia útil de cada mês.',
    ativo = true,
    cor_hex = COALESCE(cor_hex, '#2d3d4a')
WHERE id = 'c7ada001-0000-0000-0000-000000000001'::uuid
   OR nome = 'Funil Controladoria — Rotina Contábil';

-- Fases Rotina Contábil (6 etapas)
INSERT INTO public.kanban_fases (
  kanban_id, nome, slug, ordem, sla_dias, sla_tipo, fase_conversao, ativo, instrucoes, materiais
)
SELECT
  k.id,
  f.nome,
  f.slug,
  f.ordem,
  f.sla_dias,
  'uteis',
  f.fase_conversao,
  true,
  f.instrucoes,
  '[]'::jsonb
FROM public.kanbans k
CROSS JOIN (
  VALUES
    (
      'Enviar Docs para Contabilidade',
      'ctrl_c_enviar_docs',
      1,
      5,
      false,
      'Reunir e enviar ao escritório contábil todos os documentos do período: extratos, notas, recibos, contratos. Prazo: 5 dias úteis.'
    ),
    (
      'Devolutiva de Docs',
      'ctrl_c_devolutiva',
      2,
      3,
      false,
      'Aguardar retorno do escritório externo com os documentos analisados / processados. SLA Externo — depende de prazo do parceiro.'
    ),
    (
      'Análise dos Documentos',
      'ctrl_c_analise',
      3,
      3,
      false,
      'Analisar internamente os documentos devolvidos. Verificar consistência com os lançamentos do período.'
    ),
    (
      'Criação e Atualização Demonstrativos',
      'ctrl_c_demonstrativos',
      4,
      2,
      false,
      'Criar ou atualizar os demonstrativos financeiros (DRE, Balanço Patrimonial, Fluxo de Caixa) do CNPJ referente ao mês.'
    ),
    (
      'Atualizar Plan e Apres',
      'ctrl_c_atualizar_plan',
      5,
      1,
      false,
      'Atualizar planilha de controle e apresentação mensal com os dados finais. Enviar para revisão antes de concluir.'
    ),
    (
      'Concluído',
      'ctrl_c_concluido',
      6,
      NULL::integer,
      true,
      'Rotina contábil do mês encerrada. Card é registro histórico.'
    )
) AS f(nome, slug, ordem, sla_dias, fase_conversao, instrucoes)
WHERE (k.id = 'c7ada001-0000-0000-0000-000000000001'::uuid OR k.nome = 'Funil Controladoria — Rotina Contábil')
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fases kf
    WHERE kf.kanban_id = k.id AND kf.slug = f.slug
  );

UPDATE public.kanban_fases kf
SET
  nome = v.nome,
  ordem = v.ordem,
  sla_dias = v.sla_dias,
  sla_tipo = 'uteis',
  fase_conversao = v.fase_conversao,
  ativo = true,
  instrucoes = v.instrucoes
FROM public.kanbans k,
  (VALUES
    ('ctrl_c_enviar_docs',      'Enviar Docs para Contabilidade',               1, 5,           false, 'Reunir e enviar ao escritório contábil todos os documentos do período: extratos, notas, recibos, contratos. Prazo: 5 dias úteis.'),
    ('ctrl_c_devolutiva',       'Devolutiva de Docs',                           2, 3,           false, 'Aguardar retorno do escritório externo com os documentos analisados / processados. SLA Externo — depende de prazo do parceiro.'),
    ('ctrl_c_analise',          'Análise dos Documentos',                       3, 3,           false, 'Analisar internamente os documentos devolvidos. Verificar consistência com os lançamentos do período.'),
    ('ctrl_c_demonstrativos',   'Criação e Atualização Demonstrativos',         4, 2,           false, 'Criar ou atualizar os demonstrativos financeiros (DRE, Balanço Patrimonial, Fluxo de Caixa) do CNPJ referente ao mês.'),
    ('ctrl_c_atualizar_plan',   'Atualizar Plan e Apres',                       5, 1,           false, 'Atualizar planilha de controle e apresentação mensal com os dados finais. Enviar para revisão antes de concluir.'),
    ('ctrl_c_concluido',        'Concluído',                                    6, NULL::integer, true, 'Rotina contábil do mês encerrada. Card é registro histórico.')
  ) AS v(slug, nome, ordem, sla_dias, fase_conversao, instrucoes)
WHERE kf.kanban_id = k.id
  AND (k.id = 'c7ada001-0000-0000-0000-000000000001'::uuid OR k.nome = 'Funil Controladoria — Rotina Contábil')
  AND kf.slug = v.slug;

-- Desativa fases legadas (idempotência)
UPDATE public.kanban_fases kf
SET ativo = false
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = 'c7ada001-0000-0000-0000-000000000001'::uuid OR k.nome = 'Funil Controladoria — Rotina Contábil')
  AND kf.slug NOT IN (
    'ctrl_c_enviar_docs', 'ctrl_c_devolutiva', 'ctrl_c_analise',
    'ctrl_c_demonstrativos', 'ctrl_c_atualizar_plan', 'ctrl_c_concluido'
  );

-- ─── Kanban 2: Rotina Fiscal ──────────────────────────────────────────────────
INSERT INTO public.kanbans (id, nome, descricao, ativo, cor_hex)
SELECT
  'c7ada002-0000-0000-0000-000000000002'::uuid,
  'Funil Controladoria — Rotina Fiscal',
  'Rotina mensal fiscal por funcionário e por obra. Cards gerados no 1º dia útil de cada mês.',
  true,
  '#2d3d4a'
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanbans
  WHERE id = 'c7ada002-0000-0000-0000-000000000002'::uuid
     OR nome = 'Funil Controladoria — Rotina Fiscal'
);

UPDATE public.kanbans
SET descricao = 'Rotina mensal fiscal por funcionário e por obra. Cards gerados no 1º dia útil de cada mês.',
    ativo = true,
    cor_hex = COALESCE(cor_hex, '#2d3d4a')
WHERE id = 'c7ada002-0000-0000-0000-000000000002'::uuid
   OR nome = 'Funil Controladoria — Rotina Fiscal';

-- Fases Rotina Fiscal (3 etapas)
INSERT INTO public.kanban_fases (
  kanban_id, nome, slug, ordem, sla_dias, sla_tipo, fase_conversao, ativo, instrucoes, materiais
)
SELECT
  k.id,
  f.nome,
  f.slug,
  f.ordem,
  f.sla_dias,
  'uteis',
  f.fase_conversao,
  true,
  f.instrucoes,
  '[]'::jsonb
FROM public.kanbans k
CROSS JOIN (
  VALUES
    (
      'Cobrança Fiscal',
      'ctrl_f_cobranca',
      1,
      NULL::integer,
      false,
      'Iniciar processo de cobrança fiscal. Levantar competências, tributos devidos, guias e documentação necessária.'
    ),
    (
      'Emissão Fiscal',
      'ctrl_f_emissao',
      2,
      30,
      false,
      'Emitir Nota Fiscal (NF) ou documentos tributários do período. Prazo máximo: 30 dias corridos da competência.'
    ),
    (
      'Salvar NFs / Concluir',
      'ctrl_f_concluir',
      3,
      NULL::integer,
      true,
      'Salvar NFs emitidas no repositório padrão. Confirmar conciliação. Rotina fiscal do mês encerrada.'
    )
) AS f(nome, slug, ordem, sla_dias, fase_conversao, instrucoes)
WHERE (k.id = 'c7ada002-0000-0000-0000-000000000002'::uuid OR k.nome = 'Funil Controladoria — Rotina Fiscal')
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fases kf
    WHERE kf.kanban_id = k.id AND kf.slug = f.slug
  );

UPDATE public.kanban_fases kf
SET
  nome = v.nome,
  ordem = v.ordem,
  sla_dias = v.sla_dias,
  sla_tipo = 'uteis',
  fase_conversao = v.fase_conversao,
  ativo = true,
  instrucoes = v.instrucoes
FROM public.kanbans k,
  (VALUES
    ('ctrl_f_cobranca', 'Cobrança Fiscal',      1, NULL::integer, false, 'Iniciar processo de cobrança fiscal. Levantar competências, tributos devidos, guias e documentação necessária.'),
    ('ctrl_f_emissao',  'Emissão Fiscal',        2, 30,           false, 'Emitir Nota Fiscal (NF) ou documentos tributários do período. Prazo máximo: 30 dias corridos da competência.'),
    ('ctrl_f_concluir', 'Salvar NFs / Concluir', 3, NULL::integer, true,  'Salvar NFs emitidas no repositório padrão. Confirmar conciliação. Rotina fiscal do mês encerrada.')
  ) AS v(slug, nome, ordem, sla_dias, fase_conversao, instrucoes)
WHERE kf.kanban_id = k.id
  AND (k.id = 'c7ada002-0000-0000-0000-000000000002'::uuid OR k.nome = 'Funil Controladoria — Rotina Fiscal')
  AND kf.slug = v.slug;

-- Desativa fases legadas
UPDATE public.kanban_fases kf
SET ativo = false
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = 'c7ada002-0000-0000-0000-000000000002'::uuid OR k.nome = 'Funil Controladoria — Rotina Fiscal')
  AND kf.slug NOT IN ('ctrl_f_cobranca', 'ctrl_f_emissao', 'ctrl_f_concluir');

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('567', 'funil_controladoria')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
