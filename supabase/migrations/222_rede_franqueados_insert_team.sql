-- Time interno pode cadastrar novos franqueados na rede (modal Novo Franqueado).

DROP POLICY IF EXISTS "rede_franqueados_insert_team" ON public.rede_franqueados;
CREATE POLICY "rede_franqueados_insert_team"
  ON public.rede_franqueados FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'team'));

NOTIFY pgrst, 'reload schema';
