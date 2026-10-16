-- Adiciona coluna capital_valor_declarado (caso ainda nao exista)
ALTER TABLE formularios_qualificacao
  ADD COLUMN IF NOT EXISTS capital_valor_declarado text;

-- Token publico por rede para acesso externo ao formulario de qualificacao
ALTER TABLE rede_franqueados
  ADD COLUMN IF NOT EXISTS formulario_public_token uuid
    DEFAULT gen_random_uuid()
    NOT NULL;

-- Garantir unicidade
CREATE UNIQUE INDEX IF NOT EXISTS rede_franqueados_formulario_public_token_idx
  ON rede_franqueados (formulario_public_token);

-- Gerar token para linhas existentes que ficaram com NULL (nao deve ocorrer com DEFAULT, mas por seguranca)
UPDATE rede_franqueados
  SET formulario_public_token = gen_random_uuid()
  WHERE formulario_public_token IS NULL;

NOTIFY pgrst, 'reload schema';
