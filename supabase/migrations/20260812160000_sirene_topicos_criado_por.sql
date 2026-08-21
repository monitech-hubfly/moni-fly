-- 20260812160000: Campo criado_por em sirene_topicos para exibir quem abriu cada atividade
ALTER TABLE public.sirene_topicos
  ADD COLUMN IF NOT EXISTS criado_por UUID REFERENCES auth.users(id);
