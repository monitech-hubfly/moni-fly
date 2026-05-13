-- Responsável HDM opcional: chamado pode ser tipo 'hdm' sem time definido.
-- Nesse caso só Bombeiro/criador têm acesso (RLS existente já cobre).

ALTER TABLE public.sirene_chamados DROP CONSTRAINT IF EXISTS sirene_chamados_hdm_responsavel_check;
ALTER TABLE public.sirene_chamados ADD CONSTRAINT sirene_chamados_hdm_responsavel_check
  CHECK (
    (tipo = 'padrao' AND hdm_responsavel IS NULL) OR
    (tipo = 'hdm' AND (
      hdm_responsavel IS NULL OR
      hdm_responsavel IN ('Homologações', 'Produto', 'Modelo Virtual')
    ))
  );
