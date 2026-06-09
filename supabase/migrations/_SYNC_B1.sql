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
-- Atividades (checklist do card): vÃ¡rios times e vÃ¡rios responsÃ¡veis por item.
-- Colunas legadas time_nome / responsavel_nome permanecem (primeiro valor) para compatibilidade.

ALTER TABLE public.processo_card_checklist
  ADD COLUMN IF NOT EXISTS times_nomes TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS responsaveis_nomes TEXT[] NOT NULL DEFAULT '{}';

UPDATE public.processo_card_checklist
SET times_nomes = CASE
    WHEN time_nome IS NOT NULL AND btrim(time_nome) <> '' THEN ARRAY[btrim(time_nome)]
    ELSE '{}'::text[]
  END
WHERE cardinality(times_nomes) = 0;

UPDATE public.processo_card_checklist
SET responsaveis_nomes = CASE
    WHEN responsavel_nome IS NOT NULL AND btrim(responsavel_nome) <> '' THEN ARRAY[btrim(responsavel_nome)]
    ELSE '{}'::text[]
  END
WHERE cardinality(responsaveis_nomes) = 0;

COMMENT ON COLUMN public.processo_card_checklist.times_nomes IS 'Times associados Ã  atividade (mÃºltiplos).';
COMMENT ON COLUMN public.processo_card_checklist.responsaveis_nomes IS 'ResponsÃ¡veis associados Ã  atividade (mÃºltiplos).';
-- Kanban genÃ©rico + Funil Step One
-- Cria kanbans, kanban_fases e kanban_cards com RLS por franqueado/role.

-- â”€â”€â”€ kanbans â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.kanbans (
  id      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  nome    TEXT    NOT NULL,
  ordem   INT     NOT NULL DEFAULT 0,
  cor_hex TEXT,
  ativo   BOOLEAN NOT NULL DEFAULT true
);

COMMENT ON TABLE public.kanbans IS 'Boards de kanban do Hub Fly (ex: Funil Step One).';

-- â”€â”€â”€ kanban_fases â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.kanban_fases (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  kanban_id  UUID    NOT NULL REFERENCES public.kanbans(id) ON DELETE CASCADE,
  nome       TEXT    NOT NULL,
  ordem      INT     NOT NULL DEFAULT 0,
  sla_dias   INT,
  ativo      BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_kanban_fases_kanban ON public.kanban_fases(kanban_id);

COMMENT ON TABLE public.kanban_fases IS 'Fases/colunas de cada kanban.';

-- â”€â”€â”€ Seed: Funil Step One â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DO $$
DECLARE
  v_kanban_id UUID;
BEGIN
  -- Garante idempotÃªncia: insere o kanban apenas se ainda nÃ£o existir
  INSERT INTO public.kanbans (nome, ordem, cor_hex, ativo)
  SELECT 'Funil Step One', 1, '#5B4CF5', true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanbans WHERE nome = 'Funil Step One'
  )
  RETURNING id INTO v_kanban_id;

  -- Se jÃ¡ existia, busca o id
  IF v_kanban_id IS NULL THEN
    SELECT id INTO v_kanban_id FROM public.kanbans WHERE nome = 'Funil Step One';
  END IF;

  -- Insere as 7 fases apenas se ainda nÃ£o existirem para este kanban
  INSERT INTO public.kanban_fases (kanban_id, nome, ordem, sla_dias, ativo)
  SELECT v_kanban_id, fase.nome, fase.ordem, fase.sla_dias, true
  FROM (
    VALUES
      ('Dados da Cidade',           1, 7),
      ('Lista de CondomÃ­nios',      2, 7),
      ('Dados dos CondomÃ­nios',     3, 10),
      ('Lotes disponÃ­veis',         4, 7),
      ('Mapa de Competidores',      5, 7),
      ('BCA + Batalha de Casas',    6, 14),
      ('HipÃ³teses',                 7, 7)
  ) AS fase(nome, ordem, sla_dias)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND nome = fase.nome
  );
END;
$$;

-- â”€â”€â”€ kanban_cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.kanban_cards (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kanban_id     UUID        NOT NULL REFERENCES public.kanbans(id) ON DELETE CASCADE,
  fase_id       UUID        NOT NULL REFERENCES public.kanban_fases(id) ON DELETE CASCADE,
  franqueado_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo        TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'ativo',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kanban_cards_kanban    ON public.kanban_cards(kanban_id);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_fase      ON public.kanban_cards(fase_id);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_franqueado ON public.kanban_cards(franqueado_id);

COMMENT ON TABLE public.kanban_cards IS 'Cards do kanban; franqueado_id aponta para o dono do card.';

-- â”€â”€â”€ RLS: kanban_cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.kanban_cards ENABLE ROW LEVEL SECURITY;

-- Leitura: dono do card OU admin/consultor
DROP POLICY IF EXISTS "kanban_cards_select" ON public.kanban_cards;
CREATE POLICY "kanban_cards_select"
  ON public.kanban_cards FOR SELECT
  USING (
    franqueado_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'consultor')
    )
  );

-- InserÃ§Ã£o: dono do card (franqueado_id deve ser o prÃ³prio usuÃ¡rio) OU admin/consultor
DROP POLICY IF EXISTS "kanban_cards_insert" ON public.kanban_cards;
CREATE POLICY "kanban_cards_insert"
  ON public.kanban_cards FOR INSERT
  WITH CHECK (
    franqueado_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'consultor')
    )
  );

-- AtualizaÃ§Ã£o e exclusÃ£o: mesmo critÃ©rio
DROP POLICY IF EXISTS "kanban_cards_update" ON public.kanban_cards;
CREATE POLICY "kanban_cards_update"
  ON public.kanban_cards FOR UPDATE
  USING (
    franqueado_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'consultor')
    )
  );

DROP POLICY IF EXISTS "kanban_cards_delete" ON public.kanban_cards;
CREATE POLICY "kanban_cards_delete"
  ON public.kanban_cards FOR DELETE
  USING (
    franqueado_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'consultor')
    )
  );

-- â”€â”€â”€ RLS: kanbans (leitura pÃºblica, escrita sÃ³ admin) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.kanbans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kanbans_select" ON public.kanbans;
CREATE POLICY "kanbans_select"
  ON public.kanbans FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "kanbans_admin" ON public.kanbans;
CREATE POLICY "kanbans_admin"
  ON public.kanbans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'consultor')
    )
  );

-- â”€â”€â”€ RLS: kanban_fases (leitura pÃºblica, escrita sÃ³ admin) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.kanban_fases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kanban_fases_select" ON public.kanban_fases;
CREATE POLICY "kanban_fases_select"
  ON public.kanban_fases FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "kanban_fases_admin" ON public.kanban_fases;
CREATE POLICY "kanban_fases_admin"
  ON public.kanban_fases FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'consultor')
    )
  );
-- â”€â”€â”€ 092: Seed do Funil Step One â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Idempotente via WHERE NOT EXISTS (nÃ£o requer ALTER TABLE / UNIQUE constraint).
-- Seguro para rodar quantas vezes quiser.

-- â”€â”€â”€ 1. Kanban â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO public.kanbans (nome, ordem, ativo)
SELECT 'Funil Step One', 1, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanbans WHERE nome = 'Funil Step One'
);

-- â”€â”€â”€ 2. Fases â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO public.kanban_fases (kanban_id, nome, ordem, sla_dias, ativo)
SELECT
  k.id,
  fase.nome,
  fase.ordem,
  fase.sla_dias,
  true
FROM public.kanbans k
CROSS JOIN (
  VALUES
    ('Dados da Cidade',        1,  7),
    ('Lista de CondomÃ­nios',   2,  7),
    ('Dados dos CondomÃ­nios',  3, 10),
    ('Lotes disponÃ­veis',      4,  7),
    ('Mapa de Competidores',   5,  7),
    ('BCA + Batalha de Casas', 6, 14),
    ('HipÃ³teses',              7,  7)
) AS fase(nome, ordem, sla_dias)
WHERE k.nome = 'Funil Step One'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fases kf
    WHERE kf.kanban_id = k.id
      AND kf.nome = fase.nome
  );

-- â”€â”€â”€ 3. VerificaÃ§Ã£o (retorna o que foi inserido) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
SELECT
  k.id         AS kanban_id,
  k.nome       AS kanban_nome,
  k.ativo      AS kanban_ativo,
  kf.nome      AS fase_nome,
  kf.ordem     AS fase_ordem,
  kf.sla_dias  AS sla_dias
FROM public.kanbans k
JOIN public.kanban_fases kf ON kf.kanban_id = k.id
WHERE k.nome = 'Funil Step One'
ORDER BY kf.ordem;
-- â”€â”€â”€ 093: Remove duplicatas do kanban "Funil Step One" â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- DiagnÃ³stico: mostra quantas linhas existem antes de limpar.

-- 1. Ver o que existe
SELECT id, nome, ordem, ativo, ctid
FROM public.kanbans
WHERE nome = 'Funil Step One'
ORDER BY ctid;

-- 2. Manter apenas o registro mais antigo (menor ctid) e deletar os extras
DELETE FROM public.kanbans
WHERE nome = 'Funil Step One'
  AND ctid NOT IN (
    SELECT min(ctid)
    FROM public.kanbans
    WHERE nome = 'Funil Step One'
  );

-- 3. Confirma: deve restar exatamente 1 linha
SELECT id, nome, ativo FROM public.kanbans WHERE nome = 'Funil Step One';

-- 4. Confirma as 7 fases vinculadas
SELECT kf.nome, kf.ordem, kf.sla_dias
FROM public.kanban_fases kf
JOIN public.kanbans k ON k.id = kf.kanban_id
WHERE k.nome = 'Funil Step One'
ORDER BY kf.ordem;
-- â”€â”€â”€ 094: Corrige RLS e GRANT das tabelas kanbans e kanban_fases â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Problema: pÃ¡gina /funil-stepone retorna "Kanban nÃ£o encontrado" mesmo com
-- dados presentes no banco. Causa provÃ¡vel: RLS bloqueando SELECT ou falta
-- de GRANT para os roles anon/authenticated.
--
-- DiagnÃ³stico: execute os SELECTs abaixo para ver o estado atual antes de rodar.

-- â”€â”€â”€ DiagnÃ³stico: polÃ­ticas existentes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN ('kanbans', 'kanban_fases')
-- ORDER BY tablename, policyname;

-- â”€â”€â”€ DiagnÃ³stico: grants existentes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- SELECT grantee, table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_name IN ('kanbans', 'kanban_fases')
--   AND table_schema = 'public'
-- ORDER BY table_name, grantee;

-- â”€â”€â”€ 1. kanbans: garantir RLS ativo e polÃ­tica de leitura â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.kanbans ENABLE ROW LEVEL SECURITY;

-- Remove polÃ­ticas antigas (qualquer nome) para evitar conflito
DROP POLICY IF EXISTS "kanbans_select"     ON public.kanbans;
DROP POLICY IF EXISTS "kanbans_select_all" ON public.kanbans;
DROP POLICY IF EXISTS "kanbans_admin"      ON public.kanbans;

-- Leitura: qualquer usuÃ¡rio autenticado (ou anÃ´nimo) pode ver kanbans
CREATE POLICY "kanbans_select_all"
  ON public.kanbans FOR SELECT
  USING (true);

-- Escrita: apenas admin/consultor
CREATE POLICY "kanbans_admin"
  ON public.kanbans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'consultor')
    )
  );

-- Grant explÃ­cito para os roles do Supabase
GRANT SELECT ON public.kanbans TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.kanbans TO authenticated;

-- â”€â”€â”€ 2. kanban_fases: garantir RLS ativo e polÃ­tica de leitura â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.kanban_fases ENABLE ROW LEVEL SECURITY;

-- Remove polÃ­ticas antigas
DROP POLICY IF EXISTS "kanban_fases_select"     ON public.kanban_fases;
DROP POLICY IF EXISTS "kanban_fases_select_all" ON public.kanban_fases;
DROP POLICY IF EXISTS "kanban_fases_admin"      ON public.kanban_fases;

-- Leitura: qualquer usuÃ¡rio pode ver as fases
CREATE POLICY "kanban_fases_select_all"
  ON public.kanban_fases FOR SELECT
  USING (true);

-- Escrita: apenas admin/consultor
CREATE POLICY "kanban_fases_admin"
  ON public.kanban_fases FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'consultor')
    )
  );

-- Grant explÃ­cito
GRANT SELECT ON public.kanban_fases TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.kanban_fases TO authenticated;

-- â”€â”€â”€ 3. ConfirmaÃ§Ã£o final â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Deve mostrar as 2 polÃ­ticas "_select_all" recÃ©m criadas:
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('kanbans', 'kanban_fases')
ORDER BY tablename, policyname;

-- Deve retornar 1 kanban:
SELECT id, nome, ativo FROM public.kanbans WHERE nome = 'Funil Step One';

-- Deve retornar 7 fases:
SELECT kf.nome, kf.ordem, kf.sla_dias
FROM public.kanban_fases kf
JOIN public.kanbans k ON k.id = kf.kanban_id
WHERE k.nome = 'Funil Step One'
ORDER BY kf.ordem;
-- â”€â”€â”€ 095: Atividades aprimoradas â€” Sprint C â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- "Atividades" neste projeto = tabela public.processo_card_checklist
-- Adiciona colunas de contexto kanban sem perder dados existentes.
-- Idempotente: ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- â”€â”€â”€ 1. Novas colunas em processo_card_checklist â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Estado atual da tabela (migrations 045 â†’ 090):
--   id, processo_id, etapa_painel, titulo, concluido, ordem,
--   created_at, updated_at, prazo, responsavel_nome, status,
--   time_nome, times_nomes, responsaveis_nomes

