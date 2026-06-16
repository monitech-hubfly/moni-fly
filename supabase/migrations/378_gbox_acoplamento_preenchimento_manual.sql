-- 378: Gbox e Acoplamento — preenchimento manual (sem espelhamento automático).

UPDATE public.kanban_fase_checklist_itens i
SET config_json = COALESCE(i.config_json, '{}'::jsonb)
  - 'readonly'
  - 'sync_from'
FROM public.kanban_fases f
INNER JOIN public.kanbans k ON k.id = f.kanban_id
WHERE i.fase_id = f.id
  AND k.nome IN ('Funil Loteadores', 'Funil Moní INC')
  AND f.slug = 'acoplamento_moni_inc'
  AND i.campo_slug IN ('link_gbox', 'link_acoplamento');
