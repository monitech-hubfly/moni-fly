-- Percentuais e m² dos dados do negócio estouravam numeric(5,2) / numeric(10,2)
-- ao salvar valor grande (ex.: VGV ou área com milhar). Alarga nas duas tabelas.

ALTER TABLE public.processo_step_one
  ALTER COLUMN pct_compra_parcial_terreno TYPE numeric(14,2),
  ALTER COLUMN pct_vgv_terrenista TYPE numeric(14,2),
  ALTER COLUMN m2_terreno TYPE numeric(14,2),
  ALTER COLUMN m2_casa TYPE numeric(14,2);

ALTER TABLE public.imob_empreendimentos
  ALTER COLUMN pct_compra_parcial_terreno TYPE numeric(14,2),
  ALTER COLUMN pct_vgv_terrenista TYPE numeric(14,2),
  ALTER COLUMN m2_terreno TYPE numeric(14,2),
  ALTER COLUMN m2_casa TYPE numeric(14,2);

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('663', 'dados_negocio_numeric_overflow')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
