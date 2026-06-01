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