ALTER TABLE public.processo_card_checklist
  ADD COLUMN IF NOT EXISTS kanban_id     UUID REFERENCES public.kanbans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fase_id       UUID REFERENCES public.kanban_fases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS card_id       UUID REFERENCES public.kanban_cards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS franqueado_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS condominio    TEXT,
  ADD COLUMN IF NOT EXISTS lote          TEXT,
  ADD COLUMN IF NOT EXISTS quadra        TEXT;

CREATE INDEX IF NOT EXISTS idx_pcc_kanban     ON public.processo_card_checklist(kanban_id);
CREATE INDEX IF NOT EXISTS idx_pcc_fase        ON public.processo_card_checklist(fase_id);
CREATE INDEX IF NOT EXISTS idx_pcc_card        ON public.processo_card_checklist(card_id);
CREATE INDEX IF NOT EXISTS idx_pcc_franqueado  ON public.processo_card_checklist(franqueado_id);

-- â”€â”€â”€ 2. atividade_times â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Tabela de junction: times vinculados a uma atividade (processo_card_checklist).
CREATE TABLE IF NOT EXISTS public.atividade_times (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atividade_id UUID NOT NULL REFERENCES public.processo_card_checklist(id) ON DELETE CASCADE,
  time_nome    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_atividade_times_atividade ON public.atividade_times(atividade_id);

COMMENT ON TABLE public.atividade_times IS
  'Times vinculados a uma atividade (processo_card_checklist). '
  'Complementa a coluna legada times_nomes[] da tabela principal.';

-- â”€â”€â”€ 3. atividade_responsaveis â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Tabela de junction: responsÃ¡veis por atividade com referÃªncia a auth.users.
CREATE TABLE IF NOT EXISTS public.atividade_responsaveis (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atividade_id UUID NOT NULL REFERENCES public.processo_card_checklist(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE (atividade_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_atividade_resp_atividade ON public.atividade_responsaveis(atividade_id);
CREATE INDEX IF NOT EXISTS idx_atividade_resp_user      ON public.atividade_responsaveis(user_id);

COMMENT ON TABLE public.atividade_responsaveis IS
  'ResponsÃ¡veis por atividade com FK para auth.users. '
  'Complementa a coluna legada responsaveis_nomes[] da tabela principal.';

-- â”€â”€â”€ 4. duvidas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Espelha a estrutura de processo_card_checklist com tipo = 'duvida'.
CREATE TABLE IF NOT EXISTS public.duvidas (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id    UUID        REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  kanban_id      UUID        REFERENCES public.kanbans(id) ON DELETE SET NULL,
  fase_id        UUID        REFERENCES public.kanban_fases(id) ON DELETE SET NULL,
  card_id        UUID        REFERENCES public.kanban_cards(id) ON DELETE SET NULL,
  franqueado_id  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  etapa_painel   TEXT,
  titulo         TEXT        NOT NULL,
  descricao      TEXT,
  condominio     TEXT,
  lote           TEXT,
  quadra         TEXT,
  status         TEXT        NOT NULL DEFAULT 'aberta'
                             CHECK (status IN ('aberta', 'respondida', 'fechada')),
  tipo           TEXT        NOT NULL DEFAULT 'duvida',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_duvidas_processo   ON public.duvidas(processo_id);
CREATE INDEX IF NOT EXISTS idx_duvidas_kanban      ON public.duvidas(kanban_id);
CREATE INDEX IF NOT EXISTS idx_duvidas_fase         ON public.duvidas(fase_id);
CREATE INDEX IF NOT EXISTS idx_duvidas_card         ON public.duvidas(card_id);
CREATE INDEX IF NOT EXISTS idx_duvidas_franqueado   ON public.duvidas(franqueado_id);

COMMENT ON TABLE public.duvidas IS
  'DÃºvidas de franqueados. Espelha estrutura de processo_card_checklist '
  'com tipo = duvida e campos de status prÃ³prios.';

-- â”€â”€â”€ RLS: atividade_times â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.atividade_times ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "atividade_times_select" ON public.atividade_times;
CREATE POLICY "atividade_times_select"
  ON public.atividade_times FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "atividade_times_write" ON public.atividade_times;
CREATE POLICY "atividade_times_write"
  ON public.atividade_times FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

-- â”€â”€â”€ RLS: atividade_responsaveis â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.atividade_responsaveis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "atividade_responsaveis_select" ON public.atividade_responsaveis;
CREATE POLICY "atividade_responsaveis_select"
  ON public.atividade_responsaveis FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "atividade_responsaveis_write" ON public.atividade_responsaveis;
CREATE POLICY "atividade_responsaveis_write"
  ON public.atividade_responsaveis FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

-- â”€â”€â”€ RLS: duvidas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.duvidas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "duvidas_select" ON public.duvidas;
CREATE POLICY "duvidas_select"
  ON public.duvidas FOR SELECT
  USING (
    franqueado_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

DROP POLICY IF EXISTS "duvidas_insert" ON public.duvidas;
CREATE POLICY "duvidas_insert"
  ON public.duvidas FOR INSERT
  WITH CHECK (
    franqueado_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

DROP POLICY IF EXISTS "duvidas_update" ON public.duvidas;
CREATE POLICY "duvidas_update"
  ON public.duvidas FOR UPDATE
  USING (
    franqueado_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

-- â”€â”€â”€ GRANTs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atividade_times        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atividade_responsaveis TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.duvidas                 TO authenticated;
-- â”€â”€â”€ 096: SLA e arquivamento de cards â€” Sprint D â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Idempotente: CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE FUNCTION.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- â”€â”€â”€ 1. fase_sla â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.fase_sla (
  id        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  fase_id   UUID    NOT NULL REFERENCES public.kanban_fases(id) ON DELETE CASCADE,
  kanban_id UUID    NOT NULL REFERENCES public.kanbans(id) ON DELETE CASCADE,
  sla_dias  INT     NOT NULL CHECK (sla_dias > 0),
  UNIQUE (fase_id, kanban_id)
);

CREATE INDEX IF NOT EXISTS idx_fase_sla_fase   ON public.fase_sla(fase_id);
CREATE INDEX IF NOT EXISTS idx_fase_sla_kanban ON public.fase_sla(kanban_id);

COMMENT ON TABLE public.fase_sla IS 'SLA configurÃ¡vel por fase/kanban (sobrescreve sla_dias da fase).';

-- â”€â”€â”€ 2. card_arquivamento â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.card_arquivamento (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id    UUID        NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  fase_id    UUID        REFERENCES public.kanban_fases(id) ON DELETE SET NULL,
  motivo     TEXT,
  data_acao  TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_card_arquivamento_card ON public.card_arquivamento(card_id);
CREATE INDEX IF NOT EXISTS idx_card_arquivamento_user ON public.card_arquivamento(user_id);

COMMENT ON TABLE public.card_arquivamento IS 'HistÃ³rico de arquivamentos de cards.';

-- â”€â”€â”€ 3. card_vinculos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.card_vinculos (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  card_origem_id    UUID    NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  card_destino_id   UUID    NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  kanban_origem     TEXT,
  kanban_destino    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (card_origem_id, card_destino_id)
);

CREATE INDEX IF NOT EXISTS idx_card_vinculos_origem  ON public.card_vinculos(card_origem_id);
CREATE INDEX IF NOT EXISTS idx_card_vinculos_destino ON public.card_vinculos(card_destino_id);

COMMENT ON TABLE public.card_vinculos IS 'VÃ­nculos entre cards de kanbans distintos ou do mesmo.';

-- â”€â”€â”€ 4. FunÃ§Ã£o: status SLA do card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Retorna: 'ok' | 'atencao' | 'atrasado'
-- LÃ³gica:
--   dias_restantes > 1  â†’ ok
--   dias_restantes = 1  â†’ atencao  (D-1)
--   dias_restantes = 0  â†’ atencao  (vence hoje)
--   dias_restantes < 0  â†’ atrasado

CREATE OR REPLACE FUNCTION public.fn_card_sla_status(
  p_card_id    UUID,
  p_fase_id    UUID,
  p_kanban_id  UUID,
  p_created_at TIMESTAMPTZ
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_sla_dias      INT;
  v_dias_corridos INT;
  v_dias_restantes INT;
BEGIN
  -- Prioridade 1: fase_sla (configuraÃ§Ã£o especÃ­fica)
  SELECT sla_dias INTO v_sla_dias
  FROM public.fase_sla
  WHERE fase_id = p_fase_id AND kanban_id = p_kanban_id
  LIMIT 1;

  -- Prioridade 2: sla_dias da prÃ³pria kanban_fases
  IF v_sla_dias IS NULL THEN
    SELECT sla_dias INTO v_sla_dias
    FROM public.kanban_fases
    WHERE id = p_fase_id
    LIMIT 1;
  END IF;

  -- Sem SLA configurado â†’ sempre ok
  IF v_sla_dias IS NULL OR v_sla_dias <= 0 THEN
    RETURN 'ok';
  END IF;

  v_dias_corridos  := EXTRACT(DAY FROM (now() - p_created_at))::INT;
  v_dias_restantes := v_sla_dias - v_dias_corridos;

  IF v_dias_restantes < 0 THEN
    RETURN 'atrasado';
  ELSIF v_dias_restantes <= 1 THEN
    RETURN 'atencao';
  ELSE
    RETURN 'ok';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.fn_card_sla_status IS
  'Retorna ok | atencao | atrasado para um card. '
  'atencao = D-1 ou vence hoje; atrasado = SLA vencido.';

-- â”€â”€â”€ RLS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.fase_sla          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_arquivamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_vinculos     ENABLE ROW LEVEL SECURITY;

-- fase_sla: leitura pÃºblica, escrita sÃ³ admin/consultor
DROP POLICY IF EXISTS "fase_sla_select" ON public.fase_sla;
CREATE POLICY "fase_sla_select" ON public.fase_sla FOR SELECT USING (true);

DROP POLICY IF EXISTS "fase_sla_admin" ON public.fase_sla;
CREATE POLICY "fase_sla_admin"
  ON public.fase_sla FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'consultor')));

-- card_arquivamento: leitura para dono ou admin/consultor
DROP POLICY IF EXISTS "card_arquivamento_select" ON public.card_arquivamento;
CREATE POLICY "card_arquivamento_select"
  ON public.card_arquivamento FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'consultor'))
  );

DROP POLICY IF EXISTS "card_arquivamento_insert" ON public.card_arquivamento;
CREATE POLICY "card_arquivamento_insert"
  ON public.card_arquivamento FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- card_vinculos: leitura pÃºblica, escrita autenticada
DROP POLICY IF EXISTS "card_vinculos_select" ON public.card_vinculos;
CREATE POLICY "card_vinculos_select" ON public.card_vinculos FOR SELECT USING (true);

DROP POLICY IF EXISTS "card_vinculos_write" ON public.card_vinculos;
CREATE POLICY "card_vinculos_write"
  ON public.card_vinculos FOR ALL
  USING (auth.uid() IS NOT NULL);

-- GRANTs
GRANT SELECT ON public.fase_sla          TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fase_sla          TO authenticated;
GRANT SELECT, INSERT ON public.card_arquivamento TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.card_vinculos TO authenticated;
-- â”€â”€â”€ 097: Materiais e instruÃ§Ãµes por fase â€” Sprint E â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Idempotente: CREATE TABLE IF NOT EXISTS.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- â”€â”€â”€ fase_materiais â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.fase_materiais (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  fase_id    UUID        NOT NULL REFERENCES public.kanban_fases(id) ON DELETE CASCADE,
  kanban_id  UUID        NOT NULL REFERENCES public.kanbans(id) ON DELETE CASCADE,
  tipo       TEXT        NOT NULL CHECK (tipo IN ('instrucao', 'material')),
  titulo     TEXT        NOT NULL,
  conteudo   TEXT,
  url        TEXT,
  criado_por UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fase_materiais_fase   ON public.fase_materiais(fase_id);
CREATE INDEX IF NOT EXISTS idx_fase_materiais_kanban ON public.fase_materiais(kanban_id);

COMMENT ON TABLE public.fase_materiais IS
  'Materiais e instruÃ§Ãµes vinculados a fases de kanban. '
  'tipo = instrucao (texto orientativo) ou material (link/arquivo).';

-- â”€â”€â”€ RLS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.fase_materiais ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuÃ¡rio autenticado
DROP POLICY IF EXISTS "fase_materiais_select" ON public.fase_materiais;
CREATE POLICY "fase_materiais_select"
  ON public.fase_materiais FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Escrita: apenas admin e consultor
DROP POLICY IF EXISTS "fase_materiais_insert" ON public.fase_materiais;
CREATE POLICY "fase_materiais_insert"
  ON public.fase_materiais FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

DROP POLICY IF EXISTS "fase_materiais_update" ON public.fase_materiais;
CREATE POLICY "fase_materiais_update"
  ON public.fase_materiais FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

DROP POLICY IF EXISTS "fase_materiais_delete" ON public.fase_materiais;
CREATE POLICY "fase_materiais_delete"
  ON public.fase_materiais FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

-- GRANTs
GRANT SELECT ON public.fase_materiais TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.fase_materiais TO authenticated;
-- â”€â”€â”€ 098: Portal do Franqueado â€” Sprint F â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Idempotente: DO $$ com verificaÃ§Ãµes, CREATE TABLE IF NOT EXISTS.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co
-- GRANTs das tabelas criadas em 095/096/097 ficam em cada migration respectiva.
-- Este script cuida apenas de: role, convites_franqueado e RLS de kanban_cards.

-- â”€â”€â”€ 1. Role franqueado em profiles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Se a coluna role tiver CHECK constraint sem 'franqueado', recria incluindo-o.
DO $$
DECLARE
  v_constraint_name TEXT;
  v_check_clause    TEXT;
BEGIN
  SELECT cc.constraint_name, cc.check_clause
  INTO v_constraint_name, v_check_clause
  FROM information_schema.check_constraints cc
  JOIN information_schema.constraint_column_usage ccu
    ON cc.constraint_name = ccu.constraint_name
   AND cc.constraint_schema = ccu.constraint_schema
  WHERE ccu.table_schema = 'public'
    AND ccu.table_name   = 'profiles'
    AND ccu.column_name  = 'role'
  LIMIT 1;

  -- SÃ³ age se encontrou constraint E ela nÃ£o inclui 'franqueado'
  IF v_constraint_name IS NOT NULL AND v_check_clause NOT LIKE '%franqueado%' THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('admin', 'consultor', 'frank', 'franqueado'));
  END IF;
END;
$$;

-- â”€â”€â”€ 2. convites_franqueado â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.convites_franqueado (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT        NOT NULL,
  franqueado_id  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  token          TEXT        NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
  usado          BOOLEAN     NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_convites_email      ON public.convites_franqueado(email);
CREATE INDEX IF NOT EXISTS idx_convites_token      ON public.convites_franqueado(token);
CREATE INDEX IF NOT EXISTS idx_convites_franqueado ON public.convites_franqueado(franqueado_id);

COMMENT ON TABLE public.convites_franqueado IS
  'Convites de acesso ao portal do franqueado. '
  'token Ã© Ãºnico e de uso Ãºnico (usado = true apÃ³s aceite).';

-- â”€â”€â”€ 3. RLS em convites_franqueado â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.convites_franqueado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "convites_select" ON public.convites_franqueado;
CREATE POLICY "convites_select"
  ON public.convites_franqueado FOR SELECT
  USING (
    franqueado_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

DROP POLICY IF EXISTS "convites_insert" ON public.convites_franqueado;
CREATE POLICY "convites_insert"
  ON public.convites_franqueado FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

DROP POLICY IF EXISTS "convites_update" ON public.convites_franqueado;
CREATE POLICY "convites_update"
  ON public.convites_franqueado FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

-- â”€â”€â”€ 5. GRANTs â€” somente tabelas criadas nesta migration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
GRANT SELECT ON public.convites_franqueado TO authenticated;
GRANT INSERT, UPDATE ON public.convites_franqueado TO authenticated;
-- â”€â”€â”€ 099: Reabilitar RLS com polÃ­ticas permissivas (debug â†’ produÃ§Ã£o) â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Executado manualmente no DEV apÃ³s desabilitar RLS para diagnÃ³stico.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co
--
-- DiferenÃ§a em relaÃ§Ã£o a 091/094:
--   kanban_cards_select â†’ USING (true)  [antes: franqueado_id = auth.uid() OR admin]
--   kanban_cards_insert â†’ auth.uid() IS NOT NULL  [antes: franqueado_id check]
--   kanban_cards_update â†’ auth.uid() IS NOT NULL  [antes: role check]

-- â”€â”€â”€ 1. Reabilitar RLS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.kanban_cards  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanbans       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_fases  ENABLE ROW LEVEL SECURITY;

-- â”€â”€â”€ 2. kanbans: leitura pÃºblica â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DROP POLICY IF EXISTS "kanbans_select_all" ON public.kanbans;
CREATE POLICY "kanbans_select_all" ON public.kanbans
  FOR SELECT USING (true);

-- â”€â”€â”€ 3. kanban_fases: leitura pÃºblica â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DROP POLICY IF EXISTS "kanban_fases_select_all" ON public.kanban_fases;
CREATE POLICY "kanban_fases_select_all" ON public.kanban_fases
  FOR SELECT USING (true);

-- â”€â”€â”€ 4. kanban_cards: qualquer autenticado lÃª/escreve â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DROP POLICY IF EXISTS "kanban_cards_select" ON public.kanban_cards;
CREATE POLICY "kanban_cards_select" ON public.kanban_cards
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "kanban_cards_insert" ON public.kanban_cards;
CREATE POLICY "kanban_cards_insert" ON public.kanban_cards
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "kanban_cards_update" ON public.kanban_cards;
CREATE POLICY "kanban_cards_update" ON public.kanban_cards
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- â”€â”€â”€ 5. GRANTs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
GRANT SELECT, INSERT, UPDATE ON public.kanbans                  TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.kanban_fases             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_cards     TO authenticated;
GRANT SELECT ON public.processo_card_checklist                  TO authenticated;
-- Fix: Adicionar foreign key constraint que estÃ¡ faltando
-- e corrigir o relacionamento entre kanban_cards e profiles

-- Remove constraint antiga se existir (com nome diferente)
DO $$
BEGIN
  -- Remove qualquer constraint de FK existente para franqueado_id
  ALTER TABLE public.kanban_cards 
  DROP CONSTRAINT IF EXISTS kanban_cards_franqueado_id_fkey;
  
  ALTER TABLE public.kanban_cards 
  DROP CONSTRAINT IF EXISTS fk_kanban_cards_franqueado;
EXCEPTION
  WHEN undefined_object THEN
    NULL; -- Ignora se nÃ£o existir
END $$;

-- Adiciona a foreign key corretamente
ALTER TABLE public.kanban_cards
ADD CONSTRAINT kanban_cards_franqueado_id_fkey
FOREIGN KEY (franqueado_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- Cria Ã­ndice para melhor performance
CREATE INDEX IF NOT EXISTS idx_kanban_cards_franqueado_id 
ON public.kanban_cards(franqueado_id);

-- Verifica se a constraint foi criada
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'kanban_cards'
  AND kcu.column_name = 'franqueado_id';
-- Fix RLS policies para kanban_cards
-- Garantir que admins possam ver todos os cards

-- Desabilita RLS temporariamente para debug
-- ALTER TABLE public.kanban_cards DISABLE ROW LEVEL SECURITY;

-- Ou mantÃ©m RLS mas corrige as policies

-- Remove policies antigas
DROP POLICY IF EXISTS "kanban_cards_select" ON public.kanban_cards;
DROP POLICY IF EXISTS "kanban_cards_insert" ON public.kanban_cards;
DROP POLICY IF EXISTS "kanban_cards_update" ON public.kanban_cards;
DROP POLICY IF EXISTS "kanban_cards_delete" ON public.kanban_cards;

-- Policy de SELECT: admin vÃª tudo, franqueado vÃª sÃ³ os seus
CREATE POLICY "kanban_cards_select"
ON public.kanban_cards
FOR SELECT
USING (
  -- Admin ou consultor vÃª tudo
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'consultor')
  )
  OR
  -- Franqueado vÃª apenas os prÃ³prios cards
  franqueado_id = auth.uid()
);

-- Policy de INSERT: qualquer usuÃ¡rio autenticado pode criar
CREATE POLICY "kanban_cards_insert"
ON public.kanban_cards
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    -- Admin/consultor pode criar para qualquer um
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'consultor')
    )
    OR
    -- Franqueado sÃ³ pode criar cards para si mesmo
    franqueado_id = auth.uid()
  )
);

-- Policy de UPDATE: mesmo critÃ©rio do SELECT
CREATE POLICY "kanban_cards_update"
ON public.kanban_cards
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'consultor')
  )
  OR
  franqueado_id = auth.uid()
);

