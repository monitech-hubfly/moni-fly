-- 1) Referência a card de kanban em notificações.
--    `referencia_id` (BIGINT) continua a apontar para `sirene_chamados`; para cards usa-se UUID aqui.
ALTER TABLE public.sirene_notificacoes
  ADD COLUMN IF NOT EXISTS referencia_card_id UUID REFERENCES public.kanban_cards(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sirene_notificacoes_referencia_card
  ON public.sirene_notificacoes (referencia_card_id);

COMMENT ON COLUMN public.sirene_notificacoes.referencia_card_id IS
  'Card de kanban (ex.: rejeição de aprovação de fase). O pedido "referencia_id" para UUID usa esta coluna.';

-- 2) Bombeiro: ler cards com aprovação de fase pendente
DROP POLICY IF EXISTS "kanban_cards_select_bombeiro_aprov" ON public.kanban_cards;
CREATE POLICY "kanban_cards_select_bombeiro_aprov" ON public.kanban_cards
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.sirene_papeis sp WHERE sp.user_id = auth.uid() AND sp.papel = 'bombeiro')
    AND EXISTS (
      SELECT 1 FROM public.kanban_aprovacoes_fase a
      WHERE a.card_id = kanban_cards.id
        AND a.status = 'pendente'
    )
  );

-- 3) Bombeiro: ver nome do Frank que solicitou a aprovação
DROP POLICY IF EXISTS "profiles_select_bombeiro_aprov" ON public.profiles;
CREATE POLICY "profiles_select_bombeiro_aprov" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.sirene_papeis sp WHERE sp.user_id = auth.uid() AND sp.papel = 'bombeiro')
    AND EXISTS (
      SELECT 1 FROM public.kanban_aprovacoes_fase a
      WHERE a.solicitado_por = profiles.id
        AND a.status = 'pendente'
    )
  );

-- 4) Bombeiro: itens de checklist (contagem) para cards com aprovação pendente
DROP POLICY IF EXISTS "checklist_select_bombeiro_aprov" ON public.kanban_checklist_itens;
CREATE POLICY "checklist_select_bombeiro_aprov" ON public.kanban_checklist_itens
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.sirene_papeis sp WHERE sp.user_id = auth.uid() AND sp.papel = 'bombeiro')
    AND EXISTS (
      SELECT 1 FROM public.kanban_aprovacoes_fase a
      WHERE a.card_id = kanban_checklist_itens.card_id
        AND a.status = 'pendente'
    )
  );
