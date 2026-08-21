-- 257: Funil Step One — pesquisa de mercado por condomínio prospectado (fase Dados dos Condomínios).

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
    'pesquisa_condominio'
  ));

DO $$
DECLARE
  v_fase_id UUID;
BEGIN
  SELECT f.id
  INTO v_fase_id
  FROM public.kanban_fases f
  JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
  WHERE f.slug IN ('dados_condominios', 'stepone_dados_cond')
    AND COALESCE(f.ativo, true) = true
  ORDER BY CASE WHEN f.slug = 'dados_condominios' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '257: fase dados_condominios não encontrada; pulando.';
    RETURN;
  END IF;

  DELETE FROM public.kanban_fase_checklist_respostas r
  USING public.kanban_fase_checklist_itens i
  WHERE r.item_id = i.id
    AND i.fase_id = v_fase_id;

  DELETE FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id;

  INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
  VALUES (
    v_fase_id,
    1,
    'Pesquisa de condomínios prospectados',
    'pesquisa_condominio',
    true,
    true,
    'Selecione cada condomínio da tabela (fase Dados da Cidade) e responda todas as perguntas da metodologia.'
  );

  UPDATE public.kanban_fases
  SET instrucoes = $instr$
Realize a pesquisa de mercado para cada condomínio prospectado na fase Dados da Cidade (item "Tabela de Condomínios").

Para cada condomínio, responda todas as perguntas usando três fontes: pesquisa online, contato com corretores e destaques.
Use o painel de metodologia no checklist para orientar a seleção e a abordagem padrão aos corretores.

As respostas ficam salvas na linha correspondente da tabela de condomínios (fase anterior).
$instr$
  WHERE id = v_fase_id;
END;
$$;
