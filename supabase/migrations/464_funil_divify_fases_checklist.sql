-- 464: Funil Divify — alinhar 9 fases (Recebimento + 7 operacionais + Não elegível),
-- SLAs em dias úteis, instruções e checklist de negócio por fase.
-- UUID: 724aef36-37de-4454-bf6f-ec481693aeeb (KANBAN_IDS.MONI_CAPITAL)

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
    RAISE EXCEPTION '[464] Kanban Funil Divify / Moní Capital não encontrado';
  END IF;

  -- Garantir nome canônico
  UPDATE public.kanbans
  SET nome = 'Funil Divify',
      descricao = COALESCE(NULLIF(trim(descricao), ''), 'Captação privada via plataforma Divify — Moní Capital'),
      ativo = true
  WHERE id = v_kanban_id;

  RAISE NOTICE '[464] Funil Divify kanban_id=%', v_kanban_id;
END $$;

-- ─── Nova fase: Abertura de Conta Bancária ───────────────────────────────────
INSERT INTO public.kanban_fases (
  kanban_id, nome, slug, ordem, sla_dias, sla_tipo, fase_conversao, ativo, instrucoes, materiais
)
SELECT
  k.id,
  'Abertura de Conta Bancária da SPE (digital)',
  'capital_abertura_conta',
  3,
  3,
  'uteis',
  false,
  true,
  NULL,
  '[]'::jsonb
FROM public.kanbans k
WHERE (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid
    OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fases kf
    WHERE kf.kanban_id = k.id AND kf.slug = 'capital_abertura_conta'
  );

-- ─── Nome, ordem, SLA (9 fases) ──────────────────────────────────────────────
UPDATE public.kanban_fases kf
SET
  nome = v.nome,
  ordem = v.ordem,
  sla_dias = v.sla_dias,
  sla_tipo = 'uteis',
  ativo = true
FROM public.kanbans k,
  (VALUES
    ('capital_recebimento',              'Recebimento',                                           1, 1),
    ('capital_abertura_spe',             'Abertura da SPE e Imagens',                             2, 3),
    ('capital_abertura_conta',           'Abertura de Conta Bancária da SPE (digital)',            3, 3),
    ('capital_cadastro_plataforma',      'Cadastro na plataforma',                                4, 2),
    ('capital_materiais_projeto',        'Materiais do projeto',                                  5, 2),
    ('capital_informacoes_obrigatorias', 'Informações obrigatórias para subir a oferta',          6, 2),
    ('capital_formalizacao',             'Formalização / Contrato',                               7, 2),
    ('capital_concluido',                'Oferta publicada',                                      8, NULL::integer),
    ('capital_nao_elegivel',             'Não elegível',                                          9, NULL::integer)
  ) AS v(slug, nome, ordem, sla_dias)