-- Policy de DELETE: mesmo critÃ©rio
CREATE POLICY "kanban_cards_delete"
ON public.kanban_cards
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'consultor')
  )
  OR
  franqueado_id = auth.uid()
);

-- Verificar as policies criadas
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'kanban_cards';
-- ========================================
-- Feriados Nacionais e FunÃ§Ã£o de Dias Ãšteis
-- ========================================

-- â”€â”€â”€ Tabela de feriados nacionais â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.feriados_nacionais (
  id         SERIAL PRIMARY KEY,
  data       DATE NOT NULL UNIQUE,
  nome       TEXT NOT NULL,
  fixo       BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT uk_feriados_data UNIQUE (data)
);

COMMENT ON TABLE public.feriados_nacionais IS 'Feriados nacionais brasileiros para cÃ¡lculo de dias Ãºteis no SLA.';

-- Seed: feriados nacionais fixos e mÃ³veis de 2025-2027
INSERT INTO public.feriados_nacionais (data, nome, fixo) VALUES
  -- 2025
  ('2025-01-01', 'Ano Novo', true),
  ('2025-04-18', 'PaixÃ£o de Cristo', false),
  ('2025-04-21', 'Tiradentes', true),
  ('2025-05-01', 'Dia do Trabalho', true),
  ('2025-06-19', 'Corpus Christi', false),
  ('2025-09-07', 'IndependÃªncia', true),
  ('2025-10-12', 'Nossa Senhora Aparecida', true),
  ('2025-11-02', 'Finados', true),
  ('2025-11-15', 'ProclamaÃ§Ã£o da RepÃºblica', true),
  ('2025-12-25', 'Natal', true),
  
  -- 2026
  ('2026-01-01', 'Ano Novo', true),
  ('2026-02-16', 'Carnaval', false),
  ('2026-02-17', 'Carnaval', false),
  ('2026-04-03', 'PaixÃ£o de Cristo', false),
  ('2026-04-21', 'Tiradentes', true),
  ('2026-05-01', 'Dia do Trabalho', true),
  ('2026-06-04', 'Corpus Christi', false),
  ('2026-09-07', 'IndependÃªncia', true),
  ('2026-10-12', 'Nossa Senhora Aparecida', true),
  ('2026-11-02', 'Finados', true),
  ('2026-11-15', 'ProclamaÃ§Ã£o da RepÃºblica', true),
  ('2026-12-25', 'Natal', true),
  
  -- 2027
  ('2027-01-01', 'Ano Novo', true),
  ('2027-02-08', 'Carnaval', false),
  ('2027-02-09', 'Carnaval', false),
  ('2027-03-26', 'PaixÃ£o de Cristo', false),
  ('2027-04-21', 'Tiradentes', true),
  ('2027-05-01', 'Dia do Trabalho', true),
  ('2027-05-27', 'Corpus Christi', false),
  ('2027-09-07', 'IndependÃªncia', true),
  ('2027-10-12', 'Nossa Senhora Aparecida', true),
  ('2027-11-02', 'Finados', true),
  ('2027-11-15', 'ProclamaÃ§Ã£o da RepÃºblica', true),
  ('2027-12-25', 'Natal', true)
ON CONFLICT (data) DO NOTHING;

-- â”€â”€â”€ FunÃ§Ã£o: Calcular Dias Ãšteis â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE FUNCTION public.calcular_dias_uteis(
  data_inicio DATE,
  data_fim DATE
)
RETURNS INT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  dias_uteis INT := 0;
  data_atual DATE := data_inicio;
  dia_semana INT;
  eh_feriado BOOLEAN;
BEGIN
  -- Se data fim Ã© anterior, retorna 0
  IF data_fim < data_inicio THEN
    RETURN 0;
  END IF;

  WHILE data_atual <= data_fim LOOP
    -- 0=domingo, 6=sÃ¡bado no PostgreSQL (extract dow)
    dia_semana := EXTRACT(DOW FROM data_atual);
    
    -- Verifica se Ã© feriado
    SELECT EXISTS(
      SELECT 1 FROM public.feriados_nacionais
      WHERE data = data_atual
    ) INTO eh_feriado;
    
    -- Conta apenas se nÃ£o for fim de semana e nÃ£o for feriado
    IF dia_semana NOT IN (0, 6) AND NOT eh_feriado THEN
      dias_uteis := dias_uteis + 1;
    END IF;
    
    data_atual := data_atual + 1;
  END LOOP;

  RETURN dias_uteis;
END;
$$;

COMMENT ON FUNCTION public.calcular_dias_uteis IS 'Calcula dias Ãºteis entre duas datas, excluindo sÃ¡bados, domingos e feriados nacionais.';

-- â”€â”€â”€ FunÃ§Ã£o: Adicionar Dias Ãšteis a uma Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE FUNCTION public.adicionar_dias_uteis(
  data_base DATE,
  dias_uteis_add INT
)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  dias_adicionados INT := 0;
  data_atual DATE := data_base;
  dia_semana INT;
  eh_feriado BOOLEAN;
BEGIN
  -- Se dias a adicionar Ã© 0 ou negativo, retorna a data base
  IF dias_uteis_add <= 0 THEN
    RETURN data_base;
  END IF;

  WHILE dias_adicionados < dias_uteis_add LOOP
    data_atual := data_atual + 1;
    dia_semana := EXTRACT(DOW FROM data_atual);
    
    SELECT EXISTS(
      SELECT 1 FROM public.feriados_nacionais
      WHERE data = data_atual
    ) INTO eh_feriado;
    
    IF dia_semana NOT IN (0, 6) AND NOT eh_feriado THEN
      dias_adicionados := dias_adicionados + 1;
    END IF;
  END LOOP;

  RETURN data_atual;
END;
$$;

COMMENT ON FUNCTION public.adicionar_dias_uteis IS 'Adiciona N dias Ãºteis a uma data base, pulando fins de semana e feriados.';

-- â”€â”€â”€ Testes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Teste 1: calcular dias Ãºteis entre duas datas
SELECT 
  '2026-04-13'::DATE as inicio,
  '2026-04-22'::DATE as fim,
  public.calcular_dias_uteis('2026-04-13'::DATE, '2026-04-22'::DATE) as dias_uteis;

-- Teste 2: adicionar 5 dias Ãºteis a uma data
SELECT 
  '2026-04-15'::DATE as data_base,
  public.adicionar_dias_uteis('2026-04-15'::DATE, 5) as prazo_5_dias_uteis;
-- ========================================
-- Tabela de Atividades Vinculadas aos Cards do Kanban
-- ========================================

