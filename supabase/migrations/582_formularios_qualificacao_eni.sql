-- 582_formularios_qualificacao_eni.sql
-- Adiciona colunas do Formulário de Qualificação ENI / Plano Permuteiro
-- Mantém colunas antigas opcionais (nenhum dado ainda em uso)

-- Torna nullable as colunas obrigatórias do form antigo
ALTER TABLE formularios_qualificacao
  ALTER COLUMN nome_franqueado_confirmado DROP NOT NULL;

ALTER TABLE formularios_qualificacao
  DROP CONSTRAINT IF EXISTS formularios_qualificacao_periodo_mes_check;

ALTER TABLE formularios_qualificacao
  DROP CONSTRAINT IF EXISTS formularios_qualificacao_periodo_ano_check;

ALTER TABLE formularios_qualificacao
  ALTER COLUMN periodo_mes DROP NOT NULL,
  ALTER COLUMN periodo_ano DROP NOT NULL;

-- Novas colunas ENI
ALTER TABLE formularios_qualificacao
  ADD COLUMN IF NOT EXISTS cidade_atuacao        text,
  ADD COLUMN IF NOT EXISTS estado_atuacao        text,
  ADD COLUMN IF NOT EXISTS capital_gate          text,
  ADD COLUMN IF NOT EXISTS capital_faixa         text,
  ADD COLUMN IF NOT EXISTS capital_timing        text,
  ADD COLUMN IF NOT EXISTS conhecimento_mercado  text,
  ADD COLUMN IF NOT EXISTS conhecimento_imob     text,
  ADD COLUMN IF NOT EXISTS conhecimento_moni     text,
  ADD COLUMN IF NOT EXISTS tempo_horas           text,
  ADD COLUMN IF NOT EXISTS tempo_resposta        text,
  ADD COLUMN IF NOT EXISTS tempo_agenda          text,
  ADD COLUMN IF NOT EXISTS workshops             text,
  ADD COLUMN IF NOT EXISTS motivacao             text,
  ADD COLUMN IF NOT EXISTS score_capital_pct     integer,
  ADD COLUMN IF NOT EXISTS score_conhecimento_pct integer,
  ADD COLUMN IF NOT EXISTS score_tempo_pct       integer,
  ADD COLUMN IF NOT EXISTS resultado_tipo        text,
  ADD COLUMN IF NOT EXISTS texto_gerado          text;

NOTIFY pgrst, 'reload schema';
