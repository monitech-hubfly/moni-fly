-- ─── 099: Reabilitar RLS com políticas permissivas (debug → produção) ─────────
-- Executado manualmente no DEV após desabilitar RLS para diagnóstico.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co
--
-- Diferença em relação a 091/094:
--   kanban_cards_select → USING (true)  [antes: franqueado_id = auth.uid() OR admin]
--   kanban_cards_insert → auth.uid() IS NOT NULL  [antes: franqueado_id check]
--   kanban_cards_update → auth.uid() IS NOT NULL  [antes: role check]

-- ─── 1. Reabilitar RLS ────────────────────────────────────────────────────────
ALTER TABLE public.kanban_cards  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanbans       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_fases  ENABLE ROW LEVEL SECURITY;

-- ─── 2. kanbans: leitura pública ─────────────────────────────────────────────
DROP POLICY IF EXISTS "kanbans_select_all" ON public.kanbans;
CREATE POLICY "kanbans_select_all" ON public.kanbans
  FOR SELECT USING (true);

-- ─── 3. kanban_fases: leitura pública ────────────────────────────────────────
DROP POLICY IF EXISTS "kanban_fases_select_all" ON public.kanban_fases;
CREATE POLICY "kanban_fases_select_all" ON public.kanban_fases
  FOR SELECT USING (true);

-- ─── 4. kanban_cards: qualquer autenticado lê/escreve ────────────────────────
DROP POLICY IF EXISTS "kanban_cards_select" ON public.kanban_cards;
CREATE POLICY "kanban_cards_select" ON public.kanban_cards
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "kanban_cards_insert" ON public.kanban_cards;
CREATE POLICY "kanban_cards_insert" ON public.kanban_cards
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "kanban_cards_update" ON public.kanban_cards;
CREATE POLICY "kanban_cards_update" ON public.kanban_cards
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ─── 5. GRANTs ────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON public.kanbans                  TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.kanban_fases             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_cards     TO authenticated;
GRANT SELECT ON public.processo_card_checklist                  TO authenticated;
