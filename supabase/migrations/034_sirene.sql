-- Sirene - Central de Chamados (evolução do R.I.P.)
-- Papéis: Bombeiro, Times, Caneta Verde, Criador do chamado.
-- Estender role em profiles para incluir bombeiro e caneta_verde (opcional, via tabela de papeis).

-- Tabela de papeis Sirene (quem é bombeiro / caneta verde)
CREATE TABLE IF NOT EXISTS public.sirene_papeis (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  papel TEXT NOT NULL CHECK (papel IN ('bombeiro', 'caneta_verde')),
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.sirene_papeis IS 'Atribuição de papéis Sirene: bombeiro ou caneta_verde. Quem não está aqui é time ou criador conforme contexto.';

-- Sequence para número do chamado
CREATE SEQUENCE IF NOT EXISTS public.sirene_numero_seq START WITH 1;

-- 4.1 Tabela principal: sirene_chamados
CREATE TABLE IF NOT EXISTS public.sirene_chamados (
  id BIGSERIAL PRIMARY KEY,
  numero INTEGER UNIQUE NOT NULL DEFAULT nextval('public.sirene_numero_seq'),
  data_abertura TIMESTAMPTZ DEFAULT now(),
  time_abertura TEXT,
  frank_id TEXT,
  frank_nome TEXT,
  aberto_por UUID REFERENCES auth.users(id),
  aberto_por_nome TEXT,
  trava BOOLEAN DEFAULT false,
  incendio TEXT NOT NULL,
  prioridade TEXT DEFAULT 'Média',
  status TEXT DEFAULT 'nao_iniciado' CHECK (status IN ('nao_iniciado', 'em_andamento', 'concluido')),
  resolucao_pontual TEXT,
  data_inicio_atendimento TIMESTAMPTZ,
  data_conclusao TIMESTAMPTZ,
  tema TEXT,
  mapeamento_pericia TEXT,
  parecer_final TEXT,
  resolucao_suficiente BOOLEAN,
  motivo_insuficiente TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4.2 Tabela: sirene_topicos
CREATE TABLE IF NOT EXISTS public.sirene_topicos (
  id BIGSERIAL PRIMARY KEY,
  chamado_id BIGINT NOT NULL REFERENCES public.sirene_chamados(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL,
  descricao TEXT NOT NULL,
  time_responsavel TEXT NOT NULL,
  responsavel_id UUID REFERENCES auth.users(id),
  responsavel_nome TEXT,
  data_inicio DATE,
  data_fim DATE,
  status TEXT DEFAULT 'nao_iniciado' CHECK (status IN ('nao_iniciado', 'em_andamento', 'concluido', 'aprovado')),
  resolucao_time TEXT,
  aprovado_bombeiro BOOLEAN,
  motivo_reprovacao TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sirene_topicos_chamado ON public.sirene_topicos(chamado_id);

-- 4.3 Tabela: sirene_anexos (topico_id NULL se anexo do chamado)
CREATE TABLE IF NOT EXISTS public.sirene_anexos (
  id BIGSERIAL PRIMARY KEY,
  chamado_id BIGINT NOT NULL REFERENCES public.sirene_chamados(id) ON DELETE CASCADE,
  topico_id BIGINT REFERENCES public.sirene_topicos(id) ON DELETE CASCADE,
  uploader_id UUID REFERENCES auth.users(id),
  uploader_nome TEXT,
  storage_path TEXT NOT NULL,
  nome_original TEXT,
  tipo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sirene_anexos_chamado ON public.sirene_anexos(chamado_id);

-- 4.4 Tabela: sirene_mensagens (canal interno por chamado; suporta @menções)
CREATE TABLE IF NOT EXISTS public.sirene_mensagens (
  id BIGSERIAL PRIMARY KEY,
  chamado_id BIGINT NOT NULL REFERENCES public.sirene_chamados(id) ON DELETE CASCADE,
  autor_id UUID REFERENCES auth.users(id),
  autor_nome TEXT,
  autor_time TEXT,
  texto TEXT NOT NULL,
  mencoes UUID[],
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sirene_mensagens_chamado ON public.sirene_mensagens(chamado_id);

-- 4.5 Tabela: sirene_pericias (Caneta Verde)
CREATE TABLE IF NOT EXISTS public.sirene_pericias (
  id BIGSERIAL PRIMARY KEY,
  nome_pericia TEXT NOT NULL,
  time_responsavel TEXT,
  responsavel_id UUID REFERENCES auth.users(id),
  responsavel_nome TEXT,
  data_inicio DATE,
  status TEXT DEFAULT 'nao_iniciado',
  prioridade TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4.6 Tabela N:N sirene_pericia_chamados
CREATE TABLE IF NOT EXISTS public.sirene_pericia_chamados (
  pericia_id BIGINT NOT NULL REFERENCES public.sirene_pericias(id) ON DELETE CASCADE,
  chamado_id BIGINT NOT NULL REFERENCES public.sirene_chamados(id) ON DELETE CASCADE,
  PRIMARY KEY (pericia_id, chamado_id)
);

-- 4.7 Tabela: sirene_notificacoes
CREATE TABLE IF NOT EXISTS public.sirene_notificacoes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chamado_id BIGINT REFERENCES public.sirene_chamados(id) ON DELETE CASCADE,
  tipo TEXT,
  lida BOOLEAN DEFAULT false,
  texto TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sirene_notificacoes_user ON public.sirene_notificacoes(user_id);
CREATE INDEX IF NOT EXISTS idx_sirene_notificacoes_chamado ON public.sirene_notificacoes(chamado_id);

-- RLS
ALTER TABLE public.sirene_papeis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sirene_chamados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sirene_topicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sirene_anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sirene_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sirene_pericias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sirene_pericia_chamados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sirene_notificacoes ENABLE ROW LEVEL SECURITY;

-- Função: usuário é bombeiro ou caneta_verde
CREATE OR REPLACE FUNCTION public.get_my_sirene_papel()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT papel FROM public.sirene_papeis WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Franqueado: só seus chamados (aberto_por = auth.uid())
-- Time: chamados onde time_abertura = seu time OU tem tópico atribuído ao seu time/responsável
-- Bombeiro/Caneta Verde: acesso total
CREATE POLICY "sirene_chamados_select"
  ON public.sirene_chamados FOR SELECT
  USING (
    aberto_por = auth.uid()
    OR public.get_my_sirene_papel() IN ('bombeiro', 'caneta_verde')
    OR EXISTS (
      SELECT 1 FROM public.sirene_topicos t
      WHERE t.chamado_id = sirene_chamados.id
      AND (t.responsavel_id = auth.uid() OR t.time_responsavel = (SELECT p.full_name FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1))
    )
  );

CREATE POLICY "sirene_chamados_insert"
  ON public.sirene_chamados FOR INSERT
  WITH CHECK (true);

CREATE POLICY "sirene_chamados_update"
  ON public.sirene_chamados FOR UPDATE
  USING (
    aberto_por = auth.uid()
    OR public.get_my_sirene_papel() IN ('bombeiro', 'caneta_verde')
    OR EXISTS (SELECT 1 FROM public.sirene_topicos t WHERE t.chamado_id = sirene_chamados.id AND t.responsavel_id = auth.uid())
  );

-- Tópicos: quem vê o chamado vê os tópicos
CREATE POLICY "sirene_topicos_all"
  ON public.sirene_topicos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.sirene_chamados c WHERE c.id = sirene_topicos.chamado_id
      AND (
        c.aberto_por = auth.uid()
        OR public.get_my_sirene_papel() IN ('bombeiro', 'caneta_verde')
        OR EXISTS (SELECT 1 FROM public.sirene_topicos t WHERE t.chamado_id = c.id AND t.responsavel_id = auth.uid())
      )
    )
  );

-- Anexos: quem vê o chamado vê os anexos
CREATE POLICY "sirene_anexos_all"
  ON public.sirene_anexos FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.sirene_chamados c WHERE c.id = sirene_anexos.chamado_id AND (
      c.aberto_por = auth.uid()
      OR public.get_my_sirene_papel() IN ('bombeiro', 'caneta_verde')
      OR EXISTS (SELECT 1 FROM public.sirene_topicos t WHERE t.chamado_id = c.id AND t.responsavel_id = auth.uid())
    ))
  );

-- Mensagens: participantes do chamado
CREATE POLICY "sirene_mensagens_select"
  ON public.sirene_mensagens FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.sirene_chamados c WHERE c.id = sirene_mensagens.chamado_id AND (
      c.aberto_por = auth.uid()
      OR public.get_my_sirene_papel() IN ('bombeiro', 'caneta_verde')
      OR EXISTS (SELECT 1 FROM public.sirene_topicos t WHERE t.chamado_id = c.id AND t.responsavel_id = auth.uid())
    ))
  );

CREATE POLICY "sirene_mensagens_insert"
  ON public.sirene_mensagens FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Perícias: bombeiro e caneta_verde
CREATE POLICY "sirene_pericias_all"
  ON public.sirene_pericias FOR ALL
  USING (public.get_my_sirene_papel() IN ('bombeiro', 'caneta_verde'));

CREATE POLICY "sirene_pericia_chamados_all"
  ON public.sirene_pericia_chamados FOR ALL
  USING (public.get_my_sirene_papel() IN ('bombeiro', 'caneta_verde'));

-- Notificações: cada um vê as suas
CREATE POLICY "sirene_notificacoes_own"
  ON public.sirene_notificacoes FOR ALL
  USING (user_id = auth.uid());

-- Papeis: só admin gerencia (opcional)
CREATE POLICY "sirene_papeis_admin"
  ON public.sirene_papeis FOR ALL
  USING (public.get_my_role() = 'admin');

-- Bucket para anexos dos chamados (path: chamado_{id}/ ou chamado_{id}/topico_{id}/)
INSERT INTO storage.buckets (id, name, public)
VALUES ('sirene-attachments', 'sirene-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "sirene_attachments_authenticated"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'sirene-attachments')
  WITH CHECK (bucket_id = 'sirene-attachments');
