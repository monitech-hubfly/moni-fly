-- 607: colunas novas de Dados do Negócio em processo_step_one.
-- O seed dos checklists do Funil Portfólio fica na 608.
-- Idempotente.

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS pct_compra_parcial_terreno NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS pct_vgv_terrenista         NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS m2_terreno                  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS m2_casa                     NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS extrato_modelo_configurado  TEXT,
  ADD COLUMN IF NOT EXISTS data_aprovacao_comite       DATE,
  ADD COLUMN IF NOT EXISTS obs_opcao                   TEXT,
  ADD COLUMN IF NOT EXISTS data_ass_opcao_terreno      DATE,
  ADD COLUMN IF NOT EXISTS obs_instrumento_garantidor  TEXT,
  ADD COLUMN IF NOT EXISTS data_ass_contrato_terreno   DATE,
  ADD COLUMN IF NOT EXISTS valor_recompra             TEXT;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('607', 'dados_negocio_novos_campos')
ON CONFLICT (version) DO NOTHING;
