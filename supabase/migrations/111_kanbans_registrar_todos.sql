-- ─── 111: Registrar todos os kanbans do sistema ──────────────────────────────
-- 1. Adiciona coluna descricao à tabela kanbans (sem quebrar dados existentes).
-- 2. Remove duplicatas de nome antes de criar a constraint UNIQUE.
-- 3. Adiciona UNIQUE (nome) idempotentemente.
-- 4. Insere os 5 kanbans canônicos via ON CONFLICT (nome) DO NOTHING.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ─── 1. Coluna descricao ──────────────────────────────────────────────────────
ALTER TABLE public.kanbans
  ADD COLUMN IF NOT EXISTS descricao TEXT;

COMMENT ON COLUMN public.kanbans.descricao IS
  'Descrição resumida do propósito do kanban.';

-- ─── 2. Remover duplicatas por nome ──────────────────────────────────────────
-- Mantém apenas a linha mais antiga (menor ctid) de cada nome.
-- Seguro mesmo se não houver duplicatas.
DELETE FROM public.kanbans
WHERE ctid NOT IN (
  SELECT min(ctid)
  FROM   public.kanbans
  GROUP  BY nome
);

-- ─── 3. UNIQUE (nome) idempotente ─────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname      = 'kanbans_nome_unique'
      AND  conrelid     = 'public.kanbans'::REGCLASS
  ) THEN
    ALTER TABLE public.kanbans
      ADD CONSTRAINT kanbans_nome_unique UNIQUE (nome);
  END IF;
END;
$$;

-- ─── 4. Seed: 5 kanbans canônicos ─────────────────────────────────────────────
INSERT INTO public.kanbans (nome, descricao, ordem, ativo) VALUES
  ('Funil Step One', 'Funil de viabilidade de novas franquias',  1, true),
  ('Portfolio',      'Gestão de portfolio de franquias',          2, true),
  ('Operações',      'Gestão operacional de franquias',           3, true),
  ('Contabilidade',  'Gestão contábil de franquias',              4, true),
  ('Crédito',        'Gestão de crédito de franquias',            5, true)
ON CONFLICT (nome) DO UPDATE
  SET descricao = EXCLUDED.descricao,
      ativo     = true
  WHERE public.kanbans.descricao IS NULL;

COMMENT ON TABLE public.kanbans IS
  'Boards de kanban do Hub Fly. '
  'Kanbans canônicos: Funil Step One, Portfolio, Operações, Contabilidade, Crédito.';
