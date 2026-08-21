-- 489: Funil Divify — reestrutura fases operacionais.
-- UUID: 724aef36-37de-4454-bf6f-ec481693aeeb (KANBAN_IDS.MONI_CAPITAL)
-- Novas: Primeiro contato, Preenchimento da Oferta
-- Renomeia: Abertura da SPE e Imagens → SPE + Conta + Material Projeto
-- Desativa (ativo=false): Conta Bancária, Materiais do projeto, Informações obrigatórias
-- Bastões intactos: capital_recebimento, capital_concluido, capital_nao_elegivel

DO $$
DECLARE
  v_kanban_id uuid := '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban_id) THEN
    SELECT id INTO v_kanban_id
    FROM public.kanbans
    WHERE nome IN ('Funil Divify', 'Funil Moní Capital')
    ORDER BY CASE WHEN nome = 'Funil Divify' THEN 0 ELSE 1 END
    LIMIT 1;
  END IF;

  IF v_kanban_id IS NULL THEN
    RAISE EXCEPTION '[489] Kanban Funil Divify / Moní Capital não encontrado';
  END IF;

  RAISE NOTICE '[489] Funil Divify kanban_id=%', v_kanban_id;
END $$;

-- ─── Novas fases ─────────────────────────────────────────────────────────────
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
  false,
  true,
  NULL,
  '[]'::jsonb
FROM public.kanbans k
CROSS JOIN (
  VALUES
    ('Primeiro contato',       'capital_primeiro_contato',      2, 2),
    ('Preenchimento da Oferta', 'capital_preenchimento_oferta', 5, 2)
) AS f(nome, slug, ordem, sla_dias)
WHERE (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid
    OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fases kf
    WHERE kf.kanban_id = k.id AND kf.slug = f.slug
  );

-- ─── Desativar fases removidas do funil ──────────────────────────────────────
UPDATE public.kanban_fases kf
SET ativo = false
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid
    OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND kf.slug IN (
    'capital_abertura_conta',
    'capital_materiais_projeto',
    'capital_informacoes_obrigatorias'
  );

-- ─── Nomes, ordem e SLA das fases ativas ─────────────────────────────────────
UPDATE public.kanban_fases kf
SET
  nome = v.nome,
  ordem = v.ordem,
  sla_dias = v.sla_dias,
  sla_tipo = 'uteis',
  ativo = true
FROM public.kanbans k,
  (VALUES
    ('capital_recebimento',              'Recebimento',                   1, 1),
    ('capital_primeiro_contato',         'Primeiro contato',              2, 2),
    ('capital_abertura_spe',             'SPE + Conta + Material Projeto', 3, 5),
    ('capital_cadastro_plataforma',      'Cadastro na plataforma',        4, 2),
    ('capital_preenchimento_oferta',     'Preenchimento da Oferta',       5, 2),
    ('capital_formalizacao',             'Formalização / Contrato',       6, 2),
    ('capital_concluido',                'Oferta publicada',              7, NULL::integer),
    ('capital_nao_elegivel',             'Não elegível',                  8, NULL::integer)
  ) AS v(slug, nome, ordem, sla_dias)
