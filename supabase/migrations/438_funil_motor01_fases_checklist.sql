-- 438: Funil Motor 01 — renomear R03, 3 fases novas, instruções e checklist
--   • m1_r03 → «R03 — Apresentação da Casa Escolhida»
--   • novas: m1_execucao_casa, m1_ajustes, m1_r04_ajustes (encaixadas sem renumerar SLAs existentes)
--   • instruções em 16 fases; kanban_fase_checklist_itens conforme spec
--   • tipo checklist «moeda» na constraint
-- Idempotente. Não altera sla_dias/sla_tipo das 13 fases originais nem fase_conversao de m1_cto_cliente.

-- ─── Tipo «moeda» no checklist ───────────────────────────────────────────────
ALTER TABLE public.kanban_fase_checklist_itens
  DROP CONSTRAINT IF EXISTS kanban_fase_checklist_itens_tipo_check;

ALTER TABLE public.kanban_fase_checklist_itens
  ADD CONSTRAINT kanban_fase_checklist_itens_tipo_check
  CHECK (tipo = ANY (ARRAY[
    'texto_curto'::text,
    'texto_longo'::text,
    'email'::text,
    'telefone'::text,
    'numero'::text,
    'url'::text,
    'anexo'::text,
    'anexo_multiplo'::text,
    'anexo_template'::text,
    'checkbox'::text,
    'data'::text,
    'hora'::text,
    'select'::text,
    'usuario'::text,
    'cnpj'::text,
    'catalog_casa'::text,
    'calculado'::text,
    'moeda'::text,
    'faixa_moeda'::text,
    'faixa_numero'::text,
    'tabela'::text,
    'condominio'::text,
    'pesquisa_condominio'::text,
    'lotes_condominio'::text,
    'listagem_casas_zap'::text,
    'dados_cidade_ibge'::text,
    'mapa_praca'::text,
    'configurador_casas_ranking'::text,
    'bca_simulador'::text,
    'bca_condominio'::text,
    'rede_loteador'::text
  ]));

-- ─── Renomear R03 + inserir 3 fases ──────────────────────────────────────────
DO $$
DECLARE
  v_kanban_id uuid;
  v_ordem int;
