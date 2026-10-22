-- Migration 650: Validação de Praça e Mercado sai de Portfólio e vai para Qualificação de Franqueados.
-- Aplicar DEV primeiro; PROD somente com confirmação explícita.

UPDATE public.formularios
SET categoria = 'Qualificação de Franqueados'
WHERE id = 'form-portfolio-validacao-praca'
  AND categoria IS DISTINCT FROM 'Qualificação de Franqueados';

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('650', 'form_pvp_categoria_qualificacao')
ON CONFLICT (version) DO NOTHING;
