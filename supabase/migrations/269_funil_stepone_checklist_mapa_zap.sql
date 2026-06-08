-- 269: Funil Step One — Mapa de Competidores: checklist estrutural com listagem ZAP embutida.

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
    'listagem_casas_zap'
  ));

DO $$
DECLARE
  v_fase_id UUID;
BEGIN
  SELECT f.id
  INTO v_fase_id
  FROM public.kanban_fases f
  JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
  WHERE f.slug IN ('mapa_competidores', 'stepone_mapa')
    AND COALESCE(f.ativo, true) = true
  ORDER BY CASE WHEN f.slug = 'mapa_competidores' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '269: fase mapa_competidores não encontrada; pulando.';
    RETURN;
  END IF;

  DELETE FROM public.kanban_fase_checklist_respostas r
  USING public.kanban_fase_checklist_itens i
  WHERE r.item_id = i.id AND i.fase_id = v_fase_id;

  DELETE FROM public.kanban_fase_checklist_itens WHERE fase_id = v_fase_id;

  INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
  VALUES
    (v_fase_id, 1, 'Listagem de casas (ZAP)', 'listagem_casas_zap', true, false,
     'Varredura automática na ZAP, tabela de anúncios e cadastro manual de casas.'),
    (v_fase_id, 2, 'Faixa de valor de venda estimada', 'texto_curto', true, true,
     'Ex.: R$ 1,2 MM – R$ 1,8 MM'),
    (v_fase_id, 3, 'Link planilha / mapa externo', 'url', false, false,
     'https://…'),
    (v_fase_id, 4, 'Observações do levantamento', 'texto_longo', false, true, NULL);

  UPDATE public.kanban_fases
  SET instrucoes = $instr$
Levante todas as casas anunciadas e vendidas no condomínio e região, na faixa de valor de venda estimada.

Use o checklist abaixo para:
1. Varrer a ZAP (Apify) e gerar a listagem automática de anúncios
2. Complementar com casas manuais quando necessário
3. Validar mensalmente o status das casas cadastradas manualmente
4. Registrar a faixa de valor e observações do levantamento

Com base nesse mapa, identifique valores target, programas e estilos do mercado local — insumo para Pré-batalha e Batalha de Casas.
$instr$
  WHERE id = v_fase_id;
END;
$$;
