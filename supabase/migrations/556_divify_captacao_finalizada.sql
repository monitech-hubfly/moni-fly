-- 556: Funil Divify — Oferta publicada deixa de ser conclusão;
-- nova fase Captação Finalizada (ordem após Oferta publicada) é a conclusão.
-- UUID kanban: 724aef36-37de-4454-bf6f-ec481693aeeb (MONI_CAPITAL)
-- Idempotente.

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
    RAISE EXCEPTION '[556] Kanban Funil Divify / Moní Capital não encontrado';
  END IF;

  -- 1) Oferta publicada: tirar slug *_concluido e fase_conversao
  -- (slug capital_concluido fazia isFaseConclusaoKanban=true via regex)
  UPDATE public.kanban_fases
  SET
    slug = 'capital_oferta_publicada',
    nome = 'Oferta publicada',
    fase_conversao = false,
    ativo = true,
    ordem = 7,
    sla_dias = NULL,
    sla_tipo = 'uteis',
    instrucoes = COALESCE(
      NULLIF(trim(instrucoes), ''),
      $instr$Oferta publicada na plataforma Divify.
Acompanhe a captação e indique investidores qualificados (CPFs cadastrados na plataforma).
Quando a captação for encerrada, avançar para Captação Finalizada.$instr$
    )
  WHERE kanban_id = v_kanban_id
    AND slug IN ('capital_concluido', 'capital_oferta_publicada');

  -- Se ainda existir linha com capital_concluido (caso o UPDATE acima não tenha rodado por nome),
  -- garantir que não reste slug antigo.
  UPDATE public.kanban_fases
  SET slug = 'capital_oferta_publicada'
  WHERE kanban_id = v_kanban_id
    AND slug = 'capital_concluido';

  -- 2) Inserir Captação Finalizada (conclusão)
  INSERT INTO public.kanban_fases (
    kanban_id, nome, slug, ordem, sla_dias, sla_tipo, fase_conversao, ativo, instrucoes, materiais
  )
  SELECT
    v_kanban_id,
    'Captação Finalizada',
    'capital_captacao_finalizada',
    8,
    NULL,
    'uteis',
    true,
    true,
    $instr$Captação encerrada — etapa de conclusão do Funil Divify.
Confirmar volume captado, prestações de contas e comunicação ao emissor.
Dispara flag capital_ok no card pai (esteira paralela).$instr$,
    '[]'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND slug = 'capital_captacao_finalizada'
  );

  UPDATE public.kanban_fases
  SET
    nome = 'Captação Finalizada',
    ordem = 8,
    sla_dias = NULL,
    sla_tipo = 'uteis',
    fase_conversao = true,
    ativo = true,
    instrucoes = COALESCE(
      NULLIF(trim(instrucoes), ''),
      $instr$Captação encerrada — etapa de conclusão do Funil Divify.
Confirmar volume captado, prestações de contas e comunicação ao emissor.
Dispara flag capital_ok no card pai (esteira paralela).$instr$
    )
  WHERE kanban_id = v_kanban_id
    AND slug = 'capital_captacao_finalizada';

  -- 3) Não elegível depois da nova fase
  UPDATE public.kanban_fases
  SET ordem = 9, fase_conversao = false, ativo = true
  WHERE kanban_id = v_kanban_id
    AND slug = 'capital_nao_elegivel';

  -- 4) Garantir ordem das fases ativas do fluxo principal
  UPDATE public.kanban_fases kf
  SET ordem = v.ordem
  FROM (VALUES
    ('capital_recebimento', 1),
    ('capital_primeiro_contato', 2),
    ('capital_abertura_spe', 3),
    ('capital_cadastro_plataforma', 4),
    ('capital_preenchimento_oferta', 5),
    ('capital_formalizacao', 6),
    ('capital_oferta_publicada', 7),
    ('capital_captacao_finalizada', 8),
    ('capital_nao_elegivel', 9)
  ) AS v(slug, ordem)
  WHERE kf.kanban_id = v_kanban_id
    AND kf.slug = v.slug;
END $$;

-- Checklist mínimo — Captação Finalizada
INSERT INTO public.kanban_fase_checklist_itens (
  fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json, placeholder
)
SELECT f.id, i.ordem, i.label, i.tipo, i.obrigatorio, false, i.campo_slug, '{}'::jsonb, NULL
FROM public.kanban_fases f
INNER JOIN public.kanbans k ON k.id = f.kanban_id
CROSS JOIN (
  VALUES
    (1, 'Captação encerrada na plataforma', 'checkbox', true, 'capital_captacao_encerrada'),
    (2, 'Emissor comunicado do encerramento', 'checkbox', true, 'capital_emissor_comunicado_encerramento'),
    (3, 'Valor final captado registrado', 'texto_curto', false, 'capital_valor_final_captado')
) AS i(ordem, label, tipo, obrigatorio, campo_slug)
WHERE (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid
    OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND f.slug = 'capital_captacao_finalizada'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens x
    WHERE x.fase_id = f.id AND x.campo_slug = i.campo_slug
  );

-- Atualizar texto da Formalização (próximo passo = Oferta publicada, sem bastão de saída)
UPDATE public.kanban_fases kf
SET instrucoes = regexp_replace(
  COALESCE(kf.instrucoes, ''),
  'Bastão → Oferta publicada:[^\n]*',
  'Avançar → Oferta publicada: contrato assinado + pagamento confirmado.',
  'g'
)
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid
    OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND kf.slug = 'capital_formalizacao'
  AND kf.instrucoes ILIKE '%Bastão → Oferta publicada%';

NOTIFY pgrst, 'reload schema';
