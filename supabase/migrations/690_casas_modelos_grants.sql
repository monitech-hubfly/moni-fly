-- Grants das tabelas do Book do Empreendimento.
-- Sem isso a API (service_role) recebe permission denied, mesmo com RLS.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.casas_modelos TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.livros_empreendimento TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
