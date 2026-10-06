-- Migration 510: Adicionar colunas de diagnóstico em rede_loteadores
-- Escala D: 0=Não tem capital, 1=Moderado, 2=Tem capital para operar
-- Relação: calculada via NPS + CSAT (sem Indicador / sem C/K)

ALTER TABLE rede_loteadores
  ADD COLUMN IF NOT EXISTS diag_d          smallint   CHECK (diag_d IN (0, 1, 2)),
  ADD COLUMN IF NOT EXISTS diag_nps        smallint   CHECK (diag_nps >= 0 AND diag_nps <= 10),
  ADD COLUMN IF NOT EXISTS diag_csat       numeric(3,1) CHECK (diag_csat >= 1.0 AND diag_csat <= 5.0),
  ADD COLUMN IF NOT EXISTS diag_adormecido boolean    NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS diag_proxima_acao text,
  ADD COLUMN IF NOT EXISTS diag_ultimo_contato date,
  ADD COLUMN IF NOT EXISTS diag_ultima_aval  date,
  ADD COLUMN IF NOT EXISTS diag_avaliado_por text,
  ADD COLUMN IF NOT EXISTS diag_tend_rel   text       CHECK (diag_tend_rel IN ('↑', '→', '↓')),
  ADD COLUMN IF NOT EXISTS diag_grupo_sec  text;

NOTIFY pgrst, 'reload schema';
