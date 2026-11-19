-- 693: Condomínios — site e campos do Livro do Empreendimento.
-- O cadastro envia site_url. Sem a coluna o PostgREST recusa o insert
-- ("Could not find the 'site_url' column of 'condominios' in the schema cache").
-- Idempotente. Já existia em DEV (20261105100000); falta em PROD.

ALTER TABLE public.condominios
  ADD COLUMN IF NOT EXISTS site_url                  text,
  ADD COLUMN IF NOT EXISTS livro_foto_principal       text,
  ADD COLUMN IF NOT EXISTS livro_foto_secundaria      text,
  ADD COLUMN IF NOT EXISTS livro_frase_principal      text,
  ADD COLUMN IF NOT EXISTS livro_frase_secundaria     text,
  ADD COLUMN IF NOT EXISTS livro_subtitulo            text,
  ADD COLUMN IF NOT EXISTS livro_vantagens_localizacao jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.condominios.site_url IS
  'Site do condomínio. Usado no cadastro e no Livro do Empreendimento.';

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('693', 'condominios_site_url_livro')
ON CONFLICT (version) DO NOTHING;
