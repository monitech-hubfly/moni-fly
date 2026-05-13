-- Tabela Rede de Franqueados (dados exibidos dentro da ferramenta em /rede-franqueados e COMUNIDADE)
CREATE TABLE public.rede_franqueados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem INT NOT NULL DEFAULT 0,
  nome TEXT,
  unidade TEXT,
  cidade TEXT,
  estado TEXT,
  email TEXT,
  telefone TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rede_franqueados_ordem ON public.rede_franqueados (ordem);

ALTER TABLE public.rede_franqueados ENABLE ROW LEVEL SECURITY;

-- Leitores autenticados podem ver (admin na /rede-franqueados e franqueados na COMUNIDADE)
CREATE POLICY "rede_franqueados_select_authenticated"
  ON public.rede_franqueados FOR SELECT
  TO authenticated
  USING (true);

-- Apenas admin pode inserir/atualizar/remover
CREATE POLICY "rede_franqueados_insert_admin"
  ON public.rede_franqueados FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "rede_franqueados_update_admin"
  ON public.rede_franqueados FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "rede_franqueados_delete_admin"
  ON public.rede_franqueados FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

COMMENT ON TABLE public.rede_franqueados IS 'Rede de franqueados exibida na ferramenta (fonte de dados é esta tabela, não planilha externa)';
