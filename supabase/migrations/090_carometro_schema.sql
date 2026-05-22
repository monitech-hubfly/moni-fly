-- ============================================================
-- Migration 090: Schema completo do Carometro
-- Usa IF NOT EXISTS em tudo - seguro para bancos existentes
-- ============================================================

-- 1. Tabela periodos
CREATE TABLE IF NOT EXISTS periodos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('ano','semestre','bimestre','trimestre','mes','semana')),
  ano int NOT NULL,
  numero int NULL,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now(),
  CONSTRAINT periodos_data_valida CHECK (data_fim >= data_inicio)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_periodos_tipo_ano_numero ON periodos(tipo, ano, COALESCE(numero, 0));
CREATE INDEX IF NOT EXISTS idx_periodos_tipo_ano ON periodos(tipo, ano);
CREATE INDEX IF NOT EXISTS idx_periodos_datas ON periodos(data_inicio, data_fim);

-- 2. Tabela areas
CREATE TABLE IF NOT EXISTS areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now(),
  ordem int NOT NULL DEFAULT 0
);

-- 3. Tabela area_pessoas
CREATE TABLE IF NOT EXISTS area_pessoas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem int DEFAULT 0,
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now()
);

-- 4. Tabela tarefas
CREATE TABLE IF NOT EXISTS tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid REFERENCES areas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text null,
  tempo_estimado_minutos int null,
  ordem int DEFAULT 0,
  criado_em timestamptz DEFAULT now()
);

-- 5. Tabela acoes
CREATE TABLE IF NOT EXISTS acoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid REFERENCES tarefas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tempo_estimado_minutos int null,
  ordem int DEFAULT 0,
  criado_em timestamptz DEFAULT now(),
  caneta_verde text null,
  recorrencia text null,
  multiplicador_valor int null,
  multiplicador_tipo text null,
  tipo_atividade character varying null,
  esteira_par_id uuid null,
  objetivo_id uuid null
);

-- 6. Tabela casas
CREATE TABLE IF NOT EXISTS casas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  area_id uuid REFERENCES areas(id) ON DELETE SET NULL,
  criado_em timestamptz DEFAULT now()
);

