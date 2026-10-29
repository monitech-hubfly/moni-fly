-- Migration: tabela pivot indicadores_responsaveis
-- Permite múltiplos usuários assumirem o mesmo indicador standalone (sem meta)
-- Cada usuário mantém seus próprios lançamentos em indicador_lancamentos (já tem profile_id)
-- Data: 2026-10-08

CREATE TABLE IF NOT EXISTS indicadores_responsaveis (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  indicador_id uuid NOT NULL REFERENCES indicadores(id) ON DELETE CASCADE,
  profile_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  criado_em    timestamptz DEFAULT now(),
  UNIQUE (indicador_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_ind_resp_indicador ON indicadores_responsaveis(indicador_id);
CREATE INDEX IF NOT EXISTS idx_ind_resp_profile   ON indicadores_responsaveis(profile_id);

-- RLS: qualquer autenticado pode ler; só pode inserir/deletar a própria linha
ALTER TABLE indicadores_responsaveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ind_resp_select" ON indicadores_responsaveis
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ind_resp_insert" ON indicadores_responsaveis
  FOR INSERT TO authenticated WITH CHECK (profile_id = auth.uid());

CREATE POLICY "ind_resp_delete" ON indicadores_responsaveis
  FOR DELETE TO authenticated USING (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

NOTIFY pgrst, 'reload schema';
