-- O e-mail de aprovação e o lembrete de quinta saem pelo aplicativo,
-- com o link da jornada de cada empreendimento + o id do corretor.
-- Esta função deixa de gravar o formulário genérico do simulador e de chamar
-- a Edge email-corretor-aprovado.

ALTER TABLE public.rede_corretores
  ADD COLUMN IF NOT EXISTS links_lembrete_em timestamptz;

COMMENT ON COLUMN public.rede_corretores.links_lembrete_em IS
  'Último lembrete de quinta-feira com os links da jornada enviados ao corretor.';

CREATE OR REPLACE FUNCTION public.fn_corretor_aprovado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'aprovado' AND (OLD.status IS DISTINCT FROM 'aprovado') THEN
    NEW.link_simulador := NULL;
    NEW.email_enviado_em := NULL;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_corretor_aprovado() IS
  'Ao aprovar, limpa o link antigo do simulador. Os links da jornada e o e-mail são enviados pelo aplicativo.';

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('641', 'corretor_links_jornada')
ON CONFLICT (version) DO NOTHING;