WHERE kf.kanban_id = k.id
  AND (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid
    OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND kf.slug = v.slug;

-- ─── Instruções por fase ─────────────────────────────────────────────────────
UPDATE public.kanban_fases kf
SET instrucoes = $instr$Card recebido da esteira Portfólio (Captação Moní Capital / Divify). Confira elegibilidade e encaminhe para Abertura da SPE e Imagens quando o emissor estiver pronto. Se o projeto não for elegível, mova para Não elegível.$instr$
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND kf.slug = 'capital_recebimento';

UPDATE public.kanban_fases kf
SET instrucoes = $instr$Primeiro passo obrigatório do fluxo operacional; sem CNPJ da SPE nada avança.

O emissor recebe um documento orientativo com o passo a passo da abertura.
Junto com a SPE, já coletar as imagens: logo, cabeçalho e carrossel.
Prazo estimado pelo cartório/junta comercial: até 3 dias úteis.
O time Moní acompanha a finalização a partir da data combinada.

Documento orientativo:
https://docs.google.com/document/d/1gcwz3EiDYyATKDcB112ey8J6Tih0ls4Yuag4NEGCENQ/edit?tab=t.0

Bastão → Conta bancária: CNPJ da SPE emitido.$instr$
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND kf.slug = 'capital_abertura_spe';

UPDATE public.kanban_fases kf
SET instrucoes = $instr$A conta deve ser aberta no nome da SPE (CNPJ da fase anterior).
Preferência por conta digital (fintech) para agilidade.
Confirmar agência, conta e titularidade antes de avançar.
Prazo: até 3 dias úteis.

Bastão → Cadastro na plataforma: conta bancária ativa.$instr$
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND kf.slug = 'capital_abertura_conta';

UPDATE public.kanban_fases kf
SET instrucoes = $instr$Emissor acessa: https://monicapital.divify.com.br/

Cria conta com o tipo investidor (não emissor — o ajuste é feito manualmente pela Moní).
Após criação, a Moní ajusta internamente o perfil para emissor da oferta.
Confirmar e-mail de cadastro com o emissor antes de qualquer ajuste.

Bastão → Materiais: perfil de emissor ativo na plataforma.$instr$
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND kf.slug = 'capital_cadastro_plataforma';

UPDATE public.kanban_fases kf
SET instrucoes = $instr$A Moní é responsável por estruturar todos os materiais que o investidor visualizará na oferta.

Itens obrigatórios: resumo, descrição, logo, cabeçalho, carrossel, OnePager.
Itens opcionais: equipe, FAQ.
O acoplamento do projeto pode ser iniciado em paralelo com fases anteriores (exceção ao fluxo estrito).
Materiais precisam de aprovação do emissor antes de avançar.

Bastão → Formalização: materiais aprovados + dados da fase Informações preenchidos.$instr$
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND kf.slug = 'capital_materiais_projeto';

UPDATE public.kanban_fases kf
SET instrucoes = $instr$Emissor fornece os dados definitivos da oferta:
• Nome da oferta
• CNPJ da SPE (deve coincidir com o emitido na Abertura da SPE)
• Valor-alvo de captação (múltiplo exato de R$ 10)
• Valor mínimo de investimento (múltiplo exato de R$ 10)
• Número máximo de investidores (máximo 50 por oferta)

Bastão → Formalização: todos os campos obrigatórios preenchidos.$instr$
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND kf.slug = 'capital_informacoes_obrigatorias';

UPDATE public.kanban_fases kf
SET instrucoes = $instr$A Moní prepara o contrato com base nos dados das fases Materiais e Informações.
Emissor assina o contrato (digital ou físico).
Taxa de publicação: R$ 2.500 (pagamento obrigatório).
Após assinatura + pagamento confirmados, a oferta é agendada para publicação.
Agendamento mínimo: 1 hora após a confirmação.

Bastão → Oferta publicada: contrato assinado + pagamento confirmado.$instr$
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND kf.slug = 'capital_formalizacao';

UPDATE public.kanban_fases kf
SET instrucoes = $instr$Fase de conclusão do funil. Registrar data de publicação, URL da oferta e confirmação de que o agendamento mínimo de 1h foi respeitado.
Não há SLA — é resultado das fases anteriores.
Acompanhe a captação e indique investidores qualificados (CPFs cadastrados na plataforma).$instr$
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND kf.slug = 'capital_concluido';

UPDATE public.kanban_fases kf
SET instrucoes = $instr$Projeto não elegível para captação via Divify / Moní Capital. Registre o motivo e comunique o emissor.$instr$
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND kf.slug = 'capital_nao_elegivel';

-- ─── Checklist — Abertura da SPE e Imagens ───────────────────────────────────
INSERT INTO public.kanban_fase_checklist_itens (
  fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json, placeholder
)
SELECT f.id, i.ordem, i.label, i.tipo, i.obrigatorio, false, i.campo_slug, i.config_json::jsonb, i.placeholder
FROM public.kanban_fases f
INNER JOIN public.kanbans k ON k.id = f.kanban_id
CROSS JOIN (
  VALUES
    (1, 'Nome da SPE', 'texto_curto', true, 'capital_nome_spe', '{}', NULL),
    (2, 'CNPJ da SPE', 'cnpj', true, 'capital_cnpj_spe', '{}', NULL),
    (3, 'Logo da empresa', 'anexo', true, 'capital_logo', '{}', NULL),
    (4, 'Cabeçalho / Banner', 'anexo', true, 'capital_cabecalho', '{}', NULL),
    (5, 'Carrossel de imagens', 'anexo_multiplo', true, 'capital_carrossel', '{}', NULL),
    (6, 'Documento orientativo recebido', 'checkbox', true, 'capital_documento_orientativo', '{}', NULL)
) AS i(ordem, label, tipo, obrigatorio, campo_slug, config_json, placeholder)
WHERE (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND f.slug = 'capital_abertura_spe'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens x
    WHERE x.fase_id = f.id AND x.campo_slug = i.campo_slug
  );

-- ─── Checklist — Abertura de Conta Bancária ──────────────────────────────────
INSERT INTO public.kanban_fase_checklist_itens (
  fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json, placeholder
)
SELECT f.id, i.ordem, i.label, i.tipo, i.obrigatorio, false, i.campo_slug, i.config_json::jsonb, i.placeholder
FROM public.kanban_fases f
INNER JOIN public.kanbans k ON k.id = f.kanban_id
CROSS JOIN (
  VALUES
    (1, 'Banco / Fintech escolhida', 'texto_curto', true, 'capital_banco_escolhido', '{}', 'Ex.: Cora, Stone, Inter…'),
    (2, 'Agência', 'texto_curto', true, 'capital_agencia', '{}', NULL),
    (3, 'Número da conta', 'texto_curto', true, 'capital_numero_conta', '{}', NULL),
    (4, 'Confirmação de abertura da conta', 'checkbox', true, 'capital_conta_aberta', '{}', NULL)
) AS i(ordem, label, tipo, obrigatorio, campo_slug, config_json, placeholder)
WHERE (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND f.slug = 'capital_abertura_conta'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens x
    WHERE x.fase_id = f.id AND x.campo_slug = i.campo_slug
  );

-- ─── Checklist — Cadastro na plataforma ──────────────────────────────────────
INSERT INTO public.kanban_fase_checklist_itens (
  fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json, placeholder
)
SELECT f.id, i.ordem, i.label, i.tipo, i.obrigatorio, false, i.campo_slug, i.config_json::jsonb, i.placeholder
FROM public.kanban_fases f
INNER JOIN public.kanbans k ON k.id = f.kanban_id
CROSS JOIN (
  VALUES
    (1, 'E-mail de cadastro', 'email', true, 'capital_email_cadastro', '{}', NULL),
    (2, 'Login criado na plataforma', 'checkbox', true, 'capital_login_criado', '{}', NULL),
    (3, 'Perfil ajustado para emissor (Moní)', 'checkbox', true, 'capital_perfil_emissor_moni',
     '{"hint":"Ação interna Moní: converter investidor → emissor"}', NULL),
    (4, 'URL da plataforma', 'url', false, 'capital_url_plataforma',
     '{"valor_fixo":"https://monicapital.divify.com.br/"}',
     'https://monicapital.divify.com.br/')
) AS i(ordem, label, tipo, obrigatorio, campo_slug, config_json, placeholder)
WHERE (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND f.slug = 'capital_cadastro_plataforma'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens x
    WHERE x.fase_id = f.id AND x.campo_slug = i.campo_slug
  );

-- ─── Checklist — Materiais do projeto ───────────────────────────────────────
INSERT INTO public.kanban_fase_checklist_itens (
  fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json, placeholder
)
SELECT f.id, i.ordem, i.label, i.tipo, i.obrigatorio, false, i.campo_slug, i.config_json::jsonb, i.placeholder
FROM public.kanban_fases f
INNER JOIN public.kanbans k ON k.id = f.kanban_id
CROSS JOIN (
  VALUES
    (1, 'Resumo da oferta', 'texto_curto', true, 'capital_resumo_oferta', '{}', NULL),
    (2, 'Descrição da oferta', 'texto_longo', true, 'capital_descricao_oferta', '{}', NULL),
    (3, 'Equipe', 'texto_longo', false, 'capital_equipe', '{}', NULL),
    (4, 'FAQ', 'texto_longo', false, 'capital_faq', '{}', NULL),
    (5, 'OnePager', 'anexo', true, 'capital_onepager', '{}', NULL),
    (6, 'Materiais aprovados', 'checkbox', true, 'capital_materiais_aprovados', '{}', NULL)
) AS i(ordem, label, tipo, obrigatorio, campo_slug, config_json, placeholder)
WHERE (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND f.slug = 'capital_materiais_projeto'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens x
    WHERE x.fase_id = f.id AND x.campo_slug = i.campo_slug
  );

-- ─── Checklist — Informações obrigatórias ────────────────────────────────────
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
  AND f.slug = 'capital_informacoes_obrigatorias'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens x
    WHERE x.fase_id = f.id AND x.campo_slug = i.campo_slug
  );

