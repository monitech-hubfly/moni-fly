-- 587: Copia o que foi preenchido em Informações do Condomínio (loteadores)
-- para o cadastro de condomínios. Não apaga dado já preenchido no destino.
-- Preço de lotes/casas é texto (faixa), então as colunas deixam de ser numéricas.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'condominios'
      AND column_name = 'ticket_medio_lote'
      AND data_type = 'numeric'
  ) THEN
    ALTER TABLE public.condominios
      ALTER COLUMN ticket_medio_lote TYPE text
      USING CASE
        WHEN ticket_medio_lote IS NULL THEN NULL
        WHEN ticket_medio_lote = trunc(ticket_medio_lote) THEN trunc(ticket_medio_lote)::bigint::text
        ELSE trim(to_char(ticket_medio_lote, 'FM999999999990.00'))
      END;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'condominios'
      AND column_name = 'ticket_medio_casas'
      AND data_type = 'numeric'
  ) THEN
    ALTER TABLE public.condominios
      ALTER COLUMN ticket_medio_casas TYPE text
      USING CASE
        WHEN ticket_medio_casas IS NULL THEN NULL
        WHEN ticket_medio_casas = trunc(ticket_medio_casas) THEN trunc(ticket_medio_casas)::bigint::text
        ELSE trim(to_char(ticket_medio_casas, 'FM999999999990.00'))
      END;
  END IF;
END $$;

COMMENT ON COLUMN public.condominios.ticket_medio_lote IS
  'Ticket médio do lote. Texto livre (valor ou faixa), vindo também de condominio_preco_lotes.';
COMMENT ON COLUMN public.condominios.ticket_medio_casas IS
  'Ticket médio das casas. Texto livre (valor ou faixa), vindo também de condominio_preco_casas.';

WITH src AS (
  SELECT DISTINCT ON (lower(trim(l.condominio_nome)))
    trim(l.condominio_nome) AS nome,
    NULLIF(trim(l.condominio_cidade), '') AS cidade,
    NULLIF(upper(trim(l.condominio_estado)), '') AS estado,
    NULLIF(trim(l.condominio_preco_lotes), '') AS preco_lotes,
    NULLIF(trim(l.condominio_preco_casas), '') AS preco_casas,
    l.condominio_data_lancamento AS data_tvo,
    l.condominio_qtd_lotes AS qtd,
    NULLIF(trim(l.condominio_metragem_lotes), '') AS metragem_lotes,
    NULLIF(trim(l.condominio_metragem_casas), '') AS metragem_casas,
    NULLIF(trim(l.anexo_planta_cadastral), '') AS planta,
    NULLIF(trim(l.anexo_manual_obras), '') AS manual,
    NULLIF(trim(l.anexo_casas_concorrentes), '') AS concorrentes
  FROM public.rede_loteadores l
  WHERE NULLIF(trim(coalesce(l.condominio_nome, '')), '') IS NOT NULL
  ORDER BY lower(trim(l.condominio_nome)),
    (
      (NULLIF(trim(coalesce(l.condominio_cidade, '')), '') IS NOT NULL)::int
      + (l.condominio_data_lancamento IS NOT NULL)::int
      + (l.condominio_qtd_lotes IS NOT NULL)::int
      + (NULLIF(trim(coalesce(l.condominio_preco_lotes, '')), '') IS NOT NULL)::int
      + (NULLIF(trim(coalesce(l.condominio_preco_casas, '')), '') IS NOT NULL)::int
      + (NULLIF(trim(coalesce(l.condominio_metragem_lotes, '')), '') IS NOT NULL)::int
      + (NULLIF(trim(coalesce(l.condominio_metragem_casas, '')), '') IS NOT NULL)::int
      + (NULLIF(trim(coalesce(l.anexo_planta_cadastral, '')), '') IS NOT NULL)::int
      + (NULLIF(trim(coalesce(l.anexo_manual_obras, '')), '') IS NOT NULL)::int
      + (NULLIF(trim(coalesce(l.anexo_casas_concorrentes, '')), '') IS NOT NULL)::int
    ) DESC,
    l.codigo DESC
)
UPDATE public.condominios c
SET
  cidade = COALESCE(NULLIF(trim(c.cidade), ''), s.cidade),
  estado = COALESCE(NULLIF(trim(c.estado), ''), s.estado),
  ticket_medio_lote = COALESCE(NULLIF(trim(c.ticket_medio_lote), ''), s.preco_lotes),
  ticket_medio_casas = COALESCE(NULLIF(trim(c.ticket_medio_casas), ''), s.preco_casas),
  data_liberacao_tvo = COALESCE(c.data_liberacao_tvo, s.data_tvo),
  quantidade_lotes = COALESCE(c.quantidade_lotes, s.qtd),
  metragem_lotes = COALESCE(NULLIF(trim(c.metragem_lotes), ''), s.metragem_lotes),
  metragem_casas = COALESCE(NULLIF(trim(c.metragem_casas), ''), s.metragem_casas),
  planta_cadastral = COALESCE(NULLIF(trim(c.planta_cadastral), ''), s.planta),
  manual_obras = COALESCE(NULLIF(trim(c.manual_obras), ''), s.manual),
  casas_concorrentes = COALESCE(NULLIF(trim(c.casas_concorrentes), ''), s.concorrentes),
  updated_at = now()