-- 7. Tabela carometro
CREATE TABLE IF NOT EXISTS carometro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid REFERENCES areas(id) ON DELETE CASCADE,
  tarefa_id uuid REFERENCES tarefas(id) ON DELETE SET NULL,
  nome_comportamento text NOT NULL,
  emoji_chave text null,
  ordem int DEFAULT 0,
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now(),
  comportamento_chave boolean DEFAULT false,
  periodo_id uuid REFERENCES periodos(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_carometro_periodo ON carometro(periodo_id);

-- 8. Tabela carometro_semana
CREATE TABLE IF NOT EXISTS carometro_semana (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carometro_id uuid NOT NULL REFERENCES carometro(id) ON DELETE CASCADE,
  semana int NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','concluido')),
  criado_em timestamptz DEFAULT now(),
  semana_ano int null
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_carometro_semana_carometro_semana_ano ON carometro_semana(carometro_id, semana_ano);

-- 9. Tabela cronograma
CREATE TABLE IF NOT EXISTS cronograma (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid REFERENCES tarefas(id) ON DELETE CASCADE,
  acao_id uuid REFERENCES acoes(id) ON DELETE CASCADE,
  data_inicio_prevista date null,
  data_fim_prevista date null,
  data_inicio_real date null,
  data_fim_real date null,
  status text DEFAULT 'pendente',
  observacao text null,
  criado_em timestamptz DEFAULT now(),
  semana int null,
  horas_previstas numeric null,
  planejamento_id uuid null,
  semana_ano int null,
  periodo_id uuid REFERENCES periodos(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_cronograma_periodo_acao_semana_ano ON cronograma(periodo_id, acao_id, semana_ano);

-- 10. Tabela gantt_planejamento
CREATE TABLE IF NOT EXISTS gantt_planejamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acao_id uuid NOT NULL REFERENCES acoes(id) ON DELETE CASCADE,
  responsavel text null,
  recorrencia text null,
  repeticao int null,
  semana_inicio int null,
  semana_fim int null,
  criado_em timestamptz DEFAULT now(),
  semanas_selecionadas int[] DEFAULT '{}',
  comportamento_chave boolean DEFAULT false,
  franqueado_nome text null,
  casa_id uuid null,
  periodo_id uuid REFERENCES periodos(id) ON DELETE CASCADE,
  objetivo_id uuid null,
  semana_ano_inicio int null,
  semana_ano_fim int null
);
CREATE INDEX IF NOT EXISTS idx_gantt_planejamento_periodo ON gantt_planejamento(periodo_id);

-- 11. Tabela indicadores
CREATE TABLE IF NOT EXISTS indicadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid REFERENCES areas(id) ON DELETE CASCADE,
  tarefa_id uuid REFERENCES tarefas(id) ON DELETE SET NULL,
  nome text NOT NULL,
  unidade text null,
  meta_valor numeric null,
  meta_tipo text null,
  ordem int DEFAULT 0,
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now(),
  indicador_chave boolean DEFAULT false
);

-- 12. Tabela indicador_lancamentos
CREATE TABLE IF NOT EXISTS indicador_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicador_id uuid NOT NULL REFERENCES indicadores(id) ON DELETE CASCADE,
  periodo_id uuid REFERENCES periodos(id) ON DELETE CASCADE,
  semana int null,
  semana_ano int null,
  valor numeric NOT NULL,
  observacao text null,
  criado_em timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_indicador_lancamentos_ind_periodo_semana_ano ON indicador_lancamentos(indicador_id, periodo_id, semana_ano);
CREATE INDEX IF NOT EXISTS idx_indicador_lancamentos_periodo ON indicador_lancamentos(periodo_id);

-- 13. Tabela indicador_conquistas
CREATE TABLE IF NOT EXISTS indicador_conquistas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicador_id uuid NOT NULL REFERENCES indicadores(id) ON DELETE CASCADE,
  periodo_id uuid REFERENCES periodos(id) ON DELETE CASCADE,
  conquista text NOT NULL,
  criado_em timestamptz DEFAULT now()
);

-- 14. Tabela multiplicador_tipos
CREATE TABLE IF NOT EXISTS multiplicador_tipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text null,
  criado_em timestamptz DEFAULT now()
);

-- 15. Tabela objetivos
CREATE TABLE IF NOT EXISTS objetivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid REFERENCES areas(id) ON DELETE CASCADE,
  periodo_id uuid REFERENCES periodos(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  meta_valor numeric null,
  meta_unidade text null,
  ordem int DEFAULT 0,
  criado_em timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_objetivos_periodo ON objetivos(periodo_id);

-- 16. Tabela audit_log
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  usuario text NOT NULL DEFAULT 'Desconhecido',
  is_admin boolean DEFAULT false,
  modulo text NOT NULL,
  area text null,
  entidade text NOT NULL,
  entidade_id text null,
  operacao text NOT NULL,
  campo text null,
  valor_anterior jsonb null,
  valor_novo jsonb null,
  descricao text null
);

-- 17. Tabela comentarios_atividade
CREATE TABLE IF NOT EXISTS comentarios_atividade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acao_id uuid NOT NULL REFERENCES acoes(id) ON DELETE CASCADE,
  semana_iso int NOT NULL,
  semana_ano int NOT NULL,
  texto text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 18. Tabela comentarios_indicador
CREATE TABLE IF NOT EXISTS comentarios_indicador (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicador_id uuid NOT NULL REFERENCES indicadores(id) ON DELETE CASCADE,
  semana_iso int NOT NULL,
  semana_ano int NOT NULL,
  texto text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 19. Tabela recorrencias_metas
CREATE TABLE IF NOT EXISTS recorrencias_metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acao_id uuid REFERENCES acoes(id) ON DELETE CASCADE,
  periodo_id uuid REFERENCES periodos(id) ON DELETE CASCADE,
  criado_em timestamptz DEFAULT now()
);

-- 20. Tabela registros_resultados
CREATE TABLE IF NOT EXISTS registros_resultados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objetivo_id uuid REFERENCES objetivos(id) ON DELETE CASCADE,
  data_referencia date NOT NULL,
  valor numeric NOT NULL,
  observacao text null,
  criado_em timestamptz DEFAULT now()
);
