-- Ao aprovar corretor: gera link do simulador e dispara e-mail (Edge Function).
-- Requer: extensão pg_net; setting app.supabase_service_key (service role) no banco.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

ALTER TABLE public.rede_corretores
  ADD COLUMN IF NOT EXISTS link_simulador text,
  ADD COLUMN IF NOT EXISTS email_enviado_em timestamptz;

ALTER TABLE public.rede_corretores
  DROP CONSTRAINT IF EXISTS rede_corretores_status_check;

ALTER TABLE public.rede_corretores
  ADD CONSTRAINT rede_corretores_status_check
  CHECK (status IN ('ativo', 'inativo', 'em_analise', 'pendente', 'aprovado'));

CREATE OR REPLACE FUNCTION public.fn_corretor_aprovado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  base_url text := 'https://simulador.moni.casa'; -- trocar pelo domínio real depois
  edge_url text := 'https://aydryzoxqnwnbybvgiug.supabase.co/functions/v1/email-corretor-aprovado';
  link     text;
  service_key text;
BEGIN
  IF NEW.status = 'aprovado' AND (OLD.status IS DISTINCT FROM 'aprovado') THEN
    link := base_url || '/formulario?corretor_id=' || NEW.id::text;
    NEW.link_simulador   := link;
    NEW.email_enviado_em := NULL;

    IF NEW.email IS NOT NULL THEN
      service_key := current_setting('app.supabase_service_key', true);
      IF service_key IS NOT NULL AND btrim(service_key) <> '' THEN
        PERFORM net.http_post(
          url     := edge_url,
          headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || service_key
          ),
          body := jsonb_build_object(
            'corretor_id',    NEW.id,
            'nome',           NEW.nome,
            'email',          NEW.email,
            'link_simulador', link
          )
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_corretor_aprovado ON public.rede_corretores;

CREATE TRIGGER trg_corretor_aprovado
  BEFORE UPDATE OF status ON public.rede_corretores
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_corretor_aprovado();

COMMENT ON FUNCTION public.fn_corretor_aprovado() IS
  'Gera link_simulador e chama Edge email-corretor-aprovado quando status vira aprovado. Requer ALTER DATABASE … SET app.supabase_service_key.';
