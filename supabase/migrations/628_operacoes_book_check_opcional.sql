-- 628: Book do empreendimento e Check Análise de Crédito deixam de ser
-- obrigatórios no Funil Pré Obra e Obra. Idempotente. Não move cards.

UPDATE public.kanban_fase_checklist_itens i
SET obrigatorio = false
FROM public.kanban_fases f
JOIN public.kanbans k ON k.id = f.kanban_id
WHERE i.fase_id = f.id
  AND k.nome IN ('Funil Pré Obra e Obra', 'Funil Operações')
  AND (
    i.campo_slug IN ('book_empreendimento', 'check_analise_credito')
    OR i.chave_compartilhada IN ('negocio:book_empreendimento', 'negocio:check_analise_credito')
  )
  AND i.obrigatorio IS DISTINCT FROM false;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('628', 'operacoes_book_check_opcional')
ON CONFLICT (version) DO NOTHING;
