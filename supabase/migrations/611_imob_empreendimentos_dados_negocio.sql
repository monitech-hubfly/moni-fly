-- 611: Campos de Dados do Negócio no Cadastro de Empreendimentos (Rede Casa Moní).
-- Idempotente.

ALTER TABLE public.imob_empreendimentos
  ADD COLUMN IF NOT EXISTS tipo_negocio text,
  ADD COLUMN IF NOT EXISTS pasta_drive text,
  ADD COLUMN IF NOT EXISTS valor_terreno text,
  ADD COLUMN IF NOT EXISTS pct_compra_parcial_terreno numeric(5,2),
  ADD COLUMN IF NOT EXISTS pct_vgv_terrenista numeric(5,2),
  ADD COLUMN IF NOT EXISTS divida_terreno text,
  ADD COLUMN IF NOT EXISTS m2_terreno numeric(10,2),
  ADD COLUMN IF NOT EXISTS contratos text,
  ADD COLUMN IF NOT EXISTS prazo_opcao jsonb,
  ADD COLUMN IF NOT EXISTS produto_modelo text,
  ADD COLUMN IF NOT EXISTS extrato_modelo_configurado text,
  ADD COLUMN IF NOT EXISTS m2_casa numeric(10,2),
  ADD COLUMN IF NOT EXISTS custo_obra text,
  ADD COLUMN IF NOT EXISTS divida_obra text,
  ADD COLUMN IF NOT EXISTS link_bca text,
  ADD COLUMN IF NOT EXISTS link_mapa_competidores text,
  ADD COLUMN IF NOT EXISTS vgv_pretendido text,
  ADD COLUMN IF NOT EXISTS valor_recompra text,
  ADD COLUMN IF NOT EXISTS link_acoplamento text,
  ADD COLUMN IF NOT EXISTS link_gbox text,
  ADD COLUMN IF NOT EXISTS link_apresentacao_comite text,
  ADD COLUMN IF NOT EXISTS data_aprovacao_comite date,
  ADD COLUMN IF NOT EXISTS prazo_instrumento_garantidor jsonb,
  ADD COLUMN IF NOT EXISTS link_projeto_legal text,
  ADD COLUMN IF NOT EXISTS link_docs_condominio text,
  ADD COLUMN IF NOT EXISTS data_aprovacao_condominio date,
  ADD COLUMN IF NOT EXISTS data_aprovacao_prefeitura date,
  ADD COLUMN IF NOT EXISTS data_emissao_alvara date,
  ADD COLUMN IF NOT EXISTS data_envio_credito_obra date,
  ADD COLUMN IF NOT EXISTS data_aprovacao_credito_obra date,
  ADD COLUMN IF NOT EXISTS data_inicio_obra date;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('611', 'imob_empreendimentos_dados_negocio')
ON CONFLICT (version) DO NOTHING;