-- â”€â”€â”€ Tabela de Atividades â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.kanban_atividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluida', 'cancelada')),
  prioridade TEXT DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
  responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  data_vencimento DATE,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  concluida_em TIMESTAMPTZ,
  ordem INT DEFAULT 0
);

COMMENT ON TABLE public.kanban_atividades IS 'Atividades vinculadas aos cards do Kanban';
COMMENT ON COLUMN public.kanban_atividades.status IS 'Status: pendente, em_andamento, concluida, cancelada';
COMMENT ON COLUMN public.kanban_atividades.prioridade IS 'Prioridade: baixa, normal, alta, urgente';
COMMENT ON COLUMN public.kanban_atividades.ordem IS 'Ordem de exibiÃ§Ã£o dentro do card';

-- Ãndices para performance
CREATE INDEX idx_kanban_atividades_card_id ON public.kanban_atividades(card_id);
CREATE INDEX idx_kanban_atividades_responsavel_id ON public.kanban_atividades(responsavel_id);
CREATE INDEX idx_kanban_atividades_status ON public.kanban_atividades(status);
CREATE INDEX idx_kanban_atividades_created_at ON public.kanban_atividades(created_at DESC);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_kanban_atividades_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.status = 'concluida' AND OLD.status != 'concluida' THEN
    NEW.concluida_em = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_kanban_atividades_updated_at
BEFORE UPDATE ON public.kanban_atividades
FOR EACH ROW
EXECUTE FUNCTION update_kanban_atividades_updated_at();

-- â”€â”€â”€ RLS Policies â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

ALTER TABLE public.kanban_atividades ENABLE ROW LEVEL SECURITY;

-- Policy: SELECT - Admin/consultor vÃª tudo, franqueado vÃª apenas seus cards
CREATE POLICY kanban_atividades_select ON public.kanban_atividades
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'consultor')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.kanban_cards
    WHERE kanban_cards.id = kanban_atividades.card_id
      AND kanban_cards.franqueado_id = auth.uid()
  )
);

-- Policy: INSERT - Admin/consultor insere em qualquer card, franqueado apenas em seus
CREATE POLICY kanban_atividades_insert ON public.kanban_atividades
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'consultor')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.kanban_cards
    WHERE kanban_cards.id = kanban_atividades.card_id
      AND kanban_cards.franqueado_id = auth.uid()
  )
);

-- Policy: UPDATE - Mesma lÃ³gica do SELECT
CREATE POLICY kanban_atividades_update ON public.kanban_atividades
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'consultor')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.kanban_cards
    WHERE kanban_cards.id = kanban_atividades.card_id
      AND kanban_cards.franqueado_id = auth.uid()
  )
);

-- Policy: DELETE - Mesma lÃ³gica do SELECT
CREATE POLICY kanban_atividades_delete ON public.kanban_atividades
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'consultor')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.kanban_cards
    WHERE kanban_cards.id = kanban_atividades.card_id
      AND kanban_cards.franqueado_id = auth.uid()
  )
);

-- ========================================
-- ðŸŽ‰ MIGRAÃ‡ÃƒO CONCLUÃDA!
-- Tabela kanban_atividades criada com sucesso
-- RLS configurado
-- Pronta para receber atividades
-- ========================================
-- ========================================
-- Adiciona campo "time" (equipe) Ã s atividades
-- ========================================

-- Adiciona coluna time (equipe/time responsÃ¡vel)
ALTER TABLE public.kanban_atividades
ADD COLUMN IF NOT EXISTS time TEXT;

COMMENT ON COLUMN public.kanban_atividades.time IS 'Equipe/time responsÃ¡vel pela atividade (comercial, operacoes, juridico, financeiro)';

-- Ãndice para filtrar por time
CREATE INDEX IF NOT EXISTS idx_kanban_atividades_time ON public.kanban_atividades(time);

-- ========================================
-- Atualiza atividades exemplo com times
-- ========================================

UPDATE public.kanban_atividades
SET time = CASE 
  WHEN titulo LIKE '%dados cadastrais%' THEN 'operacoes'
  WHEN titulo LIKE '%Validar informaÃ§Ãµes%' THEN 'juridico'
  WHEN titulo LIKE '%reuniÃ£o%' THEN 'comercial'
  WHEN titulo LIKE '%certidÃµes%' THEN 'juridico'
  WHEN titulo LIKE '%relatÃ³rio%' THEN 'operacoes'
  ELSE 'operacoes'
END
WHERE time IS NULL;

-- ========================================
-- ðŸŽ‰ MIGRAÃ‡ÃƒO CONCLUÃDA!
-- Campo "time" adicionado Ã  tabela kanban_atividades
-- Atividades exemplo atualizadas com times
-- ========================================
-- â”€â”€â”€ 105: View v_atividades_unificadas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Unifica atividades de todos os kanbans em uma Ãºnica view consultÃ¡vel.
-- SLA calculado a partir de data_vencimento da prÃ³pria atividade.
-- security_invoker = true â†’ view herda RLS das tabelas subjacentes.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- â”€â”€â”€ 1. Drop + Create â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DROP VIEW IF EXISTS public.v_atividades_unificadas;

CREATE VIEW public.v_atividades_unificadas
WITH (security_invoker = true)
AS
SELECT
  -- Identificadores
  a.id,
  a.card_id,

  -- Contexto do card
  c.titulo                                              AS card_titulo,
  f.nome                                                AS fase_nome,
  k.nome                                                AS kanban_nome,

  -- ResponsÃ¡vel
  a.responsavel_id,
  COALESCE(p.full_name, p.email)                        AS responsavel_nome,

  -- Tipo de atividade
  -- kanban_atividades representa tarefas; campo expandÃ­vel no futuro
  'tarefa'::TEXT                                        AS tipo,

  -- ConteÃºdo
  a.descricao,

  -- Timestamp
  a.created_at                                          AS criado_em,

  -- SLA calculado a partir de data_vencimento
  CASE
    WHEN a.data_vencimento IS NULL   THEN NULL
    WHEN a.data_vencimento < CURRENT_DATE THEN 'atrasado'
    WHEN a.data_vencimento = CURRENT_DATE THEN 'vence_hoje'
    ELSE 'ok'
  END::TEXT                                             AS sla_status

FROM public.kanban_atividades  a
JOIN public.kanban_cards        c ON c.id = a.card_id
JOIN public.kanban_fases        f ON f.id = c.fase_id
JOIN public.kanbans             k ON k.id = c.kanban_id
LEFT JOIN public.profiles       p ON p.id = a.responsavel_id;

COMMENT ON VIEW public.v_atividades_unificadas IS
  'VisÃ£o unificada de todas as atividades dos kanbans. '
  'Inclui contexto de card, fase e kanban. '
  'sla_status calculado a partir de data_vencimento da atividade: '
  'atrasado | vence_hoje | ok | null (sem prazo).';

-- â”€â”€â”€ 2. GRANT â€” autenticados podem consultar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- A view usa security_invoker = true, portanto as polÃ­ticas RLS das tabelas
-- subjacentes (kanban_atividades, kanban_cards) continuam valendo.
GRANT SELECT ON public.v_atividades_unificadas TO authenticated;
-- â”€â”€â”€ 106: Trigger â€” criar card no Funil Step One ao inserir franqueado â”€â”€â”€â”€â”€â”€â”€â”€
-- Dispara AFTER INSERT em rede_franqueados.
-- Busca o kanban "Funil Step One" e a fase "Dados da Cidade" dinamicamente.
-- TÃ­tulo do card: n_franquia - cidade_casa_frank - area_atuacao (partes nulas omitidas).
-- franqueado_id = auth.uid() (quem inseriu); se NULL (backend/service role) pula criaÃ§Ã£o.
-- Tratamento de erro via EXCEPTION: falhas nunca bloqueiam o INSERT do franqueado.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- â”€â”€â”€ 1. FunÃ§Ã£o do trigger â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE FUNCTION public.fn_criar_card_funil_ao_inserir_franqueado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kanban_id  UUID;
  v_fase_id    UUID;
  v_titulo     TEXT;
  v_user_id    UUID;
BEGIN
  -- â”€â”€ UsuÃ¡rio que disparou o INSERT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  -- auth.uid() retorna NULL quando chamado via service role (backend).
  -- Neste caso nÃ£o temos um dono vÃ¡lido para o card; pulamos silenciosamente.
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- â”€â”€ Localiza o kanban "Funil Step One" â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  SELECT id INTO v_kanban_id
  FROM public.kanbans
  WHERE nome = 'Funil Step One'
    AND ativo = true
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RETURN NEW; -- kanban inexistente: nÃ£o bloqueia
  END IF;

  -- â”€â”€ Localiza a fase "Dados da Cidade" (fase 1) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  SELECT id INTO v_fase_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND nome = 'Dados da Cidade'
    AND ativo = true
  LIMIT 1;

  -- Fallback: se a fase nÃ£o existir pelo nome, pega a primeira fase ativa
  IF v_fase_id IS NULL THEN
    SELECT id INTO v_fase_id
    FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id
      AND ativo = true
    ORDER BY ordem ASC
    LIMIT 1;
  END IF;

  IF v_fase_id IS NULL THEN
    RETURN NEW; -- nenhuma fase disponÃ­vel: nÃ£o bloqueia
  END IF;

  -- â”€â”€ Monta o tÃ­tulo: FK0001 - Cidade - Ãrea â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  -- CONCAT_WS ignora NULLs automaticamente; convertemos strings vazias em NULL
  -- para que partes ausentes nÃ£o gerem " -  - " no tÃ­tulo.
  v_titulo := CONCAT_WS(
    ' - ',
    NULLIF(TRIM(COALESCE(NEW.n_franquia,        '')), ''),
    NULLIF(TRIM(COALESCE(NEW.cidade_casa_frank,  '')), ''),
    NULLIF(TRIM(COALESCE(NEW.area_atuacao,       '')), '')
  );

  -- Se todos os trÃªs campos estavam vazios, usa fallback legÃ­vel
  IF v_titulo IS NULL OR v_titulo = '' THEN
    v_titulo := 'Novo Franqueado';
  END IF;

  -- â”€â”€ Insere o card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  INSERT INTO public.kanban_cards (kanban_id, fase_id, franqueado_id, titulo, status)
  VALUES (v_kanban_id, v_fase_id, v_user_id, v_titulo, 'ativo');

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- Qualquer erro inesperado (FK violada, lock timeout, etc.) nÃ£o deve
    -- impedir o INSERT principal na rede_franqueados.
    RAISE WARNING 'fn_criar_card_funil_ao_inserir_franqueado: erro ignorado â€” %', SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_criar_card_funil_ao_inserir_franqueado() IS
  'Cria automaticamente um card no kanban "Funil Step One" / fase "Dados da Cidade" '
  'sempre que um novo franqueado Ã© inserido em rede_franqueados. '
  'TÃ­tulo: n_franquia - cidade_casa_frank - area_atuacao. '
  'Sem auth.uid() (backend/service role) ou sem kanban/fase cadastrado, pula silenciosamente.';

-- â”€â”€â”€ 2. Trigger â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DROP TRIGGER IF EXISTS trg_rede_franqueados_criar_card_funil ON public.rede_franqueados;

CREATE TRIGGER trg_rede_franqueados_criar_card_funil
  AFTER INSERT ON public.rede_franqueados
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_criar_card_funil_ao_inserir_franqueado();

COMMENT ON TRIGGER trg_rede_franqueados_criar_card_funil ON public.rede_franqueados IS
  'ApÃ³s INSERT em rede_franqueados: cria card no Funil Step One (fase Dados da Cidade).';
-- â”€â”€â”€ 107: InteraÃ§Ãµes â€” tipo + multi-times em kanban_atividades â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 1. Cria tabela kanban_times (UUID + nome) semeada com times existentes.
-- 2. Adiciona coluna tipo Ã  kanban_atividades (atividade | duvida).
-- 3. Adiciona coluna times_ids UUID[] Ã  kanban_atividades (multi-times).
--    A coluna time TEXT legada Ã© mantida para compatibilidade retroativa.
-- 4. Recria v_atividades_unificadas com tipo, times_ids e times_nomes.
-- Idempotente: CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- â”€â”€â”€ 1. Tabela kanban_times â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.kanban_times (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome  TEXT NOT NULL,
  UNIQUE (nome)
);

COMMENT ON TABLE public.kanban_times IS
  'Times/equipes disponÃ­veis para atribuiÃ§Ã£o em kanban_atividades. '
  'Semeado a partir dos team_name distintos em team_members.';

-- Seed: popula com todos os times jÃ¡ cadastrados em team_members
INSERT INTO public.kanban_times (nome)
SELECT DISTINCT team_name
FROM   public.team_members
ORDER  BY team_name
ON CONFLICT (nome) DO NOTHING;

-- RLS
ALTER TABLE public.kanban_times ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kanban_times_select" ON public.kanban_times;
CREATE POLICY "kanban_times_select"
  ON public.kanban_times FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "kanban_times_admin" ON public.kanban_times;
CREATE POLICY "kanban_times_admin"
  ON public.kanban_times FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'consultor')
    )
  );

GRANT SELECT ON public.kanban_times TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.kanban_times TO authenticated;

-- â”€â”€â”€ 2. Novas colunas em kanban_atividades â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- 2a. tipo: classifica a interaÃ§Ã£o como atividade (tarefa) ou dÃºvida
ALTER TABLE public.kanban_atividades
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'atividade'
    CHECK (tipo IN ('atividade', 'duvida'));

COMMENT ON COLUMN public.kanban_atividades.tipo IS
  'Tipo da interaÃ§Ã£o: atividade (tarefa) | duvida.';

