-- ========================================
-- CORRIGIR RLS DE kanban_atividades
-- Execute no Supabase SQL Editor
-- ========================================

-- Problema: "permission denied for table kanban_atividades"
-- Causa: RLS está ativo mas as policies podem não estar criadas corretamente

-- PASSO 1: Verificar se a tabela existe
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'kanban_atividades';

-- Se não existir, a migration 103 não foi rodada!

-- PASSO 2: Verificar RLS
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'kanban_atividades';

-- PASSO 3: Verificar policies existentes
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'kanban_atividades';

-- ========================================
-- SOLUÇÃO: Recriar policies corretamente
-- ========================================

-- Remover policies antigas (se existirem)
DROP POLICY IF EXISTS kanban_atividades_select ON public.kanban_atividades;
DROP POLICY IF EXISTS kanban_atividades_insert ON public.kanban_atividades;
DROP POLICY IF EXISTS kanban_atividades_update ON public.kanban_atividades;
DROP POLICY IF EXISTS kanban_atividades_delete ON public.kanban_atividades;

-- Garantir que RLS está ativo
ALTER TABLE public.kanban_atividades ENABLE ROW LEVEL SECURITY;

-- ===== Policy: SELECT =====
-- Admin/consultor vê tudo, franqueado vê apenas atividades dos seus cards
CREATE POLICY kanban_atividades_select ON public.kanban_atividades
FOR SELECT
USING (
  -- Admin ou consultor
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'consultor')
  )
  OR
  -- Franqueado vê atividades dos seus cards
  EXISTS (
    SELECT 1 FROM public.kanban_cards
    WHERE kanban_cards.id = kanban_atividades.card_id
      AND kanban_cards.franqueado_id = auth.uid()
  )
);

-- ===== Policy: INSERT =====
-- Admin/consultor insere em qualquer card, franqueado apenas em seus cards
CREATE POLICY kanban_atividades_insert ON public.kanban_atividades
FOR INSERT
WITH CHECK (
  -- Admin ou consultor
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'consultor')
  )
  OR
  -- Franqueado insere apenas em seus cards
  EXISTS (
    SELECT 1 FROM public.kanban_cards
    WHERE kanban_cards.id = kanban_atividades.card_id
      AND kanban_cards.franqueado_id = auth.uid()
  )
);

-- ===== Policy: UPDATE =====
-- Mesma lógica do SELECT
CREATE POLICY kanban_atividades_update ON public.kanban_atividades
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'consultor')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.kanban_cards
    WHERE kanban_cards.id = kanban_atividades.card_id
      AND kanban_cards.franqueado_id = auth.uid()
  )
);

-- ===== Policy: DELETE =====
-- Mesma lógica do SELECT
CREATE POLICY kanban_atividades_delete ON public.kanban_atividades
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'consultor')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.kanban_cards
    WHERE kanban_cards.id = kanban_atividades.card_id
      AND kanban_cards.franqueado_id = auth.uid()
  )
);

-- ========================================
-- VERIFICAÇÃO FINAL
-- ========================================

-- Ver policies criadas
SELECT policyname, cmd, permissive, roles, qual, with_check
FROM pg_policies 
WHERE tablename = 'kanban_atividades'
ORDER BY cmd;

-- Testar SELECT (deve retornar dados ou vazio, não erro)
SELECT COUNT(*) FROM kanban_atividades;

-- ========================================
-- SE AINDA DER ERRO
-- ========================================

-- Opção 1: TEMPORARIAMENTE desabilitar RLS (APENAS EM DEV!)
-- ALTER TABLE public.kanban_atividades DISABLE ROW LEVEL SECURITY;

-- Opção 2: Ver qual usuário está logado
-- SELECT auth.uid(), email, role FROM profiles WHERE id = auth.uid();

-- Opção 3: Ver se o card pertence ao usuário
-- SELECT 
--   ka.id AS atividade_id,
--   ka.card_id,
--   kc.franqueado_id,
--   auth.uid() AS meu_id,
--   (kc.franqueado_id = auth.uid()) AS sou_dono
-- FROM kanban_atividades ka
-- JOIN kanban_cards kc ON kc.id = ka.card_id
-- LIMIT 5;
