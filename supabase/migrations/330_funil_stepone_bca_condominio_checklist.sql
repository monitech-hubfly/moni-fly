-- 330: Funil Step One — widget BCA por condomínio (tipo bca_condominio) + colunas faltantes.

-- Colunas adicionais em bca_cenarios (schema plano BcaCondominioChecklist)
ALTER TABLE public.bca_cenarios
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS rentabilidade_terrenista_aa NUMERIC(8, 4) DEFAULT 0.15,
  ADD COLUMN IF NOT EXISTS percentual_funding NUMERIC(8, 4) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS mes_venda_target INTEGER DEFAULT 8,
  ADD COLUMN IF NOT EXISTS mes_venda_liquidacao INTEGER DEFAULT 12,
  ADD COLUMN IF NOT EXISTS comissao_vendas NUMERIC(8, 4) DEFAULT -0.06,
  ADD COLUMN IF NOT EXISTS impostos NUMERIC(8, 4) DEFAULT -0.06,
  ADD COLUMN IF NOT EXISTS taxa_plataforma NUMERIC(8, 4) DEFAULT -0.07,
  ADD COLUMN IF NOT EXISTS taxa_gestao_frank NUMERIC(8, 4) DEFAULT -0.08,
  ADD COLUMN IF NOT EXISTS percentual_entrada_m0 NUMERIC(8, 4) DEFAULT 0.30,
  ADD COLUMN IF NOT EXISTS percentual_primeira_parcela NUMERIC(8, 4) DEFAULT 0.30,
  ADD COLUMN IF NOT EXISTS mes_pagamento_entrada INTEGER DEFAULT 4;

-- Ajuste default mes_inicio_obra (catálogo / plano)
ALTER TABLE public.bca_cenarios
  ALTER COLUMN mes_inicio_obra SET DEFAULT 7;

ALTER TABLE public.catalogo_casas
  ALTER COLUMN mes_inicio_obra_padrao SET DEFAULT 7;

-- Tipo bca_condominio no checklist
ALTER TABLE public.kanban_fase_checklist_itens
  DROP CONSTRAINT IF EXISTS kanban_fase_checklist_itens_tipo_check;

ALTER TABLE public.kanban_fase_checklist_itens
  ADD CONSTRAINT kanban_fase_checklist_itens_tipo_check
  CHECK (tipo IN (
    'texto_curto',
    'texto_longo',
    'email',
    'telefone',
    'numero',
    'url',
    'anexo',
    'anexo_template',
    'checkbox',
    'data',
    'hora',
    'tabela',
    'condominio',
    'pesquisa_condominio',
    'lotes_condominio',
    'listagem_casas_zap',
    'dados_cidade_ibge',
    'mapa_praca',
    'configurador_casas_ranking',
    'bca_simulador',
    'bca_condominio'
  ));

-- Fase BCA Step One (id fixo DEV/PROD alinhado)
DO $$
DECLARE
  v_fase_id UUID := '8fda525c-720d-4db7-821d-52625867a000';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanban_fases WHERE id = v_fase_id) THEN
    SELECT f.id INTO v_fase_id
    FROM public.kanban_fases f
    JOIN public.kanbans k ON k.id = f.kanban_id
    WHERE f.slug IN ('bca', 'stepone_bca')
      AND k.nome = 'Funil Step One'
      AND COALESCE(f.ativo, true) = true
    LIMIT 1;
  END IF;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '330: fase BCA não encontrada; pulando checklist.';
    RETURN;
  END IF;

  -- Remove itens legados manuais (casas candidatas 1–3 texto_curto), se existirem
  DELETE FROM public.kanban_fase_checklist_respostas r
  USING public.kanban_fase_checklist_itens i
  WHERE r.item_id = i.id
    AND i.fase_id = v_fase_id
    AND i.label IN (
      'Casa candidata 1',
      'Casa candidata 2',
      'Casa candidata 3'
    );

  DELETE FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id
    AND label IN ('Casa candidata 1', 'Casa candidata 2', 'Casa candidata 3');

  -- Remove widget antigo bca_simulador se existir (substituído por bca_condominio)
  DELETE FROM public.kanban_fase_checklist_respostas r
  USING public.kanban_fase_checklist_itens i
  WHERE r.item_id = i.id
    AND i.fase_id = v_fase_id
    AND i.tipo = 'bca_simulador';

  DELETE FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND tipo = 'bca_simulador';

  IF NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_id AND tipo = 'bca_condominio'
  ) THEN
    UPDATE public.kanban_fase_checklist_itens
    SET ordem = ordem + 1
    WHERE fase_id = v_fase_id;

    INSERT INTO public.kanban_fase_checklist_itens (
      fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder
    )
    VALUES (
      v_fase_id,
      1,
      'BCA por condomínio prospectado',
      'bca_condominio',
      true,
      true,
      'Abas por condomínio da Tabela de Condomínios; dentro de cada uma, simule casas com resultado automático.'
    );
  END IF;
END;
$$;