WHERE kf.kanban_id = k.id
  AND (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid
    OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND kf.slug = v.slug;

-- ─── Instruções ──────────────────────────────────────────────────────────────
UPDATE public.kanban_fases kf
SET instrucoes = $instr$Primeiro contato com o emissor após triagem no Recebimento.
Alinhar expectativas, disponibilidade de documentos e cronograma do projeto.
Confirmar canal de comunicação e responsável pelo acompanhamento no lado do emissor.

Bastão → SPE + Conta + Material Projeto: contato realizado e emissor orientado.$instr$
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND kf.slug = 'capital_primeiro_contato';

UPDATE public.kanban_fases kf
SET instrucoes = $instr$Etapa consolidada: abertura da SPE, conta bancária e materiais do projeto.

1. SPE: emissor recebe documento orientativo; coletar CNPJ da SPE e imagens (logo, cabeçalho, carrossel).
2. Conta: abrir conta no nome da SPE (preferência digital/fintech); confirmar agência, conta e titularidade.
3. Materiais: Moní estrutura resumo, descrição, OnePager e demais itens; emissor aprova antes de avançar.

Documento orientativo SPE:
https://docs.google.com/document/d/1gcwz3EiDYyATKDcB112ey8J6Tih0ls4Yuag4NEGCENQ/edit?tab=t.0

Bastão → Cadastro na plataforma: CNPJ SPE, conta ativa e materiais aprovados.$instr$
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND kf.slug = 'capital_abertura_spe';

UPDATE public.kanban_fases kf
SET instrucoes = $instr$Emissor acessa: https://monicapital.divify.com.br/

Cria conta com o tipo investidor (não emissor — ajuste feito manualmente pela Moní).
Após criação, Moní converte internamente o perfil para emissor da oferta.
Confirmar e-mail de cadastro com o emissor antes de qualquer ajuste.

Bastão → Preenchimento da Oferta: perfil de emissor ativo na plataforma.$instr$
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND kf.slug = 'capital_cadastro_plataforma';

UPDATE public.kanban_fases kf
SET instrucoes = $instr$Emissor preenche os dados definitivos da oferta na plataforma Divify.
Valor-alvo e valor mínimo devem ser múltiplos exatos de R$ 10.
Limite máximo: 50 investidores por oferta.
CNPJ da SPE deve coincidir com o emitido na fase SPE + Conta + Material Projeto.

Bastão → Formalização: todos os campos obrigatórios preenchidos.$instr$
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND kf.slug = 'capital_preenchimento_oferta';

UPDATE public.kanban_fases kf
SET instrucoes = $instr$Moní prepara o contrato com base nos dados do Preenchimento da Oferta e materiais aprovados.
Emissor assina o contrato (digital ou físico).
Taxa de publicação: R$ 2.500 (pagamento obrigatório).
Após assinatura + pagamento confirmados, a oferta é agendada para publicação.
Agendamento mínimo: 1 hora após confirmação.

Bastão → Oferta publicada: contrato assinado + pagamento confirmado.$instr$
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND kf.slug = 'capital_formalizacao';

-- ─── Checklist — Primeiro contato ────────────────────────────────────────────
INSERT INTO public.kanban_fase_checklist_itens (
  fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json, placeholder
)
SELECT f.id, i.ordem, i.label, i.tipo, i.obrigatorio, false, i.campo_slug, i.config_json::jsonb, i.placeholder
FROM public.kanban_fases f
INNER JOIN public.kanbans k ON k.id = f.kanban_id
CROSS JOIN (
  VALUES
    (1, 'Data do primeiro contato', 'data', true, 'capital_data_primeiro_contato', '{}', NULL),
    (2, 'Contato realizado com o emissor', 'checkbox', true, 'capital_contato_realizado', '{}', NULL),
    (3, 'Observações do contato', 'texto_longo', false, 'capital_obs_primeiro_contato', '{}', NULL)
) AS i(ordem, label, tipo, obrigatorio, campo_slug, config_json, placeholder)
WHERE (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND f.slug = 'capital_primeiro_contato'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens x
    WHERE x.fase_id = f.id AND x.campo_slug = i.campo_slug
  );

-- ─── Checklist — SPE + Conta + Material (conta + materiais herdados) ─────────
INSERT INTO public.kanban_fase_checklist_itens (
  fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json, placeholder
)
SELECT f.id, i.ordem, i.label, i.tipo, i.obrigatorio, false, i.campo_slug, i.config_json::jsonb, i.placeholder
FROM public.kanban_fases f
INNER JOIN public.kanbans k ON k.id = f.kanban_id
CROSS JOIN (
  VALUES
    (7,  'Banco / Fintech escolhida', 'texto_curto', true, 'capital_banco_escolhido', '{}', 'Ex.: Cora, Stone, Inter…'),
    (8,  'Agência', 'texto_curto', true, 'capital_agencia', '{}', NULL),
    (9,  'Número da conta', 'texto_curto', true, 'capital_numero_conta', '{}', NULL),
    (10, 'Confirmação de abertura da conta', 'checkbox', true, 'capital_conta_aberta', '{}', NULL),
    (11, 'Resumo da oferta', 'texto_curto', true, 'capital_resumo_oferta', '{}', NULL),
    (12, 'Descrição da oferta', 'texto_longo', true, 'capital_descricao_oferta', '{}', NULL),
    (13, 'Equipe', 'texto_longo', false, 'capital_equipe', '{}', NULL),
    (14, 'FAQ', 'texto_longo', false, 'capital_faq', '{}', NULL),
    (15, 'OnePager', 'anexo', true, 'capital_onepager', '{}', NULL),
    (16, 'Materiais aprovados', 'checkbox', true, 'capital_materiais_aprovados', '{}', NULL)
) AS i(ordem, label, tipo, obrigatorio, campo_slug, config_json, placeholder)
WHERE (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND f.slug = 'capital_abertura_spe'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens x
    WHERE x.fase_id = f.id AND x.campo_slug = i.campo_slug
  );

-- ─── Checklist — Preenchimento da Oferta (herda Informações obrigatórias) ────
INSERT INTO public.kanban_fase_checklist_itens (
  fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json, placeholder
)
SELECT f.id, i.ordem, i.label, i.tipo, i.obrigatorio, false, i.campo_slug, i.config_json::jsonb, i.placeholder
FROM public.kanban_fases f
INNER JOIN public.kanbans k ON k.id = f.kanban_id
CROSS JOIN (
  VALUES
    (1, 'Nome da oferta', 'texto_curto', true, 'capital_nome_oferta', '{}', NULL),
    (2, 'CNPJ da SPE', 'cnpj', true, 'capital_cnpj_spe_oferta', '{}', NULL),
    (3, 'Valor-alvo de captação (R$) — múltiplo de R$ 10', 'numero', true, 'capital_valor_alvo',
     '{"multiplo_de":10}', 'Múltiplo de 10'),
    (4, 'Valor mínimo de investimento (R$) — múltiplo de R$ 10', 'numero', true, 'capital_valor_minimo',
     '{"multiplo_de":10}', 'Múltiplo de 10'),
    (5, 'Número máximo de investidores (máx. 50)', 'numero', true, 'capital_max_investidores',
     '{"max":50}', 'Máximo 50')
) AS i(ordem, label, tipo, obrigatorio, campo_slug, config_json, placeholder)
WHERE (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND f.slug = 'capital_preenchimento_oferta'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens x
    WHERE x.fase_id = f.id AND x.campo_slug = i.campo_slug
  );

-- ─── Responsável da fase (oculto) — fases novas ──────────────────────────────
INSERT INTO public.kanban_fase_checklist_itens (
  fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
)
SELECT
  f.id, i.ordem, i.label, i.tipo, false, false, i.campo_slug, i.config_json::jsonb
FROM public.kanban_fases f
INNER JOIN public.kanbans k ON k.id = f.kanban_id
CROSS JOIN (
  VALUES
    (-2, 'Responsável da fase — tipo', 'select', 'responsavel_da_fase_tipo',
     '{"oculto_ui": true, "opcoes": ["Franqueado", "Moní"]}'),
    (-1, 'Responsável da fase — usuário Moní', 'usuario', 'responsavel_da_fase_usuario',
     '{"oculto_ui": true}')
) AS i(ordem, label, tipo, campo_slug, config_json)
WHERE (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND f.slug IN ('capital_primeiro_contato', 'capital_preenchimento_oferta')
  AND COALESCE(f.ativo, true) = true
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens x
    WHERE x.fase_id = f.id AND x.campo_slug = i.campo_slug
  );

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('489', 'funil_divify_reestrutura_fases')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