BEGIN
  SELECT id INTO v_kanban_id
  FROM public.kanbans
  WHERE id = '202527ea-d284-4c49-94f5-e75b25d6910e'::uuid
     OR nome = 'Funil Motor 01'
  ORDER BY CASE WHEN id = '202527ea-d284-4c49-94f5-e75b25d6910e'::uuid THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '438: kanban Funil Motor 01 não encontrado.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases
  SET nome = 'R03 — Apresentação da Casa Escolhida'
  WHERE kanban_id = v_kanban_id
    AND slug = 'm1_r03'
    AND nome IS DISTINCT FROM 'R03 — Apresentação da Casa Escolhida';

  -- m1_execucao_casa: entre m1_r02 e m1_r03
  IF NOT EXISTS (
    SELECT 1 FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND slug = 'm1_execucao_casa'
  ) THEN
    SELECT ordem INTO v_ordem
    FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND slug = 'm1_r03'
    LIMIT 1;

    IF v_ordem IS NULL THEN
      v_ordem := 4;
    END IF;

    UPDATE public.kanban_fases
    SET ordem = ordem + 1
    WHERE kanban_id = v_kanban_id
      AND ordem >= v_ordem;

    INSERT INTO public.kanban_fases (
      kanban_id, nome, slug, ordem, sla_dias, sla_tipo, fase_conversao, ativo, instrucoes, materiais
    ) VALUES (
      v_kanban_id,
      'Execução da Casa Escolhida',
      'm1_execucao_casa',
      v_ordem,
      5,
      'uteis',
      false,
      true,
      'Execução do(s) modelo(s) ainda em disputa: gera opções de fachada para cada modelo e processa eventuais pedidos de ajuste.',
      '[]'::jsonb
    );
  END IF;

  -- m1_ajustes: após m1_r03
  IF NOT EXISTS (
    SELECT 1 FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND slug = 'm1_ajustes'
  ) THEN
    SELECT ordem + 1 INTO v_ordem
    FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND slug = 'm1_r03'
    LIMIT 1;

    IF v_ordem IS NULL THEN
      v_ordem := 6;
    END IF;

    UPDATE public.kanban_fases
    SET ordem = ordem + 1
    WHERE kanban_id = v_kanban_id
      AND ordem >= v_ordem
      AND slug <> 'm1_ajustes';

    INSERT INTO public.kanban_fases (
      kanban_id, nome, slug, ordem, sla_dias, sla_tipo, fase_conversao, ativo, instrucoes, materiais
    ) VALUES (
      v_kanban_id,
      'Ajustes',
      'm1_ajustes',
      v_ordem,
      5,
      'uteis',
      false,
      true,
      'Rodada de ajustes solicitados após a apresentação da casa escolhida.',
      '[]'::jsonb
    );
  END IF;

  -- m1_r04_ajustes: antes de m1_cto_terrenista
  IF NOT EXISTS (
    SELECT 1 FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND slug = 'm1_r04_ajustes'
  ) THEN
    SELECT ordem INTO v_ordem
    FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND slug = 'm1_cto_terrenista'
    LIMIT 1;

    IF v_ordem IS NULL THEN
      v_ordem := 8;
    END IF;

    UPDATE public.kanban_fases
    SET ordem = ordem + 1
    WHERE kanban_id = v_kanban_id
      AND ordem >= v_ordem
      AND slug <> 'm1_r04_ajustes';

    INSERT INTO public.kanban_fases (
      kanban_id, nome, slug, ordem, sla_dias, sla_tipo, fase_conversao, ativo, instrucoes, materiais
    ) VALUES (
      v_kanban_id,
      'R04 — Ajustes',
      'm1_r04_ajustes',
      v_ordem,
      10,
      'uteis',
      false,
      true,
      'Rodada adicional de ajustes, com prazo maior.',
      '[]'::jsonb
    );
  END IF;
END $$;

-- ─── Instruções (13 existentes + m1_r03 renomeada) ───────────────────────────
UPDATE public.kanban_fases
SET instrucoes = CASE slug
  WHEN 'm1_r01' THEN 'Reunião de boas-vindas. Cliente indica até 3 modelos de interesse, informa o budget disponível, os dados do condomínio e do lote (nome, quadra, lote, área) e a forma de aquisição do terreno. Envio do planialtimétrico do terreno.'
  WHEN 'm1_acoplamento' THEN 'Time de produto processa os até 3 modelos indicados pelo cliente no R01: gera implantação, orçamento via GriffonBox, imagens e simulador de viabilidade para cada um.'
  WHEN 'm1_r02' THEN 'Apresentação dos até 3 modelos processados ao cliente. É necessário marcar qual modelo segue adiante (check de seleção).'
  WHEN 'm1_cto_terrenista' THEN 'Contrato com condições precedentes e procuração necessária porque as aprovações começam antes da transferência do terreno.'
  WHEN 'm1_intencao_compra' THEN 'Assinatura antes do contrato final, para acelerar o fechamento com o terrenista dado o tempo que a formalização pode levar.'
  WHEN 'm1_cto_cliente' THEN 'Geração e assinatura do contrato final com o cliente. Definir se a parte contratante é Moní ou Franqueado.'
  WHEN 'm1_pagamento_entrada' THEN 'Pagamento de sinal mais entrada e parcelas, ou percentual maior nas chaves, conforme negociado.'
  WHEN 'm1_custom_0' THEN 'Apresenta o que já está incluso no Kit Moní contratado e o que pode ser alterado.'
  WHEN 'm1_custom_track1' THEN 'Definições de infraestrutura e estrutural do Custom (elétrica, iluminação, hidráulica, ar condicionado, gadgets de infra, marcenaria, piscina, gourmet não elétrico).'
  WHEN 'm1_custom_track2' THEN 'Acabamentos dependentes de infra (piso, parede, forro, pedras e bancadas, fachada e acabamentos externos, gourmet não elétrico).'
  WHEN 'm1_custom_track3' THEN 'Itens independentes de infra (louças e metais, portas, box e espelhos).'
  WHEN 'm1_custom_final' THEN 'Consolida o orçamento final via GriffonBox, fecha o mapa de acabamentos e assina o aditivo de customização.'
  ELSE instrucoes
