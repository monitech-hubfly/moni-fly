-- 581_formularios_qualificacao.sql
-- Tabela de Formulários de Qualificação dos Franqueados

-- 1. Tabela principal
CREATE TABLE IF NOT EXISTS formularios_qualificacao (
  id                          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  rede_franqueado_id          uuid NOT NULL REFERENCES rede_franqueados(id) ON DELETE CASCADE,
  n_franquia                  text NOT NULL,
  nome_franqueado_confirmado  text NOT NULL,

  -- Período de referência
  periodo_mes                 integer NOT NULL CHECK (periodo_mes BETWEEN 1 AND 12),
  periodo_ano                 integer NOT NULL CHECK (periodo_ano >= 2020),

  -- Situação operacional
  tem_ponto_comercial         boolean,
  endereco_ponto_comercial    text,
  numero_colaboradores        integer CHECK (numero_colaboradores >= 0),

  -- Indicadores de negócio
  contratos_realizados_trimestre  integer CHECK (contratos_realizados_trimestre >= 0),
  meta_contratos_trimestre        integer CHECK (meta_contratos_trimestre >= 0),

  -- Qualitativo
  principais_desafios         text,
  apoio_necessario            text,
  observacoes_adicionais      text,

  -- Metadados
  preenchido_por_user_id      uuid REFERENCES auth.users(id),
  criado_em                   timestamptz DEFAULT now() NOT NULL,
  atualizado_em               timestamptz DEFAULT now() NOT NULL
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_formqual_rede_id   ON formularios_qualificacao(rede_franqueado_id);
CREATE INDEX IF NOT EXISTS idx_formqual_criado_em ON formularios_qualificacao(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_formqual_n_franquia ON formularios_qualificacao(n_franquia);

-- 3. RLS
ALTER TABLE formularios_qualificacao ENABLE ROW LEVEL SECURITY;

-- Admin/team/consultor/supervisor: acesso total
CREATE POLICY IF NOT EXISTS "formqual_staff_all" ON formularios_qualificacao
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  );

-- Frank: visualiza somente registros da sua rede
CREATE POLICY IF NOT EXISTS "formqual_frank_select" ON formularios_qualificacao
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.rede_franqueado_id = formularios_qualificacao.rede_franqueado_id
    )
  );

-- Frank: insere somente na própria rede
CREATE POLICY IF NOT EXISTS "formqual_frank_insert" ON formularios_qualificacao
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.rede_franqueado_id = formularios_qualificacao.rede_franqueado_id
    )
  );

-- 4. Trigger updated_at
CREATE OR REPLACE FUNCTION update_formularios_qualificacao_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_formqual_updated_at ON formularios_qualificacao;
CREATE TRIGGER trg_formqual_updated_at
  BEFORE UPDATE ON formularios_qualificacao
  FOR EACH ROW EXECUTE FUNCTION update_formularios_qualificacao_updated_at();

NOTIFY pgrst, 'reload schema';
