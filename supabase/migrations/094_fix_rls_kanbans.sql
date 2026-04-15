-- ─── 094: Corrige RLS e GRANT das tabelas kanbans e kanban_fases ─────────────
-- Problema: página /funil-stepone retorna "Kanban não encontrado" mesmo com
-- dados presentes no banco. Causa provável: RLS bloqueando SELECT ou falta
-- de GRANT para os roles anon/authenticated.
--
-- Diagnóstico: execute os SELECTs abaixo para ver o estado atual antes de rodar.

-- ─── Diagnóstico: políticas existentes ───────────────────────────────────────
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN ('kanbans', 'kanban_fases')
-- ORDER BY tablename, policyname;

-- ─── Diagnóstico: grants existentes ──────────────────────────────────────────
-- SELECT grantee, table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_name IN ('kanbans', 'kanban_fases')
--   AND table_schema = 'public'
-- ORDER BY table_name, grantee;

-- ─── 1. kanbans: garantir RLS ativo e política de leitura ────────────────────
ALTER TABLE public.kanbans ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas (qualquer nome) para evitar conflito
DROP POLICY IF EXISTS "kanbans_select"     ON public.kanbans;
DROP POLICY IF EXISTS "kanbans_select_all" ON public.kanbans;
DROP POLICY IF EXISTS "kanbans_admin"      ON public.kanbans;

-- Leitura: qualquer usuário autenticado (ou anônimo) pode ver kanbans
CREATE POLICY "kanbans_select_all"
  ON public.kanbans FOR SELECT
  USING (true);

-- Escrita: apenas admin/consultor
CREATE POLICY "kanbans_admin"
  ON public.kanbans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'consultor')
    )
  );

-- Grant explícito para os roles do Supabase
GRANT SELECT ON public.kanbans TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.kanbans TO authenticated;

-- ─── 2. kanban_fases: garantir RLS ativo e política de leitura ───────────────
ALTER TABLE public.kanban_fases ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas
DROP POLICY IF EXISTS "kanban_fases_select"     ON public.kanban_fases;
DROP POLICY IF EXISTS "kanban_fases_select_all" ON public.kanban_fases;
DROP POLICY IF EXISTS "kanban_fases_admin"      ON public.kanban_fases;

-- Leitura: qualquer usuário pode ver as fases
CREATE POLICY "kanban_fases_select_all"
  ON public.kanban_fases FOR SELECT
  USING (true);

-- Escrita: apenas admin/consultor
CREATE POLICY "kanban_fases_admin"
  ON public.kanban_fases FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'consultor')
    )
  );

-- Grant explícito
GRANT SELECT ON public.kanban_fases TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.kanban_fases TO authenticated;

-- ─── 3. Confirmação final ─────────────────────────────────────────────────────
-- Deve mostrar as 2 políticas "_select_all" recém criadas:
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('kanbans', 'kanban_fases')
ORDER BY tablename, policyname;

-- Deve retornar 1 kanban:
SELECT id, nome, ativo FROM public.kanbans WHERE nome = 'Funil Step One';

-- Deve retornar 7 fases:
SELECT kf.nome, kf.ordem, kf.sla_dias
FROM public.kanban_fases kf
JOIN public.kanbans k ON k.id = kf.kanban_id
WHERE k.nome = 'Funil Step One'
ORDER BY kf.ordem;
