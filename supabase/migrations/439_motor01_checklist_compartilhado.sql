-- 439: Funil Motor 01 — campos compartilhados entre fases + exclusividade «Seguir com Modelo N»
-- Idempotente. Não migra dados de kanban_fase_checklist_respostas.

-- ─── Colunas de metadados nos itens ─────────────────────────────────────────
ALTER TABLE public.kanban_fase_checklist_itens
  ADD COLUMN IF NOT EXISTS chave_compartilhada text,
  ADD COLUMN IF NOT EXISTS grupo_exclusivo text;

-- ─── Valores compartilhados por card ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kanban_card_checklist_compartilhado (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id       uuid NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  chave         text NOT NULL,
  valor         jsonb,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid REFERENCES public.profiles(id),
  UNIQUE (card_id, chave)
);

CREATE INDEX IF NOT EXISTS idx_card_checklist_compartilhado_card
  ON public.kanban_card_checklist_compartilhado(card_id);

ALTER TABLE public.kanban_card_checklist_compartilhado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "card_checklist_compartilhado_select" ON public.kanban_card_checklist_compartilhado;
CREATE POLICY "card_checklist_compartilhado_select" ON public.kanban_card_checklist_compartilhado
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "card_checklist_compartilhado_upsert" ON public.kanban_card_checklist_compartilhado;
CREATE POLICY "card_checklist_compartilhado_upsert" ON public.kanban_card_checklist_compartilhado
  FOR ALL USING (auth.role() = 'authenticated');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_card_checklist_compartilhado TO authenticated;
GRANT ALL ON public.kanban_card_checklist_compartilhado TO service_role;

-- ─── Marcar itens Motor 01 (6 fases) ─────────────────────────────────────────
-- «Ajustes solicitados N» permanece com chave_compartilhada NULL (não sincronizar).
UPDATE public.kanban_fase_checklist_itens i
SET
  chave_compartilhada = CASE
    WHEN i.label ~ '^Modelo [123]$'
      THEN 'modelo_' || substring(i.label FROM 'Modelo ([123])')
    WHEN i.label ~ '^Implantação Modelo [123]$'
      THEN 'implantacao_modelo_' || substring(i.label FROM 'Implantação Modelo ([123])')
    WHEN i.label ~ '^Gbox Modelo [123]$'
      THEN 'gbox_modelo_' || substring(i.label FROM 'Gbox Modelo ([123])')
    WHEN i.label ~ '^Imagens Modelo [123]$'
      THEN 'imagens_modelo_' || substring(i.label FROM 'Imagens Modelo ([123])')
    WHEN i.label ~ '^Simulador Modelo [123]$'
      THEN 'simulador_modelo_' || substring(i.label FROM 'Simulador Modelo ([123])')
    WHEN i.label ~ '^Possibilidades de Fachada [123]$'
      THEN 'possibilidades_fachada_' || substring(i.label FROM 'Possibilidades de Fachada ([123])')
    WHEN i.label ~ '^Fachada escolhida [123]$'
      THEN 'fachada_escolhida_' || substring(i.label FROM 'Fachada escolhida ([123])')
    WHEN i.label ~ '^Seguir com Modelo [123]$'
      THEN 'seguir_modelo_' || substring(i.label FROM 'Seguir com Modelo ([123])')
    ELSE i.chave_compartilhada
  END,
  grupo_exclusivo = CASE
    WHEN i.label ~ '^Seguir com Modelo [123]$' THEN 'seguir_modelo'
    ELSE NULL
  END
FROM public.kanban_fases kf
WHERE i.fase_id = kf.id
  AND kf.slug IN (
    'm1_acoplamento',
    'm1_r02',
    'm1_execucao_casa',
    'm1_r03',
    'm1_ajustes',
    'm1_r04_ajustes'
  )
  AND (
    i.label ~ '^Modelo [123]$'
    OR i.label ~ '^Implantação Modelo [123]$'
    OR i.label ~ '^Gbox Modelo [123]$'
    OR i.label ~ '^Imagens Modelo [123]$'
    OR i.label ~ '^Simulador Modelo [123]$'
    OR i.label ~ '^Possibilidades de Fachada [123]$'
    OR i.label ~ '^Fachada escolhida [123]$'
    OR i.label ~ '^Seguir com Modelo [123]$'
  );

DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.kanban_fase_checklist_itens i
  JOIN public.kanban_fases kf ON kf.id = i.fase_id
  WHERE kf.slug IN (
    'm1_acoplamento', 'm1_r02', 'm1_execucao_casa',
    'm1_r03', 'm1_ajustes', 'm1_r04_ajustes'
  )
    AND i.chave_compartilhada IS NOT NULL;

  RAISE NOTICE '439: itens com chave_compartilhada = % (esperado ~126)', v_count;
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('439', 'motor01_checklist_compartilhado')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
