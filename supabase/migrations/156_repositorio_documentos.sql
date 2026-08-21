CREATE TABLE public.repositorio_secoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.repositorio_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secao_id UUID NOT NULL REFERENCES public.repositorio_secoes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  storage_path TEXT NOT NULL,
  bucket TEXT NOT NULL DEFAULT 'documentos-templates',
  criado_por UUID REFERENCES auth.users(id),
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.repositorio_secoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repositorio_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "repositorio_select" ON public.repositorio_secoes
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "repositorio_admin" ON public.repositorio_secoes
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "repositorio_docs_select" ON public.repositorio_documentos
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "repositorio_docs_admin" ON public.repositorio_documentos
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

GRANT ALL ON public.repositorio_secoes TO authenticated;
GRANT ALL ON public.repositorio_documentos TO authenticated;

-- Seed: seção Pré Qualificação
INSERT INTO public.repositorio_secoes (nome, ordem)
VALUES ('Pré Qualificação', 1);