-- ─── Checklist — Formalização / Contrato ─────────────────────────────────────
INSERT INTO public.kanban_fase_checklist_itens (
  fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json, placeholder
)
SELECT f.id, i.ordem, i.label, i.tipo, i.obrigatorio, false, i.campo_slug, i.config_json::jsonb, i.placeholder
FROM public.kanban_fases f
INNER JOIN public.kanbans k ON k.id = f.kanban_id
CROSS JOIN (
  VALUES
    (1, 'Contrato preparado pela Moní', 'checkbox', true, 'capital_contrato_preparado', '{}', NULL),
    (2, 'Contrato assinado pelo emissor', 'checkbox', true, 'capital_contrato_assinado', '{}', NULL),
    (3, 'Anexo do contrato assinado', 'anexo', true, 'capital_contrato_anexo', '{}', NULL),
    (4, 'Comprovante de pagamento (R$ 2.500)', 'anexo', true, 'capital_comprovante_pagamento', '{}', NULL),
    (5, 'Pagamento confirmado', 'checkbox', true, 'capital_pagamento_confirmado', '{}', NULL)
) AS i(ordem, label, tipo, obrigatorio, campo_slug, config_json, placeholder)
WHERE (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND f.slug = 'capital_formalizacao'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens x
    WHERE x.fase_id = f.id AND x.campo_slug = i.campo_slug
  );

