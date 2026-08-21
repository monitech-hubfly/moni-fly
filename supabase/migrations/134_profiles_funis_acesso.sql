-- Kanbans permitidos (Time + Estagiário): valores = public.kanbans.nome
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS funis_acesso TEXT[] DEFAULT NULL;

COMMENT ON COLUMN public.profiles.funis_acesso IS
  'Lista de kanbans.nome acessíveis; usado para Time + estagiário. NULL = não aplicável ou sem restrição por esta lista.';
