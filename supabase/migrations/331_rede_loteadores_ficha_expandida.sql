-- 331: Ficha expandida de loteadores (parceiro, condomínio, carteira, anexos).
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co
-- Seguro para PROD: apenas ADD COLUMN nullable.

-- ─── Grupo 1: Informações do Parceiro (interlocutor de negociação) ───────────
ALTER TABLE public.rede_loteadores ADD COLUMN IF NOT EXISTS interlocutor_nome TEXT;
ALTER TABLE public.rede_loteadores ADD COLUMN IF NOT EXISTS interlocutor_cargo TEXT;
ALTER TABLE public.rede_loteadores ADD COLUMN IF NOT EXISTS interlocutor_telefone TEXT;
ALTER TABLE public.rede_loteadores ADD COLUMN IF NOT EXISTS interlocutor_email TEXT;

-- ─── Grupo 2: Informações do Condomínio ──────────────────────────────────────
ALTER TABLE public.rede_loteadores ADD COLUMN IF NOT EXISTS condominio_nome TEXT;
ALTER TABLE public.rede_loteadores ADD COLUMN IF NOT EXISTS condominio_data_lancamento DATE;
ALTER TABLE public.rede_loteadores ADD COLUMN IF NOT EXISTS condominio_cidade TEXT;
ALTER TABLE public.rede_loteadores ADD COLUMN IF NOT EXISTS condominio_qtd_lotes INTEGER;
ALTER TABLE public.rede_loteadores ADD COLUMN IF NOT EXISTS condominio_preco_lotes TEXT;
ALTER TABLE public.rede_loteadores ADD COLUMN IF NOT EXISTS condominio_metragem_lotes TEXT;
ALTER TABLE public.rede_loteadores ADD COLUMN IF NOT EXISTS condominio_preco_casas TEXT;
ALTER TABLE public.rede_loteadores ADD COLUMN IF NOT EXISTS condominio_metragem_casas TEXT;
ALTER TABLE public.rede_loteadores ADD COLUMN IF NOT EXISTS anexo_planta_cadastral TEXT;
ALTER TABLE public.rede_loteadores ADD COLUMN IF NOT EXISTS anexo_manual_obras TEXT;
ALTER TABLE public.rede_loteadores ADD COLUMN IF NOT EXISTS anexo_casas_concorrentes TEXT;

-- ─── Grupo 3: Venda e Carteira ───────────────────────────────────────────────
ALTER TABLE public.rede_loteadores ADD COLUMN IF NOT EXISTS carteira_lotes_disponiveis INTEGER;
ALTER TABLE public.rede_loteadores ADD COLUMN IF NOT EXISTS carteira_lotes_vendidos_quitados INTEGER;
ALTER TABLE public.rede_loteadores ADD COLUMN IF NOT EXISTS carteira_carteira_curta_qtd INTEGER;
ALTER TABLE public.rede_loteadores ADD COLUMN IF NOT EXISTS carteira_curta_financiamento TEXT;
ALTER TABLE public.rede_loteadores ADD COLUMN IF NOT EXISTS carteira_longa_qtd INTEGER;
ALTER TABLE public.rede_loteadores ADD COLUMN IF NOT EXISTS carteira_longa_financiamento TEXT;
ALTER TABLE public.rede_loteadores ADD COLUMN IF NOT EXISTS anexo_tabela_precos TEXT;

-- ─── Grupo 4: Campo Livre ────────────────────────────────────────────────────
ALTER TABLE public.rede_loteadores ADD COLUMN IF NOT EXISTS campo_livre TEXT;
ALTER TABLE public.rede_loteadores ADD COLUMN IF NOT EXISTS anexo_material_extra TEXT;

COMMENT ON COLUMN public.rede_loteadores.interlocutor_nome IS
  'Interlocutor específico da negociação (pode diferir de contato_nome).';
COMMENT ON COLUMN public.rede_loteadores.condominio_data_lancamento IS
  'Data de lançamento / TVO do condomínio prospectado.';
COMMENT ON COLUMN public.rede_loteadores.anexo_planta_cadastral IS
  'URL ou path do arquivo de planta cadastral.';