END
WHERE slug IN (
  'm1_r01', 'm1_acoplamento', 'm1_r02', 'm1_cto_terrenista', 'm1_intencao_compra',
  'm1_cto_cliente', 'm1_pagamento_entrada', 'm1_custom_0', 'm1_custom_track1',
  'm1_custom_track2', 'm1_custom_track3', 'm1_custom_final'
);

UPDATE public.kanban_fases
SET instrucoes = 'Apresentação da casa escolhida, com opções de fachada, ao cliente. Cliente escolhe a fachada final.'
WHERE slug = 'm1_r03';

-- ─── Checklist itens (m1_custom_0 e tracks 1/2/3 sem itens) ─────────────────
INSERT INTO public.kanban_fase_checklist_itens (fase_id, label, tipo, obrigatorio, ordem)
SELECT kf.id, v.label, v.tipo, true, v.ordem
FROM public.kanban_fases kf
JOIN (
  VALUES
    ('m1_r01', '3 modelos escolhidos', 'texto_curto', 1),
    ('m1_r01', 'Budget', 'moeda', 2),
    ('m1_r01', 'Nome do Condomínio', 'texto_curto', 3),
    ('m1_r01', 'Quadra', 'texto_curto', 4),
    ('m1_r01', 'Lote', 'texto_curto', 5),
    ('m1_r01', 'Área do Lote', 'texto_curto', 6),
    ('m1_r01', 'Planialtimétrico do Terreno', 'anexo', 7),
    ('m1_r01', 'Forma de Aquisição do Terreno', 'texto_curto', 8),
    ('m1_acoplamento', 'Modelo 1', 'texto_curto', 1),
    ('m1_acoplamento', 'Implantação Modelo 1', 'anexo', 2),
    ('m1_acoplamento', 'Gbox Modelo 1', 'anexo', 3),
    ('m1_acoplamento', 'Imagens Modelo 1', 'anexo', 4),
    ('m1_acoplamento', 'Simulador Modelo 1', 'anexo', 5),
    ('m1_acoplamento', 'Modelo 2', 'texto_curto', 6),
    ('m1_acoplamento', 'Implantação Modelo 2', 'anexo', 7),
    ('m1_acoplamento', 'Gbox Modelo 2', 'anexo', 8),
    ('m1_acoplamento', 'Imagens Modelo 2', 'anexo', 9),
    ('m1_acoplamento', 'Simulador Modelo 2', 'anexo', 10),
    ('m1_acoplamento', 'Modelo 3', 'texto_curto', 11),
    ('m1_acoplamento', 'Implantação Modelo 3', 'anexo', 12),
    ('m1_acoplamento', 'Gbox Modelo 3', 'anexo', 13),
    ('m1_acoplamento', 'Imagens Modelo 3', 'anexo', 14),
    ('m1_acoplamento', 'Simulador Modelo 3', 'anexo', 15),
    ('m1_r02', 'Modelo 1', 'texto_curto', 1),
    ('m1_r02', 'Implantação Modelo 1', 'anexo', 2),
    ('m1_r02', 'Gbox Modelo 1', 'anexo', 3),
    ('m1_r02', 'Imagens Modelo 1', 'anexo', 4),
    ('m1_r02', 'Simulador Modelo 1', 'anexo', 5),
    ('m1_r02', 'Modelo 2', 'texto_curto', 6),
    ('m1_r02', 'Implantação Modelo 2', 'anexo', 7),
    ('m1_r02', 'Gbox Modelo 2', 'anexo', 8),
    ('m1_r02', 'Imagens Modelo 2', 'anexo', 9),
    ('m1_r02', 'Simulador Modelo 2', 'anexo', 10),
    ('m1_r02', 'Modelo 3', 'texto_curto', 11),
    ('m1_r02', 'Implantação Modelo 3', 'anexo', 12),
    ('m1_r02', 'Gbox Modelo 3', 'anexo', 13),
    ('m1_r02', 'Imagens Modelo 3', 'anexo', 14),
    ('m1_r02', 'Simulador Modelo 3', 'anexo', 15),
    ('m1_r02', 'Seguir com Modelo 1', 'checkbox', 16),
    ('m1_r02', 'Seguir com Modelo 2', 'checkbox', 17),
    ('m1_r02', 'Seguir com Modelo 3', 'checkbox', 18),
    ('m1_execucao_casa', 'Modelo 1', 'texto_curto', 1),
    ('m1_execucao_casa', 'Implantação Modelo 1', 'anexo', 2),
    ('m1_execucao_casa', 'Gbox Modelo 1', 'anexo', 3),
    ('m1_execucao_casa', 'Imagens Modelo 1', 'anexo', 4),
    ('m1_execucao_casa', 'Simulador Modelo 1', 'anexo', 5),
    ('m1_execucao_casa', 'Possibilidades de Fachada 1', 'anexo', 6),
    ('m1_execucao_casa', 'Ajustes solicitados 1', 'texto_curto', 7),
    ('m1_execucao_casa', 'Modelo 2', 'texto_curto', 8),
    ('m1_execucao_casa', 'Implantação Modelo 2', 'anexo', 9),
    ('m1_execucao_casa', 'Gbox Modelo 2', 'anexo', 10),
    ('m1_execucao_casa', 'Imagens Modelo 2', 'anexo', 11),
    ('m1_execucao_casa', 'Simulador Modelo 2', 'anexo', 12),
    ('m1_execucao_casa', 'Possibilidades de Fachada 2', 'anexo', 13),
    ('m1_execucao_casa', 'Ajustes solicitados 2', 'texto_curto', 14),
    ('m1_execucao_casa', 'Modelo 3', 'texto_curto', 15),
    ('m1_execucao_casa', 'Implantação Modelo 3', 'anexo', 16),
    ('m1_execucao_casa', 'Gbox Modelo 3', 'anexo', 17),
    ('m1_execucao_casa', 'Imagens Modelo 3', 'anexo', 18),
    ('m1_execucao_casa', 'Simulador Modelo 3', 'anexo', 19),
    ('m1_execucao_casa', 'Possibilidades de Fachada 3', 'anexo', 20),
    ('m1_execucao_casa', 'Ajustes solicitados 3', 'texto_curto', 21),
    ('m1_execucao_casa', 'Seguir com Modelo 1', 'checkbox', 22),
    ('m1_execucao_casa', 'Seguir com Modelo 2', 'checkbox', 23),
    ('m1_execucao_casa', 'Seguir com Modelo 3', 'checkbox', 24),
    ('m1_r03', 'Modelo 1', 'texto_curto', 1),
    ('m1_r03', 'Implantação Modelo 1', 'anexo', 2),
    ('m1_r03', 'Gbox Modelo 1', 'anexo', 3),
    ('m1_r03', 'Imagens Modelo 1', 'anexo', 4),
    ('m1_r03', 'Simulador Modelo 1', 'anexo', 5),
    ('m1_r03', 'Possibilidades de Fachada 1', 'anexo', 6),
    ('m1_r03', 'Fachada escolhida 1', 'anexo', 7),
    ('m1_r03', 'Ajustes solicitados 1', 'texto_curto', 8),
    ('m1_r03', 'Modelo 2', 'texto_curto', 9),
    ('m1_r03', 'Implantação Modelo 2', 'anexo', 10),
    ('m1_r03', 'Gbox Modelo 2', 'anexo', 11),
    ('m1_r03', 'Imagens Modelo 2', 'anexo', 12),
    ('m1_r03', 'Simulador Modelo 2', 'anexo', 13),
    ('m1_r03', 'Possibilidades de Fachada 2', 'anexo', 14),
    ('m1_r03', 'Fachada escolhida 2', 'anexo', 15),
    ('m1_r03', 'Ajustes solicitados 2', 'texto_curto', 16),
    ('m1_r03', 'Modelo 3', 'texto_curto', 17),
    ('m1_r03', 'Implantação Modelo 3', 'anexo', 18),
    ('m1_r03', 'Gbox Modelo 3', 'anexo', 19),
    ('m1_r03', 'Imagens Modelo 3', 'anexo', 20),
    ('m1_r03', 'Simulador Modelo 3', 'anexo', 21),
    ('m1_r03', 'Possibilidades de Fachada 3', 'anexo', 22),
    ('m1_r03', 'Fachada escolhida 3', 'anexo', 23),
    ('m1_r03', 'Ajustes solicitados 3', 'texto_curto', 24),
    ('m1_r03', 'Seguir com Modelo 1', 'checkbox', 25),
    ('m1_r03', 'Seguir com Modelo 2', 'checkbox', 26),
    ('m1_r03', 'Seguir com Modelo 3', 'checkbox', 27),
    ('m1_ajustes', 'Modelo 1', 'texto_curto', 1),
    ('m1_ajustes', 'Implantação Modelo 1', 'anexo', 2),
    ('m1_ajustes', 'Gbox Modelo 1', 'anexo', 3),
    ('m1_ajustes', 'Imagens Modelo 1', 'anexo', 4),
    ('m1_ajustes', 'Simulador Modelo 1', 'anexo', 5),
    ('m1_ajustes', 'Possibilidades de Fachada 1', 'anexo', 6),
    ('m1_ajustes', 'Fachada escolhida 1', 'anexo', 7),
    ('m1_ajustes', 'Ajustes solicitados 1', 'texto_curto', 8),
    ('m1_ajustes', 'Modelo 2', 'texto_curto', 9),
    ('m1_ajustes', 'Implantação Modelo 2', 'anexo', 10),
    ('m1_ajustes', 'Gbox Modelo 2', 'anexo', 11),
    ('m1_ajustes', 'Imagens Modelo 2', 'anexo', 12),
    ('m1_ajustes', 'Simulador Modelo 2', 'anexo', 13),
    ('m1_ajustes', 'Possibilidades de Fachada 2', 'anexo', 14),
    ('m1_ajustes', 'Fachada escolhida 2', 'anexo', 15),
    ('m1_ajustes', 'Ajustes solicitados 2', 'texto_curto', 16),
    ('m1_ajustes', 'Modelo 3', 'texto_curto', 17),
    ('m1_ajustes', 'Implantação Modelo 3', 'anexo', 18),
    ('m1_ajustes', 'Gbox Modelo 3', 'anexo', 19),
    ('m1_ajustes', 'Imagens Modelo 3', 'anexo', 20),
    ('m1_ajustes', 'Simulador Modelo 3', 'anexo', 21),
    ('m1_ajustes', 'Possibilidades de Fachada 3', 'anexo', 22),
    ('m1_ajustes', 'Fachada escolhida 3', 'anexo', 23),
    ('m1_ajustes', 'Ajustes solicitados 3', 'texto_curto', 24),
    ('m1_ajustes', 'Seguir com Modelo 1', 'checkbox', 25),
    ('m1_ajustes', 'Seguir com Modelo 2', 'checkbox', 26),
    ('m1_ajustes', 'Seguir com Modelo 3', 'checkbox', 27),
    ('m1_r04_ajustes', 'Modelo 1', 'texto_curto', 1),
    ('m1_r04_ajustes', 'Implantação Modelo 1', 'anexo', 2),
    ('m1_r04_ajustes', 'Gbox Modelo 1', 'anexo', 3),
    ('m1_r04_ajustes', 'Imagens Modelo 1', 'anexo', 4),
    ('m1_r04_ajustes', 'Simulador Modelo 1', 'anexo', 5),
    ('m1_r04_ajustes', 'Possibilidades de Fachada 1', 'anexo', 6),
    ('m1_r04_ajustes', 'Fachada escolhida 1', 'anexo', 7),
    ('m1_r04_ajustes', 'Ajustes solicitados 1', 'texto_curto', 8),
    ('m1_r04_ajustes', 'Modelo 2', 'texto_curto', 9),
    ('m1_r04_ajustes', 'Implantação Modelo 2', 'anexo', 10),
    ('m1_r04_ajustes', 'Gbox Modelo 2', 'anexo', 11),
    ('m1_r04_ajustes', 'Imagens Modelo 2', 'anexo', 12),
    ('m1_r04_ajustes', 'Simulador Modelo 2', 'anexo', 13),
    ('m1_r04_ajustes', 'Possibilidades de Fachada 2', 'anexo', 14),
    ('m1_r04_ajustes', 'Fachada escolhida 2', 'anexo', 15),
    ('m1_r04_ajustes', 'Ajustes solicitados 2', 'texto_curto', 16),
    ('m1_r04_ajustes', 'Modelo 3', 'texto_curto', 17),
    ('m1_r04_ajustes', 'Implantação Modelo 3', 'anexo', 18),
    ('m1_r04_ajustes', 'Gbox Modelo 3', 'anexo', 19),
    ('m1_r04_ajustes', 'Imagens Modelo 3', 'anexo', 20),
    ('m1_r04_ajustes', 'Simulador Modelo 3', 'anexo', 21),
    ('m1_r04_ajustes', 'Possibilidades de Fachada 3', 'anexo', 22),
    ('m1_r04_ajustes', 'Fachada escolhida 3', 'anexo', 23),
    ('m1_r04_ajustes', 'Ajustes solicitados 3', 'texto_curto', 24),
    ('m1_r04_ajustes', 'Seguir com Modelo 1', 'checkbox', 25),
    ('m1_r04_ajustes', 'Seguir com Modelo 2', 'checkbox', 26),
    ('m1_r04_ajustes', 'Seguir com Modelo 3', 'checkbox', 27),
    ('m1_cto_terrenista', 'Contrato', 'anexo', 1),
    ('m1_cto_terrenista', 'Procuração', 'anexo', 2),
    ('m1_intencao_compra', 'Intenção de Compra', 'anexo', 1),
    ('m1_intencao_compra', 'Sinal', 'moeda', 2),
    ('m1_intencao_compra', 'Data Pag. Sinal', 'texto_curto', 3),
    ('m1_intencao_compra', 'Valor Total do Contrato', 'moeda', 4),
    ('m1_cto_cliente', 'Parte contratante (Moní ou Franqueado)', 'texto_curto', 1),
    ('m1_cto_cliente', 'Valor total do contrato', 'numero', 2),
    ('m1_cto_cliente', 'Condições de pagamento', 'texto_longo', 3),
    ('m1_cto_cliente', 'Contrato assinado', 'anexo', 4),
    ('m1_cto_cliente', 'Data de assinatura', 'texto_curto', 5),
    ('m1_pagamento_entrada', 'Percentual de sinal', 'numero', 1),
    ('m1_pagamento_entrada', 'Percentual de entrada', 'numero', 2),
    ('m1_pagamento_entrada', 'Parcelamento definido', 'texto_longo', 3),
    ('m1_pagamento_entrada', 'Data de pagamento', 'texto_curto', 4),
    ('m1_pagamento_entrada', 'Comprovante de pagamento', 'anexo', 5),
    ('m1_custom_final', 'Contrato Custom', 'anexo', 1),
    ('m1_custom_final', 'Sinal Custom', 'moeda', 2),
    ('m1_custom_final', 'Data Pag. Sinal Custom', 'texto_curto', 3),
    ('m1_custom_final', 'Valor Total do Contrato Custom', 'moeda', 4)
) AS v(fase_slug, label, tipo, ordem)
  ON kf.slug = v.fase_slug
WHERE NOT EXISTS (
  SELECT 1
  FROM public.kanban_fase_checklist_itens i
  WHERE i.fase_id = kf.id
    AND i.label = v.label
);

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('438', 'funil_motor01_fases_checklist')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
