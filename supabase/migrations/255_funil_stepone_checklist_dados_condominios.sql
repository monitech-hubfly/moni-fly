-- 255: OBSOLETA — substituída pela 257 (pesquisa) e 258 (tabela só em Dados da Cidade).
-- Não execute em PROD se já rodou 257/258.
-- Funil Step One — checklist da fase Dados dos Condomínios (entrada central).
-- Tipo `condominio`: busca/seleção, quadra/lote e espelho do cadastro no checklist.

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
    'condominio'
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
    RAISE NOTICE '255: fase dados_condominios não encontrada; pulando.';
    RETURN;
  END IF;

  DELETE FROM public.kanban_fase_checklist_respostas r
  USING public.kanban_fase_checklist_itens i
  WHERE r.item_id = i.id
    AND i.fase_id = v_fase_id;

  DELETE FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id;

  INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
  VALUES
    (
      v_fase_id,
      1,
      'Condomínio do cadastro',
      'condominio',
      true,
      true,
      'Busque e selecione o condomínio; informe quadra e lote.'
    ),
    (
      v_fase_id,
      2,
      'Dados do cadastro',
      'tabela',
      false,
      true,
      'Colunas do cadastro em Rede → Condomínios (condomínio vinculado ao card).'
    );

  UPDATE public.kanban_fases
  SET instrucoes = $instr$
Preencha os dados do condomínio nos itens do checklist abaixo: selecione o condomínio no cadastro,
informe quadra e lote. Os campos do cadastro (endereço, tickets, giro e extrato) vêm de Rede → Condomínios
e aparecem automaticamente após a seleção.
$instr$
  WHERE id = v_fase_id;
END;
$$;
