-- Sistema de Formulários do Hub Fly.
-- Idempotente. Aplicar em DEV. Não aplicar em PROD sem confirmação.

-- IDs de catálogo são texto: o seed usa chaves como f0rm0001-…, que não cabem em uuid.
CREATE TABLE IF NOT EXISTS public.formularios (
  id          text PRIMARY KEY,
  nome        text NOT NULL,
  descricao   text,
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.formulario_secoes (
  id                    text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  formulario_id         text NOT NULL REFERENCES public.formularios(id) ON DELETE CASCADE,
  nome                  text NOT NULL,
  ordem                 integer NOT NULL DEFAULT 0,
  condicional_campo_id  text,
  condicional_valor     text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.formulario_campos (
  id                    text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  secao_id              text NOT NULL REFERENCES public.formulario_secoes(id) ON DELETE CASCADE,
  nome                  text NOT NULL,
  tipo                  text NOT NULL,
  ordem                 integer NOT NULL DEFAULT 0,
  obrigatorio           boolean NOT NULL DEFAULT false,
  opcoes                jsonb NOT NULL DEFAULT '[]'::jsonb,
  condicional_campo_id  text,
  condicional_valor     text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'formulario_campos_tipo_chk'
  ) THEN
    ALTER TABLE public.formulario_campos
      ADD CONSTRAINT formulario_campos_tipo_chk
      CHECK (tipo IN (
        'texto_curto', 'texto_longo', 'email', 'telefone', 'moeda', 'numero',
        'data', 'link', 'arquivo_multiplo', 'link_ou_arquivo', 'select', 'checkbox'
      ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'formulario_secoes_condicional_campo_fkey'
  ) THEN
    ALTER TABLE public.formulario_secoes
      ADD CONSTRAINT formulario_secoes_condicional_campo_fkey
      FOREIGN KEY (condicional_campo_id) REFERENCES public.formulario_campos(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'formulario_campos_condicional_campo_fkey'
  ) THEN
    ALTER TABLE public.formulario_campos
      ADD CONSTRAINT formulario_campos_condicional_campo_fkey
      FOREIGN KEY (condicional_campo_id) REFERENCES public.formulario_campos(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.formulario_tokens (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formulario_id       text NOT NULL REFERENCES public.formularios(id) ON DELETE CASCADE,
  token               text NOT NULL UNIQUE,
  card_id             uuid REFERENCES public.kanban_cards(id) ON DELETE SET NULL,
  rede_franqueado_id  uuid REFERENCES public.rede_franqueados(id) ON DELETE SET NULL,
  expira_em           timestamptz,
  criado_por          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.formulario_respostas (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formulario_id           text NOT NULL REFERENCES public.formularios(id) ON DELETE CASCADE,
  token_id                uuid REFERENCES public.formulario_tokens(id) ON DELETE SET NULL,
  card_id                 uuid REFERENCES public.kanban_cards(id) ON DELETE SET NULL,
  rede_franqueado_id      uuid REFERENCES public.rede_franqueados(id) ON DELETE SET NULL,
  status                  text NOT NULL DEFAULT 'rascunho',
  numero_franquia         text,
  nome_franqueado         text,
  preenchido_por_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  enviado_em              timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'formulario_respostas_status_chk'
  ) THEN
    ALTER TABLE public.formulario_respostas
      ADD CONSTRAINT formulario_respostas_status_chk
      CHECK (status IN ('rascunho', 'enviado'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.formulario_resposta_valores (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resposta_id   uuid NOT NULL REFERENCES public.formulario_respostas(id) ON DELETE CASCADE,
  campo_id      text NOT NULL REFERENCES public.formulario_campos(id) ON DELETE CASCADE,
  valor_texto   text,
  valor_numero  numeric,
  valor_data    date,
  valor_json    jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS formulario_resposta_valores_resposta_campo_idx
  ON public.formulario_resposta_valores (resposta_id, campo_id);

CREATE TABLE IF NOT EXISTS public.formulario_resposta_arquivos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resposta_id    uuid NOT NULL REFERENCES public.formulario_respostas(id) ON DELETE CASCADE,
  campo_id       text NOT NULL REFERENCES public.formulario_campos(id) ON DELETE CASCADE,
  storage_path   text NOT NULL,
  nome_arquivo   text NOT NULL,
  mime_type      text,
  tamanho_bytes  bigint,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.formulario_fase_vinculos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formulario_id  text NOT NULL REFERENCES public.formularios(id) ON DELETE CASCADE,
  fase_id        uuid NOT NULL REFERENCES public.kanban_fases(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS formulario_fase_vinculos_form_fase_idx
  ON public.formulario_fase_vinculos (formulario_id, fase_id);

CREATE INDEX IF NOT EXISTS formulario_secoes_form_idx ON public.formulario_secoes (formulario_id, ordem);
CREATE INDEX IF NOT EXISTS formulario_campos_secao_idx ON public.formulario_campos (secao_id, ordem);
CREATE INDEX IF NOT EXISTS formulario_tokens_token_idx ON public.formulario_tokens (token);
CREATE INDEX IF NOT EXISTS formulario_respostas_form_idx ON public.formulario_respostas (formulario_id, created_at DESC);
CREATE INDEX IF NOT EXISTS formulario_respostas_card_idx ON public.formulario_respostas (card_id);
CREATE INDEX IF NOT EXISTS formulario_respostas_rede_idx ON public.formulario_respostas (rede_franqueado_id);

ALTER TABLE public.formularios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formulario_secoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formulario_campos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formulario_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formulario_respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formulario_resposta_valores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formulario_resposta_arquivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formulario_fase_vinculos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS formularios_staff_all ON public.formularios;
CREATE POLICY formularios_staff_all ON public.formularios
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  );

DROP POLICY IF EXISTS formulario_secoes_staff_all ON public.formulario_secoes;
CREATE POLICY formulario_secoes_staff_all ON public.formulario_secoes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  );

DROP POLICY IF EXISTS formulario_campos_staff_all ON public.formulario_campos;
CREATE POLICY formulario_campos_staff_all ON public.formulario_campos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  );

DROP POLICY IF EXISTS formulario_tokens_staff_all ON public.formulario_tokens;
CREATE POLICY formulario_tokens_staff_all ON public.formulario_tokens
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  );

DROP POLICY IF EXISTS formulario_respostas_staff_all ON public.formulario_respostas;
CREATE POLICY formulario_respostas_staff_all ON public.formulario_respostas
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  );

DROP POLICY IF EXISTS formulario_resposta_valores_staff_all ON public.formulario_resposta_valores;
CREATE POLICY formulario_resposta_valores_staff_all ON public.formulario_resposta_valores
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  );

DROP POLICY IF EXISTS formulario_resposta_arquivos_staff_all ON public.formulario_resposta_arquivos;
CREATE POLICY formulario_resposta_arquivos_staff_all ON public.formulario_resposta_arquivos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  );

DROP POLICY IF EXISTS formulario_fase_vinculos_staff_all ON public.formulario_fase_vinculos;
CREATE POLICY formulario_fase_vinculos_staff_all ON public.formulario_fase_vinculos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.formularios TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formulario_secoes TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formulario_campos TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formulario_tokens TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formulario_respostas TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formulario_resposta_valores TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formulario_resposta_arquivos TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formulario_fase_vinculos TO authenticated, service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('formularios-anexos', 'formularios-anexos', false, 52428800)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = 52428800;

INSERT INTO public.formularios (id, nome, descricao, ativo)
VALUES (
  'f0rm0001-0000-0000-0000-000000000001',
  'Checklist | Informações para Análise de Crédito Preliminar',
  'Informações para a análise de crédito preliminar.',
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.formulario_secoes (id, formulario_id, nome, ordem)
VALUES (
  'f0rms001-0000-0000-0000-000000000001',
  'f0rm0001-0000-0000-0000-000000000001',
  'Seção 1',
  1
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.formulario_campos (id, secao_id, nome, tipo, ordem, obrigatorio, opcoes)
VALUES (
  'f0rmc001-0000-0000-0000-000000000024',
  'f0rms001-0000-0000-0000-000000000001',
  'Gadgets',
  'checkbox',
  24,
  false,
  '[]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.kanban_historico DROP CONSTRAINT IF EXISTS kanban_historico_acao_check;
ALTER TABLE public.kanban_historico
  ADD CONSTRAINT kanban_historico_acao_check
  CHECK (acao = ANY (ARRAY[
    'card_criado',
    'fase_avancada',
    'fase_retrocedida',
    'interacao_criada',
    'interacao_editada',
    'interacao_arquivada',
    'campo_alterado',
    'card_arquivado',
    'card_concluido',
    'card_finalizado',
    'comentario_criado',
    'tag_vinculada',
    'tag_removida',
    'bastao_retorno',
    'sla_justificado',
    'links_gbox_acoplamento',
    'card_reativado',
    'formulario_enviado'
  ]));

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('602', 'formularios_sistema')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
