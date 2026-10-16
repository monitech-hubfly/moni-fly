-- 580_faq_so_categorias_2026.sql
-- A Central de Ajuda fica só com as 10 categorias do FAQ 2026.
-- As demais categorias saem da grade e os artigos delas são arquivados.
-- Idempotente.

BEGIN;

UPDATE public.faq_categories
SET is_active = false
WHERE slug NOT IN (
  'terrenos',
  'aprovacoes',
  'obra',
  'tecnologia',
  'entrega',
  'monicare',
  'marca',
  'suporte',
  'contratos',
  'permuta'
)
AND is_active IS DISTINCT FROM false;

UPDATE public.faq_articles
SET status = 'archived'
WHERE status IS DISTINCT FROM 'archived'
  AND category_id IN (
    SELECT id
    FROM public.faq_categories
    WHERE slug NOT IN (
      'terrenos',
      'aprovacoes',
      'obra',
      'tecnologia',
      'entrega',
      'monicare',
      'marca',
      'suporte',
      'contratos',
      'permuta'
    )
  );

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('580', 'faq_so_categorias_2026')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';

COMMIT;
