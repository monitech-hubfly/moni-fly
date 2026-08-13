-- 527: Padronização Loteadores — tags dependencia com token, Assinados como conversão.
-- Reversível. Idempotente.

DO $$
DECLARE
  v_kanban_id UUID := '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban_id) THEN
    SELECT id INTO v_kanban_id
    FROM public.kanbans
    WHERE nome IN ('Funil Loteadores', 'Funil Moní INC')
    ORDER BY CASE WHEN nome = 'Funil Loteadores' THEN 0 ELSE 1 END
    LIMIT 1;
  END IF;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '527: Funil Loteadores não encontrado — pulando.';
    RETURN;
  END IF;

  -- Tags dependencia:* passam a gravar o token CSS (frontend ignora hex).
  UPDATE public.kanban_tags
  SET cor = 'var(--moni-gold-400)'
  WHERE kanban_id = v_kanban_id
    AND nome IN ('dependencia:moni-capital', 'dependencia:divida', 'dependencia:comite');

  -- Conclusão do funil = Assinados (não Cto de Parceria).
  UPDATE public.kanban_fases
  SET fase_conversao = true
  WHERE kanban_id = v_kanban_id
    AND slug = 'assinados_moni_inc';

  UPDATE public.kanban_fases
  SET fase_conversao = false
  WHERE kanban_id = v_kanban_id
    AND slug IN (
      'contrato_parceria_moni_inc',
      'passagem_waysers_moni_inc',
      'fechar_contrato_moni_inc'
    )
    AND COALESCE(fase_conversao, false) = true;
END $$;

NOTIFY pgrst, 'reload schema';

-- Reversão (não executar no UP):
-- UPDATE kanban_tags SET cor = '#D4AD68' WHERE nome LIKE 'dependencia:%';
-- UPDATE kanban_fases SET fase_conversao = false WHERE slug = 'assinados_moni_inc';
