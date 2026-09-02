-- Migration 508: colunas de diagnóstico na tabela rede_franqueados
-- Adiciona os campos avaliados pela equipe Moní para cada franqueado.
-- D = Dinheiro (Consegue?), C = Comportamento (Faz?), K = Conhecimento (Sabe?)
-- Valores: 0 = Não tem | 2 = Moderado | 3 = Tem | NULL = Não aferido

ALTER TABLE rede_franqueados
  ADD COLUMN IF NOT EXISTS diag_d            smallint   CHECK (diag_d IN (0, 2, 3)),
  ADD COLUMN IF NOT EXISTS diag_c            smallint   CHECK (diag_c IN (0, 2, 3)),
  ADD COLUMN IF NOT EXISTS diag_k            smallint   CHECK (diag_k IN (0, 2, 3)),
  ADD COLUMN IF NOT EXISTS diag_d_desc       text,
  ADD COLUMN IF NOT EXISTS diag_c_desc       text,
  ADD COLUMN IF NOT EXISTS diag_k_desc       text,
  ADD COLUMN IF NOT EXISTS diag_nps          smallint   CHECK (diag_nps >= 0 AND diag_nps <= 10),
  ADD COLUMN IF NOT EXISTS diag_csat         numeric(3,1) CHECK (diag_csat >= 1.0 AND diag_csat <= 5.0),
  ADD COLUMN IF NOT EXISTS diag_contratos_12m smallint  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS diag_ano_meta     smallint   NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS diag_tend_eng     text       CHECK (diag_tend_eng  IN ('↑', '→', '↓')),
  ADD COLUMN IF NOT EXISTS diag_tend_rel     text       CHECK (diag_tend_rel  IN ('↑', '→', '↓')),
  ADD COLUMN IF NOT EXISTS diag_tend_ind     text       CHECK (diag_tend_ind  IN ('↑', '→', '↓')),
  ADD COLUMN IF NOT EXISTS diag_proxima_acao text,
  ADD COLUMN IF NOT EXISTS diag_adormecido   boolean    NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS diag_ultimo_contato date,
  ADD COLUMN IF NOT EXISTS diag_ultima_aval  date,
  ADD COLUMN IF NOT EXISTS diag_avaliado_por text,
  ADD COLUMN IF NOT EXISTS diag_grupo_sec    text       CHECK (diag_grupo_sec IN ('GA1','GA2','GA3','GA4','GA5','GA6','GA7'));

-- Comentários descritivos
COMMENT ON COLUMN rede_franqueados.diag_d             IS 'Dinheiro/Capital: 0=Não tem, 2=Moderado, 3=Tem';
COMMENT ON COLUMN rede_franqueados.diag_c             IS 'Comportamento/Execução: 0=Não tem, 2=Moderado, 3=Tem';
COMMENT ON COLUMN rede_franqueados.diag_k             IS 'Conhecimento: 0=Não tem, 2=Moderado, 3=Tem';
COMMENT ON COLUMN rede_franqueados.diag_nps           IS 'Net Promoter Score 0–10 (≤6 detrator, ≤8 neutro, >8 promotor)';
COMMENT ON COLUMN rede_franqueados.diag_csat          IS 'Customer Satisfaction 1.0–5.0';
COMMENT ON COLUMN rede_franqueados.diag_contratos_12m IS 'Contratos fechados nos últimos 12 meses';
COMMENT ON COLUMN rede_franqueados.diag_ano_meta      IS 'Meta anual de contratos (padrão 4)';
COMMENT ON COLUMN rede_franqueados.diag_adormecido    IS 'Franqueado adormecido (sem atividade)';
COMMENT ON COLUMN rede_franqueados.diag_grupo_sec     IS 'Grupo de ação secundário (GA1–GA7)';

NOTIFY pgrst, 'reload schema';
