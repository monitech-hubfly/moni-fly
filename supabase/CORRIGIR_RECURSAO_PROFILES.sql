-- Cole este conteúdo no SQL Editor do Supabase e clique em Run.
-- Corrige o erro "infinite recursion detected in policy for relation 'profiles'".

-- Função que retorna o role do usuário atual (não dispara RLS na leitura)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Remover políticas que causam recursão e recriar usando get_my_role()
DROP POLICY IF EXISTS "Admin can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Consultor can read Franks in portfolio" ON public.profiles;

CREATE POLICY "Admin can read all profiles" ON public.profiles
  FOR SELECT USING (public.get_my_role() = 'admin');

CREATE POLICY "Consultor can read Franks in portfolio" ON public.profiles
  FOR SELECT USING (
    public.get_my_role() = 'consultor' AND consultor_id = auth.uid()
  );