-- 2b. times_ids: array de UUIDs referenciando kanban_times
--     Complementa a coluna legada "time TEXT" â€” ambas coexistem.
ALTER TABLE public.kanban_atividades
  ADD COLUMN IF NOT EXISTS times_ids UUID[] DEFAULT '{}';

COMMENT ON COLUMN public.kanban_atividades.times_ids IS
  'Times responsÃ¡veis pela atividade (array de kanban_times.id). '
  'Substitui progressivamente a coluna legada "time TEXT".';

-- Ãndice GIN para buscas eficientes dentro do array
CREATE INDEX IF NOT EXISTS idx_kanban_atividades_times_ids
  ON public.kanban_atividades USING GIN (times_ids);

CREATE INDEX IF NOT EXISTS idx_kanban_atividades_tipo
  ON public.kanban_atividades (tipo);

-- â”€â”€â”€ 3. View v_atividades_unificadas (recriaÃ§Ã£o completa) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DROP VIEW IF EXISTS public.v_atividades_unificadas;

CREATE VIEW public.v_atividades_unificadas
WITH (security_invoker = true)
AS
SELECT
  -- Identificadores
  a.id,
  a.card_id,

  -- Contexto do card
  c.titulo                                              AS card_titulo,
  f.nome                                                AS fase_nome,
  k.nome                                                AS kanban_nome,

  -- ResponsÃ¡vel
  a.responsavel_id,
  COALESCE(p.full_name, p.email)                        AS responsavel_nome,

  -- Tipo da interaÃ§Ã£o (atividade | duvida)
  a.tipo,

  -- ConteÃºdo
  a.descricao,

  -- Times (IDs + nomes resolvidos)
  a.times_ids,
  ARRAY(
    SELECT t.nome
    FROM   public.kanban_times t
    WHERE  t.id = ANY(a.times_ids)
    ORDER  BY t.nome
  )                                                     AS times_nomes,

  -- Timestamp
  a.created_at                                          AS criado_em,

  -- SLA calculado a partir de data_vencimento da prÃ³pria atividade
  CASE
    WHEN a.data_vencimento IS NULL        THEN NULL
    WHEN a.data_vencimento < CURRENT_DATE THEN 'atrasado'
    WHEN a.data_vencimento = CURRENT_DATE THEN 'vence_hoje'
    ELSE 'ok'
  END::TEXT                                             AS sla_status

FROM public.kanban_atividades  a
JOIN public.kanban_cards        c ON c.id = a.card_id
JOIN public.kanban_fases        f ON f.id = c.fase_id
JOIN public.kanbans             k ON k.id = c.kanban_id
LEFT JOIN public.profiles       p ON p.id = a.responsavel_id;

COMMENT ON VIEW public.v_atividades_unificadas IS
  'VisÃ£o unificada de todas as atividades dos kanbans. '
  'Inclui contexto de card/fase/kanban, tipo (atividade|duvida), '
  'times_ids (array de UUIDs) e times_nomes (array de nomes resolvidos). '
  'sla_status: atrasado | vence_hoje | ok | null (sem prazo). '
  'security_invoker=true: RLS das tabelas subjacentes Ã© aplicado ao chamador.';

-- GRANT â€” autenticados podem consultar (RLS das tabelas base filtra o resultado)
GRANT SELECT ON public.v_atividades_unificadas TO authenticated;
-- â”€â”€â”€ 108: kanban_historico + triggers automÃ¡ticos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Tabela de auditoria de cards: registra mudanÃ§as de fase e interaÃ§Ãµes.
-- Triggers SECURITY DEFINER garantem escrita mesmo com RLS ativo.
-- RLS SELECT: usuÃ¡rio sÃ³ vÃª histÃ³rico de cards aos quais tem acesso.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- â”€â”€â”€ 1. Tabela kanban_historico â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.kanban_historico (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id      UUID        NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  usuario_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  usuario_nome TEXT,           -- desnormalizado: evita JOIN em consultas de auditoria
  acao         TEXT        NOT NULL
                           CHECK (acao IN (
                             'card_criado',
                             'fase_avancada',
                             'fase_retrocedida',
                             'interacao_criada',
                             'interacao_editada',
                             'campo_alterado'
                           )),
  detalhe      JSONB,          -- dados extras contextuais (fases, campos, valores)
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kanban_historico_card_id
  ON public.kanban_historico (card_id);

CREATE INDEX IF NOT EXISTS idx_kanban_historico_criado_em
  ON public.kanban_historico (criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_kanban_historico_acao
  ON public.kanban_historico (acao);

CREATE INDEX IF NOT EXISTS idx_kanban_historico_detalhe
  ON public.kanban_historico USING GIN (detalhe);

COMMENT ON TABLE public.kanban_historico IS
  'Log de auditoria de cards do kanban: mudanÃ§as de fase e interaÃ§Ãµes. '
  'Populado exclusivamente via triggers â€” nunca inserir manualmente.';

-- â”€â”€â”€ 2. RLS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.kanban_historico ENABLE ROW LEVEL SECURITY;

-- SELECT: usuÃ¡rio vÃª histÃ³rico dos cards que jÃ¡ tem acesso
-- (replica a lÃ³gica de kanban_cards_select sem criar dependÃªncia circular)
DROP POLICY IF EXISTS "kanban_historico_select" ON public.kanban_historico;
CREATE POLICY "kanban_historico_select"
  ON public.kanban_historico FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.kanban_cards kc
      WHERE kc.id = kanban_historico.card_id
        AND (
          kc.franqueado_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND role IN ('admin', 'consultor')
          )
        )
    )
  );

GRANT SELECT ON public.kanban_historico TO authenticated;

-- â”€â”€â”€ 3. Helper: resolve nome do usuÃ¡rio â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Usada pelas funÃ§Ãµes de trigger para desnormalizar usuario_nome.
CREATE OR REPLACE FUNCTION public.fn_resolve_usuario_nome(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(full_name, email)
  FROM   public.profiles
  WHERE  id = p_user_id
  LIMIT  1;
$$;

-- â”€â”€â”€ 4a. Trigger: mudanÃ§a de fase em kanban_cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Dispara AFTER UPDATE quando fase_id muda.
-- Compara kanban_fases.ordem para decidir se Ã© avanÃ§o ou retrocesso.

CREATE OR REPLACE FUNCTION public.fn_historico_fase_alterada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ordem_antiga  INT;
  v_ordem_nova    INT;
  v_nome_antiga   TEXT;
  v_nome_nova     TEXT;
  v_acao          TEXT;
  v_user_id       UUID;
BEGIN
  -- Sem mudanÃ§a efetiva de fase: nada a registrar
  IF OLD.fase_id IS NOT DISTINCT FROM NEW.fase_id THEN
    RETURN NEW;
  END IF;

  -- Busca metadados das fases
  SELECT ordem, nome INTO v_ordem_antiga, v_nome_antiga
  FROM public.kanban_fases WHERE id = OLD.fase_id;

  SELECT ordem, nome INTO v_ordem_nova, v_nome_nova
  FROM public.kanban_fases WHERE id = NEW.fase_id;

  -- Determina direÃ§Ã£o do movimento
  v_acao := CASE
    WHEN COALESCE(v_ordem_nova, 0) >= COALESCE(v_ordem_antiga, 0) THEN 'fase_avancada'
    ELSE 'fase_retrocedida'
  END;

  v_user_id := auth.uid();

  INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, detalhe)
  VALUES (
    NEW.id,
    v_user_id,
    public.fn_resolve_usuario_nome(v_user_id),
    v_acao,
    jsonb_build_object(
      'fase_anterior_id',   OLD.fase_id,
      'fase_anterior_nome', COALESCE(v_nome_antiga, ''),
      'fase_nova_id',       NEW.fase_id,
      'fase_nova_nome',     COALESCE(v_nome_nova, '')
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'fn_historico_fase_alterada: erro ignorado â€” %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kanban_cards_historico_fase ON public.kanban_cards;
CREATE TRIGGER trg_kanban_cards_historico_fase
  AFTER UPDATE OF fase_id ON public.kanban_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_historico_fase_alterada();

COMMENT ON FUNCTION public.fn_historico_fase_alterada() IS
  'Registra fase_avancada ou fase_retrocedida ao mover card entre fases. '
  'DireÃ§Ã£o determinada comparando kanban_fases.ordem das fases anterior e nova.';

-- â”€â”€â”€ 4b. Trigger: nova interaÃ§Ã£o em kanban_atividades â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE FUNCTION public.fn_historico_interacao_criada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(auth.uid(), NEW.criado_por);

  INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, detalhe)
  VALUES (
    NEW.card_id,
    v_user_id,
    public.fn_resolve_usuario_nome(v_user_id),
    'interacao_criada',
    jsonb_build_object(
      'atividade_id', NEW.id,
      'titulo',       COALESCE(NEW.titulo, ''),
      'tipo',         COALESCE(NEW.tipo, 'atividade'),
      'status',       COALESCE(NEW.status, 'pendente')
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'fn_historico_interacao_criada: erro ignorado â€” %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kanban_atividades_historico_insert ON public.kanban_atividades;
CREATE TRIGGER trg_kanban_atividades_historico_insert
  AFTER INSERT ON public.kanban_atividades
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_historico_interacao_criada();

COMMENT ON FUNCTION public.fn_historico_interacao_criada() IS
  'Registra interacao_criada ao inserir uma nova atividade num card.';

-- â”€â”€â”€ 4c. Trigger: ediÃ§Ã£o de interaÃ§Ã£o em kanban_atividades â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE FUNCTION public.fn_historico_interacao_editada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_detalhe JSONB := '{}'::JSONB;
BEGIN
  v_user_id := auth.uid();

  -- Registra campos que efetivamente mudaram
  IF OLD.titulo   IS DISTINCT FROM NEW.titulo THEN
    v_detalhe := v_detalhe || jsonb_build_object(
      'titulo_anterior', OLD.titulo,
      'titulo_novo',     NEW.titulo
    );
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_detalhe := v_detalhe || jsonb_build_object(
      'status_anterior', OLD.status,
      'status_novo',     NEW.status
    );
  END IF;

  IF OLD.descricao IS DISTINCT FROM NEW.descricao THEN
    v_detalhe := v_detalhe || jsonb_build_object(
      'descricao_alterada', true
    );
  END IF;

  IF OLD.responsavel_id IS DISTINCT FROM NEW.responsavel_id THEN
    v_detalhe := v_detalhe || jsonb_build_object(
      'responsavel_anterior', OLD.responsavel_id,
      'responsavel_novo',     NEW.responsavel_id
    );
  END IF;

  IF OLD.data_vencimento IS DISTINCT FROM NEW.data_vencimento THEN
    v_detalhe := v_detalhe || jsonb_build_object(
      'data_vencimento_anterior', OLD.data_vencimento,
      'data_vencimento_nova',     NEW.data_vencimento
    );
  END IF;

  -- Sempre inclui identificador da atividade
  v_detalhe := v_detalhe || jsonb_build_object('atividade_id', NEW.id);

  INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, detalhe)
  VALUES (
    NEW.card_id,
    v_user_id,
    public.fn_resolve_usuario_nome(v_user_id),
    'interacao_editada',
    v_detalhe
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'fn_historico_interacao_editada: erro ignorado â€” %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kanban_atividades_historico_update ON public.kanban_atividades;
CREATE TRIGGER trg_kanban_atividades_historico_update
  AFTER UPDATE ON public.kanban_atividades
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_historico_interacao_editada();

COMMENT ON FUNCTION public.fn_historico_interacao_editada() IS
  'Registra interacao_editada ao atualizar uma atividade. '
  'detalhe inclui apenas os campos que efetivamente mudaram.';
-- â”€â”€â”€ 109: ComentÃ¡rios por card do kanban (funil) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Agrega comentÃ¡rios do card; fase_id opcional (contexto ao publicar).

CREATE TABLE IF NOT EXISTS public.kanban_card_comentarios (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id    UUID        NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  fase_id    UUID        REFERENCES public.kanban_fases(id) ON DELETE SET NULL,
  autor_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  texto      TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kanban_card_comentarios_card
  ON public.kanban_card_comentarios (card_id);

CREATE INDEX IF NOT EXISTS idx_kanban_card_comentarios_created
  ON public.kanban_card_comentarios (created_at DESC);

COMMENT ON TABLE public.kanban_card_comentarios IS
  'ComentÃ¡rios do card no kanban; listagem agrega todas as fases.';

ALTER TABLE public.kanban_card_comentarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kanban_card_comentarios_select" ON public.kanban_card_comentarios;
CREATE POLICY "kanban_card_comentarios_select"
  ON public.kanban_card_comentarios FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kanban_cards c WHERE c.id = kanban_card_comentarios.card_id));

DROP POLICY IF EXISTS "kanban_card_comentarios_insert" ON public.kanban_card_comentarios;
CREATE POLICY "kanban_card_comentarios_insert"
  ON public.kanban_card_comentarios FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.kanban_cards c WHERE c.id = kanban_card_comentarios.card_id)
  );

GRANT SELECT, INSERT ON public.kanban_card_comentarios TO authenticated;
-- â”€â”€â”€ 110: v_atividades_unificadas â€” merge 106 + 107 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Garante colunas usadas pelo app (titulo, status, prazo, kanban_id, franqueado,
-- time legado) junto com tipo, times_ids e times_nomes da 107.

DROP VIEW IF EXISTS public.v_atividades_unificadas;

