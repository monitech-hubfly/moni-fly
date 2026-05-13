-- Painel Novos Negócios: comentários no card com @menções, checklist por etapa, tópicos por etapa

-- Comentários no card (processo)
CREATE TABLE IF NOT EXISTS public.processo_card_comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  autor_nome TEXT,
  texto TEXT NOT NULL,
  mencoes UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processo_card_comentarios_processo ON public.processo_card_comentarios(processo_id);

COMMENT ON TABLE public.processo_card_comentarios IS 'Comentários nos cards do Painel; suporta @usuários (mencoes) para notificações.';

-- Checklist por card e etapa (itens editáveis)
CREATE TABLE IF NOT EXISTS public.processo_card_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  etapa_painel TEXT NOT NULL,
  titulo TEXT NOT NULL,
  concluido BOOLEAN NOT NULL DEFAULT false,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processo_card_checklist_processo ON public.processo_card_checklist(processo_id);
CREATE INDEX IF NOT EXISTS idx_processo_card_checklist_etapa ON public.processo_card_checklist(processo_id, etapa_painel);

COMMENT ON TABLE public.processo_card_checklist IS 'Itens de checklist dentro de cada card, por etapa do Painel.';

-- Tópicos por etapa (tarefas: prioridade, responsável, data, status, resposta/anexo)
CREATE TABLE IF NOT EXISTS public.processo_etapa_topicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  etapa_painel TEXT NOT NULL,
  titulo TEXT NOT NULL,
  prioridade TEXT DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta')),
  responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  responsavel_nome TEXT,
  data_entrega DATE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluido')),
  resposta TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processo_etapa_topicos_processo ON public.processo_etapa_topicos(processo_id);
CREATE INDEX IF NOT EXISTS idx_processo_etapa_topicos_responsavel ON public.processo_etapa_topicos(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_processo_etapa_topicos_etapa ON public.processo_etapa_topicos(processo_id, etapa_painel);

COMMENT ON TABLE public.processo_etapa_topicos IS 'Tópicos/tarefas por etapa do Painel; responsável altera status e adiciona resposta/anexo.';

-- Anexos dos tópicos
CREATE TABLE IF NOT EXISTS public.processo_etapa_topicos_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topico_id UUID NOT NULL REFERENCES public.processo_etapa_topicos(id) ON DELETE CASCADE,
  uploader_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  nome_original TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processo_etapa_topicos_anexos_topico ON public.processo_etapa_topicos_anexos(topico_id);

-- RLS: mesmo critério de processo_step_one (dono, consultor da carteira, admin)
ALTER TABLE public.processo_card_comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processo_card_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processo_etapa_topicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processo_etapa_topicos_anexos ENABLE ROW LEVEL SECURITY;

-- Políticas: quem vê o processo vê/edita comentários, checklist e tópicos
CREATE POLICY "processo_card_comentarios_all"
  ON public.processo_card_comentarios FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = processo_card_comentarios.processo_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = auth.uid() AND pf.role = 'admin')
        OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
      )
    )
  );

CREATE POLICY "processo_card_checklist_all"
  ON public.processo_card_checklist FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = processo_card_checklist.processo_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = auth.uid() AND pf.role = 'admin')
        OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
      )
    )
  );

CREATE POLICY "processo_etapa_topicos_all"
  ON public.processo_etapa_topicos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = processo_etapa_topicos.processo_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = auth.uid() AND pf.role = 'admin')
        OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
      )
    )
  );

CREATE POLICY "processo_etapa_topicos_anexos_all"
  ON public.processo_etapa_topicos_anexos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.processo_etapa_topicos t
      JOIN public.processo_step_one p ON p.id = t.processo_id
      WHERE t.id = processo_etapa_topicos_anexos.topico_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = auth.uid() AND pf.role = 'admin')
        OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
      )
    )
  );
