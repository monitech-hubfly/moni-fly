-- Incluir role 'supervisor' em profiles (Moní admin e supervisor acessam Processo seletivo candidatos)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('frank', 'consultor', 'admin', 'supervisor'));