CREATE VIEW public.v_atividades_unificadas
WITH (security_invoker = true)
AS
SELECT
  a.id,
  a.card_id,

  c.titulo                                              AS card_titulo,
  f.nome                                                AS fase_nome,
  k.nome                                                AS kanban_nome,
  k.id                                                  AS kanban_id,

  a.responsavel_id,
  COALESCE(p.full_name, p.email)                        AS responsavel_nome,

  a.tipo,

  COALESCE(NULLIF(trim(a.titulo), ''), NULLIF(trim(a.descricao), ''), '(sem tÃ­tulo)') AS titulo,
  a.descricao,

  a.status                                              AS atividade_status,
  a.data_vencimento,
  a.time                                                AS time_nome,
  a.times_ids,
  ARRAY(
    SELECT t.nome
    FROM   public.kanban_times t
    WHERE  t.id = ANY(a.times_ids)
    ORDER  BY t.nome
  )                                                     AS times_nomes,

  COALESCE(fp.full_name, fp.email)                      AS franqueado_nome,

  a.created_at                                          AS criado_em,

  CASE
    WHEN a.data_vencimento IS NULL        THEN NULL
    WHEN a.data_vencimento < CURRENT_DATE THEN 'atrasado'
    WHEN a.data_vencimento = CURRENT_DATE THEN 'vence_hoje'
    ELSE 'ok'
  END::TEXT                                             AS sla_status

FROM public.kanban_atividades  a
JOIN public.kanban_cards        c ON c.id = a.card_id
JOIN public.kanban_fases        f ON f.id = c.fase_id
JOIN public.kanbans             k ON k.id = c.kanban_id
LEFT JOIN public.profiles       p ON p.id = a.responsavel_id
LEFT JOIN public.profiles       fp ON fp.id = c.franqueado_id;

COMMENT ON VIEW public.v_atividades_unificadas IS
  'VisÃ£o unificada de interaÃ§Ãµes (kanban_atividades): card, fase, kanban, '
  'responsÃ¡vel, tipo (atividade|duvida), conteÃºdo, SLA por data_vencimento, '
  'times multi (times_nomes) e time legado, franqueado do card.';

GRANT SELECT ON public.v_atividades_unificadas TO authenticated;
-- â”€â”€â”€ 111: Registrar todos os kanbans do sistema â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 1. Adiciona coluna descricao Ã  tabela kanbans (sem quebrar dados existentes).
-- 2. Remove duplicatas de nome antes de criar a constraint UNIQUE.
-- 3. Adiciona UNIQUE (nome) idempotentemente.
-- 4. Insere os 5 kanbans canÃ´nicos via ON CONFLICT (nome) DO NOTHING.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- â”€â”€â”€ 1. Coluna descricao â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.kanbans
  ADD COLUMN IF NOT EXISTS descricao TEXT;

COMMENT ON COLUMN public.kanbans.descricao IS
  'DescriÃ§Ã£o resumida do propÃ³sito do kanban.';

-- â”€â”€â”€ 2. Remover duplicatas por nome â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- MantÃ©m apenas a linha mais antiga (menor ctid) de cada nome.
-- Seguro mesmo se nÃ£o houver duplicatas.
DELETE FROM public.kanbans
WHERE ctid NOT IN (
  SELECT min(ctid)
  FROM   public.kanbans
  GROUP  BY nome
);

-- â”€â”€â”€ 3. UNIQUE (nome) idempotente â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname      = 'kanbans_nome_unique'
      AND  conrelid     = 'public.kanbans'::REGCLASS
  ) THEN
    ALTER TABLE public.kanbans
      ADD CONSTRAINT kanbans_nome_unique UNIQUE (nome);
  END IF;
END;
$$;

-- â”€â”€â”€ 4. Seed: 5 kanbans canÃ´nicos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO public.kanbans (nome, descricao, ordem, ativo) VALUES
  ('Funil Step One', 'Funil de viabilidade de novas franquias',  1, true),
  ('Portfolio',      'GestÃ£o de portfolio de franquias',          2, true),
  ('OperaÃ§Ãµes',      'GestÃ£o operacional de franquias',           3, true),
  ('Contabilidade',  'GestÃ£o contÃ¡bil de franquias',              4, true),
  ('CrÃ©dito',        'GestÃ£o de crÃ©dito de franquias',            5, true)
ON CONFLICT (nome) DO UPDATE
  SET descricao = EXCLUDED.descricao,
      ativo     = true
  WHERE public.kanbans.descricao IS NULL;

COMMENT ON TABLE public.kanbans IS
  'Boards de kanban do Hub Fly. '
  'Kanbans canÃ´nicos: Funil Step One, Portfolio, OperaÃ§Ãµes, Contabilidade, CrÃ©dito.';
-- Migration 112: Views de compatibilidade legado
-- Objetivo: fazer o frontend novo (KanbanBoard/KanbanCardModal) ler dados reais
-- de processo_step_one sem mover nem apagar nada.
-- ATENÃ‡ÃƒO: Requer migration 111 jÃ¡ aplicada antes de rodar esta.

-- ============================================================
-- PARTE 0: Adicionar coluna slug em kanban_fases
-- ============================================================
-- Nullable para nÃ£o quebrar as 7 fases existentes do Funil Step One.
-- O Ã­ndice Ãºnico parcial (WHERE slug IS NOT NULL) garante idempotÃªncia
-- nos INSERTs abaixo sem afetar fases sem slug.

ALTER TABLE public.kanban_fases
  ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_kanban_fases_kanban_slug
  ON public.kanban_fases (kanban_id, slug)
  WHERE slug IS NOT NULL;

-- ============================================================
-- PARTE 1: Registrar fases reais nos kanbans legados em kanban_fases
-- ============================================================

-- Contabilidade (3 fases)
INSERT INTO kanban_fases (kanban_id, nome, slug, ordem)
SELECT k.id, fase.nome, fase.slug, fase.ordem
FROM kanbans k
CROSS JOIN (VALUES
  ('Incorporadora', 'contabilidade_incorporadora', 1),
  ('SPE', 'contabilidade_spe', 2),
  ('Gestora', 'contabilidade_gestora', 3)
) AS fase(nome, slug, ordem)
WHERE k.nome = 'Contabilidade'
ON CONFLICT (kanban_id, slug) WHERE slug IS NOT NULL DO NOTHING;

-- CrÃ©dito (2 fases)
INSERT INTO kanban_fases (kanban_id, nome, slug, ordem)
SELECT k.id, fase.nome, fase.slug, fase.ordem
FROM kanbans k
CROSS JOIN (VALUES
  ('CrÃ©dito Terreno', 'credito_terreno', 1),
  ('CrÃ©dito Obra', 'credito_obra', 2)
) AS fase(nome, slug, ordem)
WHERE k.nome = 'CrÃ©dito'
ON CONFLICT (kanban_id, slug) WHERE slug IS NOT NULL DO NOTHING;

-- Portfolio + OperaÃ§Ãµes (19 fases de PAINEL_COLUMNS)
INSERT INTO kanban_fases (kanban_id, nome, slug, ordem)
SELECT k.id, fase.nome, fase.slug, fase.ordem
FROM kanbans k
CROSS JOIN (VALUES
  ('Dados do NegÃ³cio',       'step_2',                    1),
  ('AprovaÃ§Ã£o MonÃ­',         'aprovacao_moni_novo_negocio',2),
  ('DocumentaÃ§Ã£o',           'step_3',                    3),
  ('Acoplamento',            'acoplamento',               4),
  ('Step 4',                 'step_4',                    5),
  ('Step 5',                 'step_5',                    6),
  ('Step 6',                 'step_6',                    7),
  ('Step 7',                 'step_7',                    8),
  ('Passagem Wayser',        'passagem_wayser',           9),
  ('PlanialtimÃ©trico',       'planialtimetrico',          10),
  ('Sondagem',               'sondagem',                  11),
  ('Projeto Legal',          'projeto_legal',             12),
  ('AprovaÃ§Ã£o CondomÃ­nio',   'aprovacao_condominio',      13),
  ('AprovaÃ§Ã£o Prefeitura',   'aprovacao_prefeitura',      14),
  ('RevisÃ£o BCA',            'revisao_bca',               15),
  ('Processos CartorÃ¡rios',  'processos_cartorarios',     16),
  ('Aguardando CrÃ©dito',     'aguardando_credito',        17),
  ('Em Obra',                'em_obra',                   18),
  ('Moni Care',              'moni_care',                 19)
) AS fase(nome, slug, ordem)
WHERE k.nome IN ('Portfolio', 'OperaÃ§Ãµes')
ON CONFLICT (kanban_id, slug) WHERE slug IS NOT NULL DO NOTHING;

-- ============================================================
-- PARTE 2: VIEW de compatibilidade processo_step_one â†’ formato kanban_cards
-- ============================================================

CREATE OR REPLACE VIEW public.v_processo_como_kanban_cards AS
SELECT
  p.id,
  kf.kanban_id,
  kf.id          AS fase_id,
  COALESCE(
    NULLIF(TRIM(CONCAT_WS(' - ', p.numero_franquia, p.nome_condominio)), ''),
    'Sem tÃ­tulo'
  )              AS titulo,
  p.status,
  p.created_at   AS criado_em,
  p.updated_at,
  p.user_id      AS responsavel_id,
  p.etapa_painel AS etapa_slug,
  NULL::date     AS data_prazo_sla,
  'legado'       AS origem
FROM processo_step_one p
JOIN kanban_fases kf ON kf.slug = p.etapa_painel
JOIN kanbans k       ON k.id   = kf.kanban_id
WHERE k.nome IN ('Portfolio', 'OperaÃ§Ãµes', 'Contabilidade', 'CrÃ©dito')
  AND p.cancelado_em IS NULL
  AND p.removido_em  IS NULL;

GRANT SELECT ON public.v_processo_como_kanban_cards TO authenticated, anon;

-- ============================================================
-- VerificaÃ§Ã£o: quantos registros por kanban
-- ============================================================
SELECT k.nome, COUNT(*)
FROM v_processo_como_kanban_cards v
JOIN kanbans k ON k.id = v.kanban_id
GROUP BY k.nome;
GRANT SELECT ON public.v_atividades_unificadas TO authenticated, anon;
GRANT SELECT ON public.v_processo_como_kanban_cards TO authenticated, anon;
-- Migration 114: Renomear kanbans, aparar fases e corrigir nomes de fases
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ============================================================
-- PARTE 1: Renomear kanbans
-- ============================================================

UPDATE public.kanbans SET nome = 'Funil PortfÃ³lio'    WHERE nome = 'Portfolio';
UPDATE public.kanbans SET nome = 'Funil OperaÃ§Ãµes'    WHERE nome = 'OperaÃ§Ãµes';
UPDATE public.kanbans SET nome = 'Funil Contabilidade' WHERE nome = 'Contabilidade';
UPDATE public.kanbans SET nome = 'Funil CrÃ©dito'      WHERE nome = 'CrÃ©dito';

-- ============================================================
-- PARTE 2: Funil PortfÃ³lio â€” remover fases a partir de PlanialtimÃ©trico
-- (manter apenas step_2 â†’ passagem_wayser inclusive)
-- ============================================================

DELETE FROM public.kanban_fases
WHERE slug IN (
  'planialtimetrico', 'sondagem', 'projeto_legal',
  'aprovacao_condominio', 'aprovacao_prefeitura',
  'revisao_bca', 'processos_cartorarios',
  'aguardando_credito', 'em_obra', 'moni_care'
)
AND kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil PortfÃ³lio');

-- ============================================================
-- PARTE 3: Funil OperaÃ§Ãµes â€” remover fases atÃ© Passagem Wayser
-- (manter apenas planialtimetrico â†’ moni_care inclusive)
-- ============================================================

DELETE FROM public.kanban_fases
WHERE slug IN (
  'step_2', 'aprovacao_moni_novo_negocio', 'step_3', 'acoplamento',
  'step_4', 'step_5', 'step_6', 'step_7', 'passagem_wayser'
)
AND kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil OperaÃ§Ãµes');

-- ============================================================
-- PARTE 4: Corrigir nomes de fases (nomes exatos de painelColumns.ts)
-- ============================================================

-- Funil PortfÃ³lio
UPDATE public.kanban_fases SET nome = 'Step 2: Novo NegÃ³cio'                     WHERE slug = 'step_2';
UPDATE public.kanban_fases SET nome = 'AprovaÃ§Ã£o MonÃ­ - Novo NegÃ³cio'            WHERE slug = 'aprovacao_moni_novo_negocio';
UPDATE public.kanban_fases SET nome = 'Step 3: OpÃ§Ã£o'                            WHERE slug = 'step_3';
UPDATE public.kanban_fases SET nome = 'Step 4: Check Legal + Checklist de CrÃ©dito' WHERE slug = 'step_4';
-- 'acoplamento' â†’ 'Acoplamento' (jÃ¡ estÃ¡ correto)
UPDATE public.kanban_fases SET nome = 'Step 5: ComitÃª'                           WHERE slug = 'step_5';
UPDATE public.kanban_fases SET nome = 'Step 6: DiligÃªncia'                       WHERE slug = 'step_6';
UPDATE public.kanban_fases SET nome = 'Step 7: Contrato'                         WHERE slug = 'step_7';
UPDATE public.kanban_fases SET nome = 'Passagem para Wayser'                     WHERE slug = 'passagem_wayser';

-- Funil OperaÃ§Ãµes
-- 'planialtimetrico' â†’ 'PlanialtimÃ©trico' (jÃ¡ estÃ¡ correto)
UPDATE public.kanban_fases SET nome = 'Sondagem (paralelo PlanialtimÃ©trico)'     WHERE slug = 'sondagem';
-- 'projeto_legal' â†’ 'Projeto Legal' (jÃ¡ estÃ¡ correto)
UPDATE public.kanban_fases SET nome = 'AprovaÃ§Ã£o no CondomÃ­nio'                  WHERE slug = 'aprovacao_condominio';
UPDATE public.kanban_fases SET nome = 'AprovaÃ§Ã£o na Prefeitura'                  WHERE slug = 'aprovacao_prefeitura';
UPDATE public.kanban_fases SET nome = 'RevisÃ£o do BCA'                           WHERE slug = 'revisao_bca';
-- 'processos_cartorarios' â†’ 'Processos CartorÃ¡rios' (jÃ¡ estÃ¡ correto)
-- 'aguardando_credito' â†’ 'Aguardando CrÃ©dito' (jÃ¡ estÃ¡ correto)
-- 'em_obra' â†’ 'Em Obra' (jÃ¡ estÃ¡ correto)
UPDATE public.kanban_fases SET nome = 'MonÃ­ Care'                                WHERE slug = 'moni_care';