FROM src s
WHERE lower(trim(c.nome)) = lower(trim(s.nome));

WITH src AS (
  SELECT DISTINCT ON (lower(trim(l.condominio_nome)))
    trim(l.condominio_nome) AS nome,
    NULLIF(trim(l.condominio_cidade), '') AS cidade,
    NULLIF(upper(trim(l.condominio_estado)), '') AS estado,
    NULLIF(trim(l.condominio_preco_lotes), '') AS preco_lotes,
    NULLIF(trim(l.condominio_preco_casas), '') AS preco_casas,
    l.condominio_data_lancamento AS data_tvo,
    l.condominio_qtd_lotes AS qtd,
    NULLIF(trim(l.condominio_metragem_lotes), '') AS metragem_lotes,
    NULLIF(trim(l.condominio_metragem_casas), '') AS metragem_casas,
    NULLIF(trim(l.anexo_planta_cadastral), '') AS planta,
    NULLIF(trim(l.anexo_manual_obras), '') AS manual,
    NULLIF(trim(l.anexo_casas_concorrentes), '') AS concorrentes
  FROM public.rede_loteadores l
  WHERE NULLIF(trim(coalesce(l.condominio_nome, '')), '') IS NOT NULL
  ORDER BY lower(trim(l.condominio_nome)),
    (
      (NULLIF(trim(coalesce(l.condominio_cidade, '')), '') IS NOT NULL)::int
      + (l.condominio_data_lancamento IS NOT NULL)::int
      + (l.condominio_qtd_lotes IS NOT NULL)::int
      + (NULLIF(trim(coalesce(l.condominio_preco_lotes, '')), '') IS NOT NULL)::int
      + (NULLIF(trim(coalesce(l.condominio_preco_casas, '')), '') IS NOT NULL)::int
      + (NULLIF(trim(coalesce(l.condominio_metragem_lotes, '')), '') IS NOT NULL)::int
      + (NULLIF(trim(coalesce(l.condominio_metragem_casas, '')), '') IS NOT NULL)::int
      + (NULLIF(trim(coalesce(l.anexo_planta_cadastral, '')), '') IS NOT NULL)::int
      + (NULLIF(trim(coalesce(l.anexo_manual_obras, '')), '') IS NOT NULL)::int
      + (NULLIF(trim(coalesce(l.anexo_casas_concorrentes, '')), '') IS NOT NULL)::int
    ) DESC,
    l.codigo DESC
)
INSERT INTO public.condominios (
  nome,
  cidade,
  estado,
  ticket_medio_lote,
  ticket_medio_casas,
  data_liberacao_tvo,
  quantidade_lotes,
  metragem_lotes,
  metragem_casas,
  planta_cadastral,
  manual_obras,
  casas_concorrentes,
  updated_at
)
SELECT
  s.nome,
  s.cidade,
  s.estado,
  s.preco_lotes,
  s.preco_casas,
  s.data_tvo,
  s.qtd,
  s.metragem_lotes,
  s.metragem_casas,
  s.planta,
  s.manual,
  s.concorrentes,
  now()
FROM src s
WHERE NOT EXISTS (
  SELECT 1
  FROM public.condominios c
  WHERE lower(trim(c.nome)) = lower(trim(s.nome))
);

NOTIFY pgrst, 'reload schema';
