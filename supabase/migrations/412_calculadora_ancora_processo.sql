-- 412: Âncora manual da calculadora (fim real de uma fase; recálculo a partir daí).

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS calculadora_ancora_fase_slug text,
  ADD COLUMN IF NOT EXISTS calculadora_ancora_data_fim date;

COMMENT ON COLUMN public.processo_step_one.calculadora_ancora_fase_slug IS
  'Slug da fase âncora na calculadora global (ex.: step_6 = Diligência).';
COMMENT ON COLUMN public.processo_step_one.calculadora_ancora_data_fim IS
  'Data fim real na fase âncora; etapas anteriores sem datas na timeline.';

-- FK0010 — Parque Ecoresidencial Fazenda Jequitibá
UPDATE public.processo_step_one ps
SET
  calculadora_ancora_fase_slug = 'step_6',
  calculadora_ancora_data_fim = '2026-06-08'::date
WHERE ps.id IN (
  SELECT COALESCE(
    NULLIF(TRIM(k.processo_step_one_id::text), '')::uuid,
    NULLIF(TRIM(k.projeto_id::text), '')::uuid
  )
  FROM public.kanban_cards k
  WHERE k.id = 'bbbc8819-4c28-4298-8bc3-14d70feb2bba'::uuid
)
AND ps.id IS NOT NULL;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('412', 'calculadora_ancora_processo')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
