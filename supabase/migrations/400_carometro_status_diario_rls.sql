ALTER TABLE carometro_status_diario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê próprio status" ON carometro_status_diario
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "Usuário insere próprio status" ON carometro_status_diario
  FOR INSERT WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Admin vê todos" ON carometro_status_diario
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );
