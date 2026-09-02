-- 332: Funil Loteadores — widget rede_loteador na fase Dados do Loteador + FK no card.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS rede_loteador_id UUID REFERENCES public.rede_loteadores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kanban_cards_rede_loteador_id
  ON public.kanban_cards (rede_loteador_id);

COMMENT ON COLUMN public.kanban_cards.rede_loteador_id IS
  'Loteador vinculado ao card (cadastro em rede_loteadores), preenchido na fase Dados do Loteador.';

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
    'bca_condominio',
    'rede_loteador'
  ));

DO $$
DECLARE
  v_fase_id UUID;
BEGIN
  SELECT f.id
  INTO v_fase_id
  FROM public.kanban_fases f
  JOIN public.kanbans k ON k.id = f.kanban_id
  WHERE f.slug = 'dados_loteador_moni_inc'
    AND k.id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
    AND COALESCE(f.ativo, true) = true
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    SELECT f.id
    INTO v_fase_id
    FROM public.kanban_fases f
    JOIN public.kanbans k ON k.id = f.kanban_id
    WHERE f.slug = 'dados_loteador_moni_inc'
      AND k.nome = 'Funil Loteadores'
      AND COALESCE(f.ativo, true) = true
    LIMIT 1;
  END IF;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '332: fase Dados do Loteador não encontrada; pulando checklist.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_id
      AND tipo = 'rede_loteador'
  ) THEN
    INSERT INTO public.kanban_fase_checklist_itens (
      fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder
    )
    VALUES (
      v_fase_id,
      1,
      'Cadastro do loteador (Rede de Loteadores)',
      'rede_loteador',
      true,
      false,
      'Cadastre um novo loteador ou selecione um existente na Rede de Loteadores. Os dados ficam sincronizados com /rede-franqueados.'
    );
  END IF;

  UPDATE public.kanban_fases
  SET instrucoes = $instr$
Preencha a ficha completa do loteador. Você pode **cadastrar um novo** loteador (cria registro em Rede de Franqueados → Rede de Loteadores) ou **selecionar um loteador já cadastrado** e complementar os dados.

Campos obrigatórios mínimos: nome do loteador.
$instr$
  WHERE id = v_fase_id
    AND (instrucoes IS NULL OR btrim(instrucoes) = '');
END;
$$;
