-- Módulo jurídico: canal de dúvidas, comentários internos, anexos e documentos templates

-- Tickets de dúvidas jurídicas
CREATE TABLE IF NOT EXISTS public.juridico_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nova_duvida' CHECK (
    status IN ('nova_duvida', 'em_analise', 'paralisado', 'finalizado')
  ),
  resposta_publica TEXT,
  resposta_publica_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_juridico_tickets_user ON public.juridico_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_juridico_tickets_status ON public.juridico_tickets(status);

-- Comentários internos do time Moní (não visíveis para Frank)
CREATE TABLE IF NOT EXISTS public.juridico_ticket_comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.juridico_tickets(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_juridico_ticket_comentarios_ticket ON public.juridico_ticket_comentarios(ticket_id);

-- Anexos de tickets (Frank e Moní)
CREATE TABLE IF NOT EXISTS public.juridico_ticket_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.juridico_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lado TEXT NOT NULL CHECK (lado IN ('frank', 'moni')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_juridico_ticket_anexos_ticket ON public.juridico_ticket_anexos(ticket_id);

-- Documentos / contratos templates disponíveis para o franqueado
CREATE TABLE IF NOT EXISTS public.juridico_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT,
  file_url TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_juridico_documentos_ativo ON public.juridico_documentos(ativo);

-- RLS: tickets
ALTER TABLE public.juridico_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Frank own juridico_tickets" ON public.juridico_tickets;
DROP POLICY IF EXISTS "Moni manage juridico_tickets" ON public.juridico_tickets;

-- Frank enxerga e gerencia apenas os próprios tickets
CREATE POLICY "Frank own juridico_tickets"
  ON public.juridico_tickets
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Consultor/Admin enxergam e podem gerenciar todos os tickets
CREATE POLICY "Moni manage juridico_tickets"
  ON public.juridico_tickets
  FOR ALL
  USING (public.get_my_role() IN ('consultor', 'admin'));

-- RLS: comentários internos (apenas Moní / admin)
ALTER TABLE public.juridico_ticket_comentarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Moni read juridico_comentarios" ON public.juridico_ticket_comentarios;
DROP POLICY IF EXISTS "Moni write juridico_comentarios" ON public.juridico_ticket_comentarios;

CREATE POLICY "Moni read juridico_comentarios"
  ON public.juridico_ticket_comentarios
  FOR SELECT
  USING (public.get_my_role() IN ('consultor', 'admin'));

CREATE POLICY "Moni write juridico_comentarios"
  ON public.juridico_ticket_comentarios
  FOR ALL
  USING (public.get_my_role() IN ('consultor', 'admin'))
  WITH CHECK (public.get_my_role() IN ('consultor', 'admin'));

-- RLS: anexos de tickets
ALTER TABLE public.juridico_ticket_anexos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Frank own juridico_anexos" ON public.juridico_ticket_anexos;
DROP POLICY IF EXISTS "Moni all juridico_anexos" ON public.juridico_ticket_anexos;

-- Frank enxerga anexos ligados a tickets dele (tanto enviados por ele quanto pela Moní)
CREATE POLICY "Frank own juridico_anexos"
  ON public.juridico_ticket_anexos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.juridico_tickets t
      WHERE t.id = ticket_id
        AND t.user_id = auth.uid()
    )
  );

-- Frank só pode inserir anexos próprios
CREATE POLICY "Frank insert juridico_anexos"
  ON public.juridico_ticket_anexos
  FOR INSERT
  WITH CHECK (user_id = auth.uid() AND lado = 'frank');

-- Moní enxerga e gerencia todos os anexos
CREATE POLICY "Moni all juridico_anexos"
  ON public.juridico_ticket_anexos
  FOR ALL
  USING (public.get_my_role() IN ('consultor', 'admin'))
  WITH CHECK (public.get_my_role() IN ('consultor', 'admin'));

-- RLS: documentos jurídicos (templates)
ALTER TABLE public.juridico_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "All read juridico_documentos" ON public.juridico_documentos;
DROP POLICY IF EXISTS "Moni manage juridico_documentos" ON public.juridico_documentos;

-- Qualquer usuário autenticado pode ler documentos ativos
CREATE POLICY "All read juridico_documentos"
  ON public.juridico_documentos
  FOR SELECT
  USING (ativo = true);

-- Apenas consultor/admin podem criar/alterar documentos
CREATE POLICY "Moni manage juridico_documentos"
  ON public.juridico_documentos
  FOR ALL
  USING (public.get_my_role() IN ('consultor', 'admin'))
  WITH CHECK (public.get_my_role() IN ('consultor', 'admin'));

