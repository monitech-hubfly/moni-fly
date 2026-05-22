-- Migration 196: correcoes pos-deploy Carometro PROD
-- Aplicadas manualmente no iad-prod em 22/05/2026
-- Documentadas aqui para rastreabilidade

-- recorrencias_atividade: tabela faltando na migration 090
CREATE TABLE IF NOT EXISTS recorrencias_atividade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acao_id uuid REFERENCES acoes(id) ON DELETE CASCADE,
  periodo_id uuid REFERENCES periodos(id) ON DELETE CASCADE,
  criado_em timestamptz DEFAULT now(),
  ordem int DEFAULT 0,
  descricao text,
  ativo boolean DEFAULT true
);
GRANT ALL ON TABLE recorrencias_atividade TO anon, authenticated;
ALTER TABLE recorrencias_atividade ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_recorrencias_atividade" ON recorrencias_atividade;
CREATE POLICY "allow_all_recorrencias_atividade" ON recorrencias_atividade FOR ALL USING (true) WITH CHECK (true);

-- objetivos: colunas faltando
ALTER TABLE objetivos ADD COLUMN IF NOT EXISTS concluido_em timestamptz;
ALTER TABLE objetivos ADD COLUMN IF NOT EXISTS comentario_conclusao text;
ALTER TABLE objetivos ADD COLUMN IF NOT EXISTS tipo text;
ALTER TABLE objetivos ADD COLUMN IF NOT EXISTS status text DEFAULT 'ativo';

-- indicadores: colunas faltando
ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'quantitativo';
ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS status text DEFAULT 'ativo';
ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS regra_verde_escuro numeric;
ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS regra_verde_claro numeric;
ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS regra_amarelo numeric;
ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS regra_verde_escuro_op text;
ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS regra_verde_claro_op text;
ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS regra_amarelo_op text;
ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS semaforo_faixas jsonb;
ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS objetivo_id uuid REFERENCES objetivos(id) ON DELETE SET NULL;
ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS meta_ciclo_tipo text;
ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS meta_unidade text;
ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS concluido_em timestamptz;
ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS comentario_conclusao text;

-- tarefas: colunas faltando
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS objetivo_id uuid REFERENCES objetivos(id) ON DELETE SET NULL;
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS caneta_verde text DEFAULT 'nao';
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS recorrencia text;
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS multiplicador_valor numeric;
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS multiplicador_tipo text;
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS ativo boolean DEFAULT true;
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS tipo_atividade text;

-- gantt_planejamento: colunas faltando
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS adm_cnpj_id uuid;
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS wayzer_nath_franqueado_id uuid;
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS wayzer_rafa_franqueado_id uuid;
ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS executivos_locais_franqueado_id uuid;

-- multiplicador_tipos: colunas faltando
ALTER TABLE multiplicador_tipos ADD COLUMN IF NOT EXISTS codigo text;
ALTER TABLE multiplicador_tipos ADD COLUMN IF NOT EXISTS ativo boolean DEFAULT true;
ALTER TABLE multiplicador_tipos ADD COLUMN IF NOT EXISTS ordem int DEFAULT 0;
UPDATE multiplicador_tipos SET codigo = LOWER(REPLACE(nome, ' ', '_')) WHERE codigo IS NULL;

NOTIFY pgrst, 'reload schema';