-- Funil Contabilidade
UPDATE public.kanban_fases SET nome = 'Abertura da Incorporadora'                WHERE slug = 'contabilidade_incorporadora';
UPDATE public.kanban_fases SET nome = 'Abertura da SPE'                          WHERE slug = 'contabilidade_spe';
UPDATE public.kanban_fases SET nome = 'Abertura da Gestora'                      WHERE slug = 'contabilidade_gestora';

-- Funil CrÃ©dito: 'CrÃ©dito Terreno' e 'CrÃ©dito Obra' jÃ¡ estÃ£o corretos

-- ============================================================
-- PARTE 5: Atualizar a view para usar os novos nomes dos kanbans
-- ============================================================

CREATE OR REPLACE VIEW public.v_processo_como_kanban_cards AS
SELECT
  p.id,
  kf.kanban_id,
  kf.id          AS fase_id,
  COALESCE(
    NULLIF(TRIM(CONCAT_WS(' - ', p.numero_franquia, p.nome_condominio)), ''),
    'Sem tÃ­tulo'
  )              AS titulo,
  p.status,
  p.created_at   AS criado_em,
  p.updated_at,
  p.user_id      AS responsavel_id,
  p.etapa_painel AS etapa_slug,
  NULL::date     AS data_prazo_sla,
  'legado'       AS origem
FROM processo_step_one p
JOIN kanban_fases kf ON kf.slug = p.etapa_painel
JOIN kanbans k       ON k.id   = kf.kanban_id
WHERE k.nome IN ('Funil PortfÃ³lio', 'Funil OperaÃ§Ãµes', 'Funil Contabilidade', 'Funil CrÃ©dito')
  AND p.cancelado_em IS NULL
  AND p.removido_em  IS NULL;

GRANT SELECT ON public.v_processo_como_kanban_cards TO authenticated, anon;

-- ============================================================
-- VerificaÃ§Ã£o: kanbans e contagem de fases
-- ============================================================
SELECT k.nome, COUNT(kf.id) AS total_fases
FROM public.kanbans k
LEFT JOIN public.kanban_fases kf ON kf.kanban_id = k.id
GROUP BY k.nome
ORDER BY k.nome;
UPDATE public.kanban_fases
SET sla_dias = 7
WHERE kanban_id IN (
  SELECT id FROM public.kanbans
  WHERE nome IN ('Funil PortfÃ³lio', 'Funil OperaÃ§Ãµes', 'Funil Contabilidade', 'Funil CrÃ©dito')
)
AND sla_dias IS NULL;
-- â”€â”€â”€ 116: FK suporte a cards legados (processo_step_one) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Problema: kanban_historico, kanban_atividades e kanban_card_comentarios
-- referenciavam kanban_cards(id), mas cards legados usam UUID de processo_step_one.
-- SoluÃ§Ã£o: remover FKs de card_id; em atividades, coluna origem nativo|legado.
-- Atualiza RLS e recria v_atividades_unificadas (compatÃ­vel com migration 110 + app).
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ============================================================
-- PARTE 0 â€” View depende de kanban_atividades; derrubar antes
-- ============================================================
DROP VIEW IF EXISTS public.v_atividades_unificadas;

-- ============================================================
-- PARTE 1 â€” kanban_atividades
-- ============================================================
ALTER TABLE public.kanban_atividades
  DROP CONSTRAINT IF EXISTS kanban_atividades_card_id_fkey;

ALTER TABLE public.kanban_atividades
  ADD COLUMN IF NOT EXISTS origem TEXT;

UPDATE public.kanban_atividades
SET origem = 'nativo'
WHERE origem IS NULL;

ALTER TABLE public.kanban_atividades
  ALTER COLUMN origem SET DEFAULT 'nativo';

ALTER TABLE public.kanban_atividades
  DROP CONSTRAINT IF EXISTS kanban_atividades_origem_check;

ALTER TABLE public.kanban_atividades
  ADD CONSTRAINT kanban_atividades_origem_check
  CHECK (origem IN ('nativo', 'legado'));

ALTER TABLE public.kanban_atividades
  ALTER COLUMN origem SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kanban_atividades_card_id
  ON public.kanban_atividades (card_id);

COMMENT ON COLUMN public.kanban_atividades.origem IS
  'nativo: card_id em kanban_cards. legado: card_id = processo_step_one.id.';

-- RLS: mesma regra de cards + processo dono (frank) ou jÃ¡ coberto por admin/consultor
DROP POLICY IF EXISTS kanban_atividades_select ON public.kanban_atividades;
CREATE POLICY kanban_atividades_select ON public.kanban_atividades
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'consultor')
    )
    OR EXISTS (
      SELECT 1 FROM public.kanban_cards
      WHERE kanban_cards.id = kanban_atividades.card_id
        AND kanban_cards.franqueado_id = auth.uid()
    )
    OR (
      kanban_atividades.origem = 'legado'
      AND EXISTS (
        SELECT 1 FROM public.processo_step_one p
        WHERE p.id = kanban_atividades.card_id
          AND p.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS kanban_atividades_insert ON public.kanban_atividades;
CREATE POLICY kanban_atividades_insert ON public.kanban_atividades
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'consultor')
    )
    OR EXISTS (
      SELECT 1 FROM public.kanban_cards
      WHERE kanban_cards.id = kanban_atividades.card_id
        AND kanban_cards.franqueado_id = auth.uid()
    )
    OR (
      kanban_atividades.origem = 'legado'
      AND EXISTS (
        SELECT 1 FROM public.processo_step_one p
        WHERE p.id = kanban_atividades.card_id
          AND p.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS kanban_atividades_update ON public.kanban_atividades;
CREATE POLICY kanban_atividades_update ON public.kanban_atividades
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'consultor')
    )
    OR EXISTS (
      SELECT 1 FROM public.kanban_cards
      WHERE kanban_cards.id = kanban_atividades.card_id
        AND kanban_cards.franqueado_id = auth.uid()
    )
    OR (
      kanban_atividades.origem = 'legado'
      AND EXISTS (
        SELECT 1 FROM public.processo_step_one p
        WHERE p.id = kanban_atividades.card_id
          AND p.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS kanban_atividades_delete ON public.kanban_atividades;
CREATE POLICY kanban_atividades_delete ON public.kanban_atividades
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'consultor')
    )
    OR EXISTS (
      SELECT 1 FROM public.kanban_cards
      WHERE kanban_cards.id = kanban_atividades.card_id
        AND kanban_cards.franqueado_id = auth.uid()
    )
    OR (
      kanban_atividades.origem = 'legado'
      AND EXISTS (
        SELECT 1 FROM public.processo_step_one p
        WHERE p.id = kanban_atividades.card_id
          AND p.user_id = auth.uid()
      )
    )
  );

-- ============================================================
-- PARTE 2 â€” kanban_historico
-- ============================================================
ALTER TABLE public.kanban_historico
  DROP CONSTRAINT IF EXISTS kanban_historico_card_id_fkey;

CREATE INDEX IF NOT EXISTS idx_kanban_historico_card_id
  ON public.kanban_historico (card_id);

DROP POLICY IF EXISTS "kanban_historico_select" ON public.kanban_historico;
CREATE POLICY "kanban_historico_select"
  ON public.kanban_historico FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role IN ('admin', 'consultor')
    )
    OR EXISTS (
      SELECT 1 FROM public.kanban_cards kc
      WHERE kc.id = kanban_historico.card_id
        AND kc.franqueado_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = kanban_historico.card_id
        AND p.user_id = auth.uid()
    )
  );

-- ============================================================
-- PARTE 3 â€” kanban_card_comentarios
-- ============================================================
ALTER TABLE public.kanban_card_comentarios
  DROP CONSTRAINT IF EXISTS kanban_card_comentarios_card_id_fkey;

CREATE INDEX IF NOT EXISTS idx_kanban_card_comentarios_card_id
  ON public.kanban_card_comentarios (card_id);

DROP POLICY IF EXISTS "kanban_card_comentarios_select" ON public.kanban_card_comentarios;
CREATE POLICY "kanban_card_comentarios_select"
  ON public.kanban_card_comentarios FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.kanban_cards c
      WHERE c.id = kanban_card_comentarios.card_id
    )
    OR EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = kanban_card_comentarios.card_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles pr
            WHERE pr.id = auth.uid()
              AND pr.role IN ('admin', 'consultor')
          )
        )
    )
  );

DROP POLICY IF EXISTS "kanban_card_comentarios_insert" ON public.kanban_card_comentarios;
CREATE POLICY "kanban_card_comentarios_insert"
  ON public.kanban_card_comentarios FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.kanban_cards c
        WHERE c.id = kanban_card_comentarios.card_id
      )
      OR EXISTS (
        SELECT 1 FROM public.processo_step_one p
        WHERE p.id = kanban_card_comentarios.card_id
          AND (
            p.user_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.profiles pr
              WHERE pr.id = auth.uid()
                AND pr.role IN ('admin', 'consultor')
            )
          )
      )
    )
  );

-- ============================================================
-- PARTE 4 â€” v_atividades_unificadas (nativo + legado)
-- Colunas alinhadas Ã  migration 110 (app / card-actions).
-- sla_status: NULL sem prazo (filtro "sem_prazo" no painel).
-- ============================================================
CREATE VIEW public.v_atividades_unificadas
WITH (security_invoker = true)
AS
SELECT
  a.id,
  a.card_id,

  COALESCE(kc.titulo, vmap.titulo, '(sem tÃ­tulo)') AS card_titulo,

  COALESCE(kf.nome, '') AS fase_nome,

  COALESCE(k.nome, '') AS kanban_nome,

  COALESCE(kc.kanban_id, vmap.kanban_id) AS kanban_id,

  a.responsavel_id,
  COALESCE(rsp.full_name, rsp.email) AS responsavel_nome,

  a.tipo,

  COALESCE(
    NULLIF(trim(a.titulo), ''),
    NULLIF(trim(a.descricao), ''),
    '(sem tÃ­tulo)'
  ) AS titulo,

  a.descricao,

  a.status AS atividade_status,

  a.data_vencimento,

  a.time AS time_nome,

  a.times_ids,

  ARRAY(
    SELECT t.nome
    FROM   public.kanban_times t
    WHERE  t.id = ANY (a.times_ids)
    ORDER  BY t.nome
  ) AS times_nomes,

  COALESCE(fp_card.full_name, fp_card.email, fp_leg.full_name, fp_leg.email) AS franqueado_nome,

  a.created_at AS criado_em,

  CASE
    WHEN a.data_vencimento IS NULL THEN NULL::text
    WHEN a.data_vencimento < CURRENT_DATE THEN 'atrasado'
    WHEN a.data_vencimento = CURRENT_DATE THEN 'vence_hoje'
    ELSE 'ok'
  END::text AS sla_status

FROM public.kanban_atividades a
LEFT JOIN public.kanban_cards kc
  ON kc.id = a.card_id
 AND a.origem = 'nativo'
LEFT JOIN public.v_processo_como_kanban_cards vmap
  ON vmap.id = a.card_id
 AND a.origem = 'legado'
LEFT JOIN public.kanban_fases kf
  ON kf.id = COALESCE(kc.fase_id, vmap.fase_id)
LEFT JOIN public.kanbans k
  ON k.id = COALESCE(kc.kanban_id, vmap.kanban_id)
LEFT JOIN public.profiles rsp
  ON rsp.id = a.responsavel_id
LEFT JOIN public.profiles fp_card
  ON fp_card.id = kc.franqueado_id
LEFT JOIN public.profiles fp_leg
  ON fp_leg.id = vmap.responsavel_id
WHERE
  (a.origem = 'nativo' AND kc.id IS NOT NULL)
  OR (a.origem = 'legado' AND vmap.id IS NOT NULL);

COMMENT ON VIEW public.v_atividades_unificadas IS
  'InteraÃ§Ãµes (kanban_atividades): cards nativos (kanban_cards) ou legados '
  '(processo_step_one via v_processo_como_kanban_cards). Mesmas colunas da 110.';

GRANT SELECT ON public.v_atividades_unificadas TO authenticated, anon;
-- â”€â”€â”€ 117: kanban_atividades â€” tabela central de interaÃ§Ãµes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Expande kanban_atividades com mÃºltiplos responsÃ¡veis, trava e suporte a
-- interaÃ§Ãµes originadas externamente (origem_externa, solicitante_nome/email).
-- responsavel_id (legado, singular) Ã© migrado para responsaveis_ids[].
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ============================================================
-- PARTE 1 â€” Novas colunas
-- ============================================================
ALTER TABLE public.kanban_atividades
  ADD COLUMN IF NOT EXISTS responsaveis_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trava BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS origem_externa BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS solicitante_nome TEXT,
  ADD COLUMN IF NOT EXISTS solicitante_email TEXT;

COMMENT ON COLUMN public.kanban_atividades.responsaveis_ids IS
  'Lista de responsÃ¡veis pela atividade. Substitui/complementa responsavel_id singular.';
COMMENT ON COLUMN public.kanban_atividades.trava IS
  'Se true, bloqueia avanÃ§o do card atÃ© esta atividade ser concluÃ­da.';