-- ─── Checklist — Oferta publicada ────────────────────────────────────────────
INSERT INTO public.kanban_fase_checklist_itens (
  fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json, placeholder
)
SELECT f.id, i.ordem, i.label, i.tipo, i.obrigatorio, false, i.campo_slug, i.config_json::jsonb, i.placeholder
FROM public.kanban_fases f
INNER JOIN public.kanbans k ON k.id = f.kanban_id
CROSS JOIN (
  VALUES
    (1, 'Data de publicação', 'data', true, 'capital_data_publicacao', '{}', NULL),
    (2, 'URL da oferta publicada', 'url', true, 'capital_url_oferta', '{}', NULL),
    (3, 'Agendamento mínimo de 1h respeitado', 'checkbox', true, 'capital_agendamento_1h', '{}', NULL)
) AS i(ordem, label, tipo, obrigatorio, campo_slug, config_json, placeholder)
WHERE (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND f.slug = 'capital_concluido'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens x
    WHERE x.fase_id = f.id AND x.campo_slug = i.campo_slug
  );

-- ─── Responsável da fase (oculto) na fase nova ───────────────────────────────
INSERT INTO public.kanban_fase_checklist_itens (
  fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
)
SELECT
  f.id, -2, 'Responsável da fase — tipo', 'select', false, false,
  'responsavel_da_fase_tipo',
  '{"oculto_ui": true, "opcoes": ["Franqueado", "Moní"]}'::jsonb
FROM public.kanban_fases f
INNER JOIN public.kanbans k ON k.id = f.kanban_id
WHERE (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND f.slug = 'capital_abertura_conta'
  AND COALESCE(f.ativo, true) = true
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id AND i.campo_slug = 'responsavel_da_fase_tipo'
  );

INSERT INTO public.kanban_fase_checklist_itens (
  fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
)
SELECT
  f.id, -1, 'Responsável da fase — usuário Moní', 'usuario', false, false,
  'responsavel_da_fase_usuario',
  '{"oculto_ui": true}'::jsonb
FROM public.kanban_fases f
INNER JOIN public.kanbans k ON k.id = f.kanban_id
WHERE (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND f.slug = 'capital_abertura_conta'
  AND COALESCE(f.ativo, true) = true
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id AND i.campo_slug = 'responsavel_da_fase_usuario'
  );

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('464', 'funil_divify_fases_checklist')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
