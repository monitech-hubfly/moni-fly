-- 327: Funil Step One — Configurador de Casas: checklist com ranking Pré Batalha e custos por faixa.

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
    'configurador_casas_ranking'
  ));

DO $$
DECLARE
  v_fase_id UUID;
BEGIN
  SELECT f.id
  INTO v_fase_id
  FROM public.kanban_fases f
  JOIN public.kanbans k ON k.id = f.kanban_id
  WHERE f.slug IN ('configurador_casas', 'stepone_configurador_casas')
    AND (k.id = '4d89f111-cef6-48aa-93ff-72d6406f0a32'::uuid
      OR (k.nome = 'Funil Step One' AND COALESCE(k.ativo, true) = true))
    AND COALESCE(f.ativo, true) = true
  ORDER BY CASE WHEN f.slug = 'configurador_casas' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '327: fase configurador_casas não encontrada; pulando.';
    RETURN;
  END IF;

  DELETE FROM public.kanban_fase_checklist_respostas r
  USING public.kanban_fase_checklist_itens i
  WHERE r.item_id = i.id AND i.fase_id = v_fase_id;

  DELETE FROM public.kanban_fase_checklist_itens WHERE fase_id = v_fase_id;

  INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
  VALUES
    (v_fase_id, 1, 'Configurador de casas aplicado', 'checkbox', true, true,
     'Marque após configurar cada modelo candidato no configurador Moní e registrar os custos por faixa.'),
    (v_fase_id, 2, 'Casas ranqueadas na Pré Batalha — custo por faixa', 'configurador_casas_ranking', true, true,
     'Lista única de modelos ordenada por pódios na Pré Batalha, com custo do configurador em cada faixa.');

  UPDATE public.kanban_fases
  SET instrucoes = $instr$
Com os modelos ranqueados na Pré Batalha, use o Configurador de Casas Moní para cada candidato:

1. Abra o configurador (moni-configurador.vercel.app — senha FKMONI)
2. Selecione o modelo, configure opcionais e acabamentos
3. Gere o PDF e registre o **custo de construção** na tabela abaixo — uma coluna por faixa de mercado
4. Marque «Configurador de casas aplicado» ao concluir

A tabela lista cada modelo **uma única vez**, ordenado por quantidade de 1º, 2º e 3º lugares na Pré Batalha, e indica em quais faixas cada casa ficou no pódio (até 3º).
$instr$
  WHERE id = v_fase_id;
END;
$$;
