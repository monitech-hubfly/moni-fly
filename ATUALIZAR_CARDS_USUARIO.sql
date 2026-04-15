-- ========================================
-- ATUALIZAR CARDS PARA O USUÁRIO ATUAL
-- Execute no Supabase Dashboard > SQL Editor
-- ========================================

-- Este script atualiza todos os cards do Funil Step One
-- para serem associados ao usuário que está executando o script

DO $$
DECLARE
  v_user_id UUID;
  v_kanban_id UUID;
  v_updated_count INT;
BEGIN
  -- Pega o ID do usuário atual (quem está executando)
  SELECT auth.uid() INTO v_user_id;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuário logado. Faça login no Supabase Dashboard primeiro.';
  END IF;

  -- Busca o Kanban "Funil Step One"
  SELECT id INTO v_kanban_id
  FROM public.kanbans
  WHERE nome = 'Funil Step One'
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE EXCEPTION 'Kanban "Funil Step One" não encontrado';
  END IF;

  -- Atualiza todos os cards deste kanban para o usuário atual
  UPDATE public.kanban_cards
  SET franqueado_id = v_user_id
  WHERE kanban_id = v_kanban_id
    AND status = 'ativo';
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RAISE NOTICE '✅ % card(s) atualizados para o usuário: %', v_updated_count, v_user_id;
  RAISE NOTICE 'Atualize a página http://localhost:3000/funil-stepone para ver os cards!';
END;
$$;

-- Verifica os cards agora associados ao usuário atual
SELECT 
  c.id,
  c.titulo,
  f.nome as fase,
  p.full_name as responsavel,
  c.created_at,
  c.status
FROM public.kanban_cards c
JOIN public.kanban_fases f ON c.fase_id = f.id
JOIN public.kanbans k ON c.kanban_id = k.id
LEFT JOIN public.profiles p ON c.franqueado_id = p.id
WHERE k.nome = 'Funil Step One'
  AND c.status = 'ativo'
ORDER BY f.ordem, c.created_at DESC;
