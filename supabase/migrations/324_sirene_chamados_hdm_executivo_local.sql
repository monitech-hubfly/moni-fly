-- Migration 324: Adiciona 'Executivo Local' à constraint HDM de sirene_chamados
ALTER TABLE sirene_chamados DROP CONSTRAINT IF EXISTS sirene_chamados_hdm_responsavel_check;
ALTER TABLE sirene_chamados ADD CONSTRAINT sirene_chamados_hdm_responsavel_check CHECK (
  (tipo = 'padrao' AND hdm_responsavel IS NULL)
  OR (tipo = 'hdm' AND (hdm_responsavel IS NULL OR hdm_responsavel = ANY(ARRAY['Homologações','Produto','Modelo Virtual','Executivo Local'])))
);
