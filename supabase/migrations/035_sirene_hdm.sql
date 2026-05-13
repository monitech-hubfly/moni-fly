-- Exceção HDM: chamados podem ser tipo 'padrao' ou 'hdm'.
-- HDM = direcionado a um dos 3 times: Homologações, Produto, Modelo Virtual.
-- Time HDM atua como Bombeiro no chamado (resolução pontual, aprovar tópicos, fechar).
-- Tema e mapeamento de perícia são SEMPRE preenchidos apenas pelo Bombeiro.

-- Coluna "time" em profiles: time interno do usuário (ex.: Homologações, Produto) para RLS e canActAsBombeiro
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS time TEXT;

-- Colunas HDM em sirene_chamados
ALTER TABLE public.sirene_chamados ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'padrao';
ALTER TABLE public.sirene_chamados ADD COLUMN IF NOT EXISTS hdm_responsavel TEXT;
ALTER TABLE public.sirene_chamados ADD COLUMN IF NOT EXISTS hdm_redirecionado_por UUID REFERENCES auth.users(id);
ALTER TABLE public.sirene_chamados ADD COLUMN IF NOT EXISTS hdm_redirecionado_em TIMESTAMPTZ;

-- Constraint: padrão sem HDM; HDM exige um dos 3 times
ALTER TABLE public.sirene_chamados DROP CONSTRAINT IF EXISTS sirene_chamados_hdm_responsavel_check;
ALTER TABLE public.sirene_chamados ADD CONSTRAINT sirene_chamados_hdm_responsavel_check
  CHECK (
    (tipo = 'padrao' AND hdm_responsavel IS NULL) OR
    (tipo = 'hdm' AND hdm_responsavel IN ('Homologações', 'Produto', 'Modelo Virtual'))
  );

CREATE INDEX IF NOT EXISTS idx_sirene_chamados_hdm ON public.sirene_chamados(tipo, hdm_responsavel)
  WHERE tipo = 'hdm';

-- RLS: time HDM vê e pode atualizar chamados HDM atribuídos ao seu time (não INSERT; criador/Bombeiro insere)
DROP POLICY IF EXISTS "sirene_chamados_hdm_team_select" ON public.sirene_chamados;
DROP POLICY IF EXISTS "sirene_chamados_hdm_team_update" ON public.sirene_chamados;
CREATE POLICY "sirene_chamados_hdm_team_select"
  ON public.sirene_chamados FOR SELECT
  USING (
    tipo = 'hdm'
    AND hdm_responsavel = (SELECT time FROM public.profiles WHERE id = auth.uid() LIMIT 1)
  );
CREATE POLICY "sirene_chamados_hdm_team_update"
  ON public.sirene_chamados FOR UPDATE
  USING (
    tipo = 'hdm'
    AND hdm_responsavel = (SELECT time FROM public.profiles WHERE id = auth.uid() LIMIT 1)
  );
