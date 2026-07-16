-- 469: sirene_notificacoes — permitir INSERT autenticado (notificar outros usuários)
-- Causa: policy "sirene_notificacoes_own" FOR ALL com USING (user_id = auth.uid())
-- também valia como WITH CHECK no INSERT, bloqueando avisos a bombeiros/HDM/terceiros (42501).
-- Service role continua bypass; SELECT/UPDATE/DELETE permanecem só do dono.

DROP POLICY IF EXISTS "sirene_notificacoes_own" ON public.sirene_notificacoes;
DROP POLICY IF EXISTS "sirene_notificacoes_select_own" ON public.sirene_notificacoes;
DROP POLICY IF EXISTS "sirene_notificacoes_update_own" ON public.sirene_notificacoes;
DROP POLICY IF EXISTS "sirene_notificacoes_delete_own" ON public.sirene_notificacoes;
DROP POLICY IF EXISTS "sirene_notificacoes_insert_authenticated" ON public.sirene_notificacoes;

CREATE POLICY "sirene_notificacoes_select_own"
  ON public.sirene_notificacoes FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "sirene_notificacoes_update_own"
  ON public.sirene_notificacoes FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "sirene_notificacoes_delete_own"
  ON public.sirene_notificacoes FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "sirene_notificacoes_insert_authenticated"
  ON public.sirene_notificacoes FOR INSERT
  TO authenticated
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
