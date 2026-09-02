-- Adiciona colunas de datas para metas tipo "Atingível - Projeto"
-- Executores definem início/fim ao assumir; admin pode alterar depois

ALTER TABLE objetivo_responsaveis
  ADD COLUMN IF NOT EXISTS data_inicio date,
  ADD COLUMN IF NOT EXISTS data_fim    date,
  ADD COLUMN IF NOT EXISTS dias_uteis  int;

-- UPDATE: apenas admin pode alterar datas após o assume
CREATE POLICY "objetivo_responsaveis_update"
  ON objetivo_responsaveis FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

NOTIFY pgrst, 'reload schema';
