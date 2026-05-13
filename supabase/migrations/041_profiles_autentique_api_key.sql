-- Chave API do Autentique por usuário: documento enviado para assinatura usa o login de quem está logado na ferramenta.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS autentique_api_key TEXT;

COMMENT ON COLUMN public.profiles.autentique_api_key IS 'Chave API do Autentique (painel) do usuário. Ao enviar documento para assinatura, usa esta chave; se vazia, usa AUTENTIQUE_API_KEY do ambiente.';
