-- 554: Prazo total (meses) da oferta Helena no empreendimento IMOB.
-- Fase 1 + Fase 2 = último mês do fluxo (quantidade_parcelas_total).
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co
-- Não aplicar em PROD sem revisão da Ingrid.

ALTER TABLE public.imob_card_empreendimentos
  ADD COLUMN IF NOT EXISTS prazo_total_meses integer;

COMMENT ON COLUMN public.imob_card_empreendimentos.prazo_total_meses IS
  'Prazo total da oferta Helena em meses (Fase 1 + Fase 2). Somente leitura no card.';

-- Backfill a partir da oferta já vinculada.
UPDATE public.imob_card_empreendimentos e
SET prazo_total_meses = COALESCE(
  CASE
    WHEN (s.resultado->>'quantidade_parcelas_total') ~ '^[0-9]+(\.[0-9]+)?$'
    THEN ROUND((s.resultado->>'quantidade_parcelas_total')::numeric)::integer
    ELSE NULL
  END,
  CASE
    WHEN s.prazo_meses IS NULL THEN NULL
    WHEN COALESCE(t.prazo_obra_meses, t.prazo_desembolso_sugerido, 7) > 0
     AND s.prazo_meses > COALESCE(t.prazo_obra_meses, t.prazo_desembolso_sugerido, 7)
    THEN s.prazo_meses
    ELSE s.prazo_meses + COALESCE(t.prazo_obra_meses, t.prazo_desembolso_sugerido, 7)
  END
)
FROM public.simulacoes_pagamento s
LEFT JOIN public.loteamento_simulador_templates t ON t.id = s.template_id
WHERE e.simulacao_pagamento_id = s.id
  AND e.prazo_total_meses IS NULL;

DO $$
BEGIN
  INSERT INTO supabase_migrations.schema_migrations (version, name)
  VALUES ('554', 'imob_oferta_prazo_total_meses')
  ON CONFLICT (version) DO NOTHING;
EXCEPTION
  WHEN undefined_column THEN
    INSERT INTO supabase_migrations.schema_migrations (version)
    VALUES ('554')
    ON CONFLICT (version) DO NOTHING;
  WHEN undefined_table THEN
    NULL;
END $$;

NOTIFY pgrst, 'reload schema';
