-- 281: Funil Step One — Lotes Disponíveis por aba/condomínio (múltiplos lotes por sessão).

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
    'mapa_praca'
  ));

DO $$
DECLARE
  v_fase_id UUID;
BEGIN
  SELECT f.id
  INTO v_fase_id
  FROM public.kanban_fases f
  JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
  WHERE f.slug IN ('lotes_disponiveis', 'stepone_lotes')
    AND COALESCE(f.ativo, true) = true
  ORDER BY CASE WHEN f.slug = 'lotes_disponiveis' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '281: fase lotes_disponiveis não encontrada; pulando.';
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
    'Lotes por condomínio prospectado',
    'lotes_condominio',
    true,
    true,
    'Use as abas para cadastrar os lotes disponíveis de cada condomínio da Tabela de Condomínios (fase Dados da Cidade). Cada condomínio pode ter mais de um lote.'
  );

  UPDATE public.kanban_fases
  SET instrucoes = $instr$
Para cada condomínio prospectado na Tabela de Condomínios (fase Dados da Cidade), use as abas e cadastre todos os lotes disponíveis para venda.

Em cada sessão de condomínio você pode adicionar quantos lotes forem necessários. Preencha quadra, lote, área, valor, situação documental, fotos e atributos do lote.

Os dados ficam salvos na linha correspondente da tabela de condomínios. Se o condomínio estiver vinculado ao cadastro (Rede → Condomínios), os lotes também são sincronizados automaticamente.
$instr$
  WHERE id = v_fase_id;
END;
$$;
