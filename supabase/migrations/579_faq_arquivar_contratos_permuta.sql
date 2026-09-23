-- 579_faq_arquivar_contratos_permuta.sql
-- Mantem publicado apenas o artigo revisado de Contratos e de Permuta.
-- Os slugs pedido (contrato-franquia-estrutura, permuta-como-funciona) nao existiam:
-- o revisado conservou o slug antigo. Esta migration renomeia e depois arquiva o resto.
-- Idempotente.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.faq_articles a
    JOIN public.faq_categories c ON c.id = a.category_id
    WHERE c.slug = 'contratos'
      AND a.question = 'A Moní ainda utiliza Seguro Garantia? Qual é a garantia atual entregue ao terrenista?'
  ) THEN
    RAISE EXCEPTION 'artigo revisado de contratos nao encontrado';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.faq_articles a
    JOIN public.faq_categories c ON c.id = a.category_id
    WHERE c.slug = 'permuta'
      AND a.question ILIKE '%segurança do terrenista%'
      AND a.short_answer ILIKE '%Carta Fiança%'
  ) THEN
    RAISE EXCEPTION 'artigo revisado de permuta nao encontrado';
  END IF;
END $$;

UPDATE public.faq_articles
SET slug = 'contrato-franquia-estrutura'
WHERE category_id = (SELECT id FROM public.faq_categories WHERE slug = 'contratos')
  AND question = 'A Moní ainda utiliza Seguro Garantia? Qual é a garantia atual entregue ao terrenista?'
  AND slug IS DISTINCT FROM 'contrato-franquia-estrutura';

UPDATE public.faq_articles
SET slug = 'permuta-como-funciona'
WHERE category_id = (SELECT id FROM public.faq_categories WHERE slug = 'permuta')
  AND question ILIKE '%segurança do terrenista%'
  AND short_answer ILIKE '%Carta Fiança%'
  AND slug IS DISTINCT FROM 'permuta-como-funciona';

UPDATE public.faq_articles
SET status = 'archived'
WHERE category_id = (SELECT id FROM public.faq_categories WHERE slug = 'contratos')
  AND slug IS DISTINCT FROM 'contrato-franquia-estrutura';

UPDATE public.faq_articles
SET status = 'archived'
WHERE category_id = (SELECT id FROM public.faq_categories WHERE slug = 'permuta')
  AND slug IS DISTINCT FROM 'permuta-como-funciona';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('579', 'faq_arquivar_contratos_permuta')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';

COMMIT;