COMMENT ON COLUMN public.kanban_atividades.origem_externa IS
  'Se true, a atividade foi criada por solicitante externo (nÃ£o usuÃ¡rio interno).';
COMMENT ON COLUMN public.kanban_atividades.solicitante_nome IS
  'Nome do solicitante externo (quando origem_externa = true).';
COMMENT ON COLUMN public.kanban_atividades.solicitante_email IS
  'E-mail do solicitante externo (quando origem_externa = true).';

-- ============================================================
-- PARTE 2 â€” Migrar responsavel_id â†’ responsaveis_ids
-- ============================================================
UPDATE public.kanban_atividades
SET responsaveis_ids = ARRAY[responsavel_id]
WHERE responsavel_id IS NOT NULL
  AND (responsaveis_ids IS NULL OR responsaveis_ids = '{}');

-- ============================================================
-- PARTE 3 â€” Ãndices
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_kanban_atividades_responsaveis
  ON public.kanban_atividades USING GIN (responsaveis_ids);

CREATE INDEX IF NOT EXISTS idx_kanban_atividades_trava
  ON public.kanban_atividades (trava) WHERE trava = true;
-- â”€â”€â”€ 118: sirene_topicos como sub-interaÃ§Ãµes de kanban_atividades â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Vincula tÃ³picos a interaÃ§Ãµes do kanban (interacao_id), adiciona suporte a
-- mÃºltiplos times e responsÃ¡veis, e trava por tÃ³pico (jÃ¡ existia via 039,
-- adicionada aqui para times_ids e responsaveis_ids).
-- Fluxo de aprovaÃ§Ã£o Bombeiro (aprovado_bombeiro / motivo_reprovacao) Ã©
-- DESATIVADO: colunas mantidas no schema, marcadas via COMMENT.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ============================================================
-- PARTE 1 â€” Novas colunas em sirene_topicos
-- ============================================================
ALTER TABLE public.sirene_topicos
  ADD COLUMN IF NOT EXISTS interacao_id UUID REFERENCES public.kanban_atividades(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS times_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS responsaveis_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trava BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.sirene_topicos.interacao_id IS
  'VÃ­nculo com kanban_atividades: tÃ³pico como sub-interaÃ§Ã£o de uma interaÃ§Ã£o do kanban.';
COMMENT ON COLUMN public.sirene_topicos.times_ids IS
  'Times UUID responsÃ¡veis pelo tÃ³pico (complementa time_responsavel texto).';
COMMENT ON COLUMN public.sirene_topicos.responsaveis_ids IS
  'Lista de responsÃ¡veis pelo tÃ³pico. Complementa/substitui responsavel_id singular.';

-- ============================================================
-- PARTE 2 â€” Migrar responsavel_id â†’ responsaveis_ids
-- ============================================================
UPDATE public.sirene_topicos
SET responsaveis_ids = ARRAY[responsavel_id]
WHERE responsavel_id IS NOT NULL
  AND (responsaveis_ids IS NULL OR responsaveis_ids = '{}');

-- ============================================================
-- PARTE 3 â€” Desativar fluxo de aprovaÃ§Ã£o Bombeiro
-- Colunas preservadas para nÃ£o quebrar queries existentes.
-- Ver docs/SIRENE_TOPICOS_APROVACAO_BACKUP.md para reativaÃ§Ã£o.
-- ============================================================
COMMENT ON COLUMN public.sirene_topicos.aprovado_bombeiro IS
  'DESATIVADO â€” fluxo de aprovaÃ§Ã£o removido em migration 118. Ver docs/SIRENE_TOPICOS_APROVACAO_BACKUP.md';
COMMENT ON COLUMN public.sirene_topicos.motivo_reprovacao IS
  'DESATIVADO â€” fluxo de aprovaÃ§Ã£o removido em migration 118. Ver docs/SIRENE_TOPICOS_APROVACAO_BACKUP.md';

-- ============================================================
-- PARTE 4 â€” Ãndices
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sirene_topicos_interacao
  ON public.sirene_topicos (interacao_id);

CREATE INDEX IF NOT EXISTS idx_sirene_topicos_responsaveis
  ON public.sirene_topicos USING GIN (responsaveis_ids);
-- â”€â”€â”€ 119: notificaÃ§Ãµes ao atribuir interaÃ§Ãµes (kanban_atividades) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Vincula sirene_notificacoes a kanban_atividades via interacao_id e dispara
-- notificaÃ§Ã£o automÃ¡tica para cada responsÃ¡vel ao INSERT de nova interaÃ§Ã£o.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ============================================================
-- PARTE 1 â€” interacao_id em sirene_notificacoes
-- ============================================================
ALTER TABLE public.sirene_notificacoes
  ADD COLUMN IF NOT EXISTS interacao_id UUID REFERENCES public.kanban_atividades(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.sirene_notificacoes.interacao_id IS
  'ReferÃªncia Ã  interaÃ§Ã£o (kanban_atividades) que gerou a notificaÃ§Ã£o. NULL para notificaÃ§Ãµes de chamado puro.';

CREATE INDEX IF NOT EXISTS idx_sirene_notificacoes_interacao
  ON public.sirene_notificacoes (interacao_id);

-- ============================================================
-- PARTE 2 â€” Trigger: notificar responsÃ¡veis ao criar interaÃ§Ã£o
-- Silencia erros para nunca bloquear o INSERT da atividade.
-- NÃ£o notifica o prÃ³prio criador da interaÃ§Ã£o.
-- Suporta cards nativos (kanban_cards) e legados (origem = 'legado'):
-- legado nÃ£o tem linha em kanban_cards, card_titulo fica NULL â†’ omitido.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_notificar_responsaveis_interacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  resp_id    UUID;
  card_titulo TEXT;
BEGIN
  IF NEW.responsaveis_ids IS NULL OR array_length(NEW.responsaveis_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(titulo, '(sem tÃ­tulo)') INTO card_titulo
  FROM public.kanban_cards
  WHERE id = NEW.card_id
  LIMIT 1;

  FOREACH resp_id IN ARRAY NEW.responsaveis_ids LOOP
    IF resp_id != COALESCE(NEW.criado_por, '00000000-0000-0000-0000-000000000000'::uuid) THEN
      INSERT INTO public.sirene_notificacoes (user_id, interacao_id, tipo, texto)
      VALUES (
        resp_id,
        NEW.id,
        'interacao_atribuida',
        'VocÃª foi atribuÃ­do Ã  interaÃ§Ã£o "' ||
          COALESCE(NEW.titulo, NEW.descricao, 'sem tÃ­tulo') || '"' ||
          CASE WHEN card_titulo IS NOT NULL THEN ' no card ' || card_titulo ELSE '' END
      );
    END IF;
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_interacao ON public.kanban_atividades;
CREATE TRIGGER trg_notificar_interacao
  AFTER INSERT ON public.kanban_atividades
  FOR EACH ROW EXECUTE FUNCTION public.fn_notificar_responsaveis_interacao();

GRANT EXECUTE ON FUNCTION public.fn_notificar_responsaveis_interacao() TO authenticated;
-- â”€â”€â”€ 120: migrar sirene_chamados â†’ kanban_atividades â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Chamados existentes nÃ£o tÃªm card de origem; entram como origem='sirene'.
-- Expande o check de origem, torna card_id nullable, migra os chamados e
-- atualiza v_atividades_unificadas para incluir sirene e externo.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ============================================================
-- PARTE 0 â€” View depende de kanban_atividades; derrubar antes
-- ============================================================
DROP VIEW IF EXISTS public.v_atividades_unificadas;

-- ============================================================
-- PARTE 1 â€” Ampliar check de origem
-- ============================================================
ALTER TABLE public.kanban_atividades
  DROP CONSTRAINT IF EXISTS kanban_atividades_origem_check;

ALTER TABLE public.kanban_atividades
  ADD CONSTRAINT kanban_atividades_origem_check
  CHECK (origem IN ('nativo', 'legado', 'sirene', 'externo'));

-- ============================================================
-- PARTE 2 â€” card_id passa a ser nullable
-- Registros nativo/legado jÃ¡ existentes continuam com valor;
-- sirene/externo entram com card_id = NULL.
-- ============================================================
ALTER TABLE public.kanban_atividades
  ALTER COLUMN card_id DROP NOT NULL;

-- ============================================================
-- PARTE 3 â€” Migrar chamados existentes
-- Idempotente via ON CONFLICT DO NOTHING (nÃ£o hÃ¡ UNIQUE em
-- sirene_chamados.id â†’ kanban_atividades, mas o INSERT duplo
-- seria bloqueado pelo check de origem caso reexecutado num
-- banco zerado). Para evitar duplicatas em reexecuÃ§Ãµes num
-- banco com dados, filtramos chamados que jÃ¡ geraram uma
-- interaÃ§Ã£o origem='sirene' com o mesmo criado_por + created_at.
-- ============================================================
INSERT INTO public.kanban_atividades (
  titulo,
  descricao,
  tipo,
  status,
  trava,
  origem,
  criado_por,
  created_at,
  updated_at
)
SELECT
  sc.incendio                          AS titulo,
  sc.resolucao_pontual                 AS descricao,
  CASE sc.tipo
    WHEN 'hdm' THEN 'chamado_hdm'
    ELSE           'chamado_padrao'
  END                                  AS tipo,
  CASE sc.status
    WHEN 'nao_iniciado'              THEN 'pendente'
    WHEN 'em_andamento'              THEN 'em_andamento'
    WHEN 'concluido'                 THEN 'concluida'
    WHEN 'aguardando_aprovacao_criador' THEN 'em_andamento'
    ELSE                                  'pendente'
  END                                  AS status,
  sc.trava                             AS trava,
  'sirene'                             AS origem,
  sc.aberto_por                        AS criado_por,
  sc.created_at,
  sc.updated_at
FROM public.sirene_chamados sc
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_atividades ka
  WHERE ka.origem    = 'sirene'
    AND ka.criado_por = sc.aberto_por
    AND ka.created_at = sc.created_at
);

-- ============================================================
-- PARTE 4 â€” Recriar v_atividades_unificadas
-- Colunas idÃªnticas Ã  migration 116 + suporte a sirene/externo:
--   card_titulo  â†’ '(chamado direto)' | '(externo)'
--   kanban_nome  â†’ 'Sirene'           | 'Externo'
--   fase_nome    â†’ '' (sem fase)
--   kanban_id    â†’ NULL
--   franqueado_nome â†’ NULL
-- ============================================================
CREATE VIEW public.v_atividades_unificadas
WITH (security_invoker = true)
AS
SELECT
  a.id,
  a.card_id,

  COALESCE(
    kc.titulo,
    vmap.titulo,
    CASE a.origem
      WHEN 'sirene'   THEN '(chamado direto)'
      WHEN 'externo'  THEN '(externo)'
      ELSE                 '(sem tÃ­tulo)'
    END
  ) AS card_titulo,

  COALESCE(kf.nome, '') AS fase_nome,

  COALESCE(
    k.nome,
    CASE a.origem
      WHEN 'sirene'  THEN 'Sirene'
      WHEN 'externo' THEN 'Externo'
      ELSE                ''
    END
  ) AS kanban_nome,

  COALESCE(kc.kanban_id, vmap.kanban_id) AS kanban_id,

  a.responsavel_id,
  COALESCE(rsp.full_name, rsp.email) AS responsavel_nome,

  a.tipo,

  COALESCE(
    NULLIF(trim(a.titulo), ''),
    NULLIF(trim(a.descricao), ''),
    '(sem tÃ­tulo)'
  ) AS titulo,

  a.descricao,

  a.status AS atividade_status,

  a.data_vencimento,

  a.time AS time_nome,

  a.times_ids,

  ARRAY(
    SELECT t.nome
    FROM   public.kanban_times t
    WHERE  t.id = ANY (a.times_ids)
    ORDER  BY t.nome
  ) AS times_nomes,

  COALESCE(fp_card.full_name, fp_card.email, fp_leg.full_name, fp_leg.email) AS franqueado_nome,

  a.created_at AS criado_em,

  CASE
    WHEN a.data_vencimento IS NULL    THEN NULL::text
    WHEN a.data_vencimento < CURRENT_DATE THEN 'atrasado'
    WHEN a.data_vencimento = CURRENT_DATE THEN 'vence_hoje'
    ELSE 'ok'
  END::text AS sla_status

FROM public.kanban_atividades a
LEFT JOIN public.kanban_cards kc
  ON kc.id = a.card_id
 AND a.origem = 'nativo'
LEFT JOIN public.v_processo_como_kanban_cards vmap
  ON vmap.id = a.card_id
 AND a.origem = 'legado'
LEFT JOIN public.kanban_fases kf
  ON kf.id = COALESCE(kc.fase_id, vmap.fase_id)
LEFT JOIN public.kanbans k
  ON k.id = COALESCE(kc.kanban_id, vmap.kanban_id)
LEFT JOIN public.profiles rsp
  ON rsp.id = a.responsavel_id
LEFT JOIN public.profiles fp_card
  ON fp_card.id = kc.franqueado_id
LEFT JOIN public.profiles fp_leg
  ON fp_leg.id = vmap.responsavel_id
WHERE
  (a.origem = 'nativo'  AND kc.id   IS NOT NULL)
  OR (a.origem = 'legado'   AND vmap.id IS NOT NULL)
  OR  a.origem = 'sirene'
  OR  a.origem = 'externo';

COMMENT ON VIEW public.v_atividades_unificadas IS
  'InteraÃ§Ãµes (kanban_atividades): cards nativos, legados (processo_step_one), '
  'chamados Sirene (origem=sirene) e interaÃ§Ãµes externas (origem=externo). '
  'Mesmas colunas da migration 116.';

GRANT SELECT ON public.v_atividades_unificadas TO authenticated, anon;
