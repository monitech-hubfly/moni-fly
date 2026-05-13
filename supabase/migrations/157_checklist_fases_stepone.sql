-- 157: Checklist estrutural — demais fases do Funil Step One (itens por fase).
-- Idempotente: alinha slug canónico + INSERT com WHERE NOT EXISTS (fase_id + label).

DO $$
DECLARE
  v_kanban_id UUID;
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE nome = 'Funil Step One'
    AND COALESCE(ativo, true) = true
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '157: kanban Funil Step One não encontrado; pulando.';
    RETURN;
  END IF;

  -- Slugs canónicos (pedido do produto); idempotente por nome da fase.
  UPDATE public.kanban_fases SET slug = 'dados_cidade'
    WHERE kanban_id = v_kanban_id AND nome = 'Dados da Cidade';
  UPDATE public.kanban_fases SET slug = 'lista_condominios'
    WHERE kanban_id = v_kanban_id AND nome = 'Lista de Condomínios';
  UPDATE public.kanban_fases SET slug = 'dados_condominios'
    WHERE kanban_id = v_kanban_id AND nome = 'Dados dos Condomínios';
  UPDATE public.kanban_fases SET slug = 'lotes_disponiveis'
    WHERE kanban_id = v_kanban_id AND nome = 'Lotes disponíveis';
  UPDATE public.kanban_fases SET slug = 'mapa_competidores'
    WHERE kanban_id = v_kanban_id AND nome = 'Mapa de Competidores';
  UPDATE public.kanban_fases SET slug = 'bca_batalha_casas'
    WHERE kanban_id = v_kanban_id AND nome = 'BCA + Batalha de Casas';
  UPDATE public.kanban_fases SET slug = 'hipoteses'
    WHERE kanban_id = v_kanban_id AND nome = 'Hipóteses';
END;
$$;

-- ─── Dados da Cidade (slug: dados_cidade) ───────────────────────────────────
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
SELECT f.id, v.ordem, v.label, v.tipo, true, true, v.placeholder
FROM public.kanban_fases f
JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
CROSS JOIN (VALUES
  (1, 'Cidade de interesse',       'texto_curto', NULL::text),
  (2, 'Estado',                    'texto_curto', NULL),
  (3, 'População estimada',        'numero',      NULL),
  (4, 'Renda média per capita',    'texto_curto', NULL),
  (5, 'Observações sobre a praça', 'texto_longo', NULL)
) AS v(ordem, label, tipo, placeholder)
WHERE f.slug = 'dados_cidade'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id AND i.label = v.label
  );

-- ─── Lista de Condomínios (slug: lista_condominios) ─────────────────────────
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
SELECT f.id, v.ordem, v.label, v.tipo, true, true, v.placeholder
FROM public.kanban_fases f
JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
CROSS JOIN (VALUES
  (1, 'Nome do condomínio',    'texto_curto', NULL::text),
  (2, 'Endereço',              'texto_curto', NULL),
  (3, 'Número de unidades',    'numero',      NULL),
  (4, 'Contato do síndico',    'texto_curto', NULL),
  (5, 'Status de interesse',   'texto_curto', NULL)
) AS v(ordem, label, tipo, placeholder)
WHERE f.slug = 'lista_condominios'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id AND i.label = v.label
  );

-- ─── Dados dos Condomínios (slug: dados_condominios) ────────────────────────
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
SELECT f.id, v.ordem, v.label, v.tipo, true, true, v.placeholder
FROM public.kanban_fases f
JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
CROSS JOIN (VALUES
  (1, 'Nome do condomínio',                 'texto_curto', NULL::text),
  (2, 'CNPJ do condomínio',                 'texto_curto', NULL),
  (3, 'Área total do terreno m²',           'numero',      NULL),
  (4, 'Área disponível para construção m²', 'numero',      NULL),
  (5, 'Documentação regularizada',          'checkbox',    NULL),
  (6, 'Observações',                        'texto_longo', NULL)
) AS v(ordem, label, tipo, placeholder)
WHERE f.slug = 'dados_condominios'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id AND i.label = v.label
  );

-- ─── Lotes disponíveis (slug: lotes_disponiveis) ────────────────────────────
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
SELECT f.id, v.ordem, v.label, v.tipo, true, true, v.placeholder
FROM public.kanban_fases f
JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
CROSS JOIN (VALUES
  (1, 'Identificação do lote',  'texto_curto', NULL::text),
  (2, 'Área m²',                 'numero',      NULL),
  (3, 'Valor estimado',          'texto_curto', NULL),
  (4, 'Situação documental',     'texto_curto', NULL),
  (5, 'Fotos do lote',           'anexo',       NULL)
) AS v(ordem, label, tipo, placeholder)
WHERE f.slug = 'lotes_disponiveis'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id AND i.label = v.label
  );

-- ─── Mapa de Competidores (slug: mapa_competidores) ─────────────────────────
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
SELECT f.id, v.ordem, v.label, v.tipo, true, true, v.placeholder
FROM public.kanban_fases f
JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
CROSS JOIN (VALUES
  (1, 'Nome do competidor',          'texto_curto', NULL::text),
  (2, 'Distância km',                'numero',      NULL),
  (3, 'Produto/serviço oferecido',   'texto_curto', NULL),
  (4, 'Nível de ameaça',             'texto_curto', NULL),
  (5, 'Observações',                 'texto_longo', NULL)
) AS v(ordem, label, tipo, placeholder)
WHERE f.slug = 'mapa_competidores'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id AND i.label = v.label
  );

-- ─── BCA + Batalha de Casas (slug: bca_batalha_casas) ───────────────────────
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
SELECT f.id, v.ordem, v.label, v.tipo, true, true, v.placeholder
FROM public.kanban_fases f
JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
CROSS JOIN (VALUES
  (1, 'BCA elaborado',                   'checkbox',    NULL::text),
  (2, 'Link do BCA',                     'texto_curto', NULL),
  (3, 'Resultado da batalha de casas',   'texto_longo', NULL),
  (4, 'Aprovado pelo comitê',            'checkbox',    NULL)
) AS v(ordem, label, tipo, placeholder)
WHERE f.slug = 'bca_batalha_casas'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id AND i.label = v.label
  );

-- ─── Hipóteses (slug: hipoteses) ────────────────────────────────────────────
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
SELECT f.id, v.ordem, v.label, v.tipo, true, true, v.placeholder
FROM public.kanban_fases f
JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
CROSS JOIN (VALUES
  (1, 'Hipótese principal',   'texto_longo', NULL::text),
  (2, 'Premissas assumidas',  'texto_longo', NULL),
  (3, 'Riscos identificados', 'texto_longo', NULL),
  (4, 'Próximos passos',      'texto_longo', NULL)
) AS v(ordem, label, tipo, placeholder)
WHERE f.slug = 'hipoteses'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id AND i.label = v.label
  );
