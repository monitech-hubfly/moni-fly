-- Checklist Crédito (Step 4)

CREATE TABLE IF NOT EXISTS public.checklist_credito (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  franqueado_id UUID,
  nome_franqueado TEXT,

  -- Imóvel
  upload_iptu TEXT,
  upload_matricula TEXT,
  upload_orcamento_cronograma TEXT,
  upload_projeto_aprovado TEXT,

  -- Documentos pessoais
  uploads_documentos_pessoais TEXT[],

  -- Categoria profissional
  categoria_profissional TEXT,

  -- Empresário
  upload_contrato_social TEXT,
  uploads_extratos_pf TEXT[],
  upload_irpf TEXT,
  operacao_acima_3m BOOLEAN,
  uploads_extratos_pj TEXT[],
  upload_faturamento_12m TEXT,

  -- Assalariado
  uploads_ctps TEXT[],
  uploads_holerite TEXT[],

  -- Funcionário Público / Aposentado
  upload_comprovante_salario TEXT,

  -- Profissional Liberal / Autônomo
  descricao_atividade TEXT,
  presta_servico_empresas BOOLEAN,
  upload_contrato_prestacao TEXT,

  -- Renda de Aluguel
  upload_contrato_aluguel TEXT,
  uploads_extratos_aluguel TEXT[],

  -- PJ
  valor_operacao_pj TEXT,
  upload_contrato_social_pj TEXT,
  upload_faturamento_pj TEXT,
  uploads_extratos_pj_cc TEXT[],
  upload_balanco_dre TEXT,
  endividamento_info TEXT,

  preenchido_por UUID REFERENCES auth.users(id),
  completo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_checklist_credito_processo ON public.checklist_credito(processo_id);
CREATE INDEX IF NOT EXISTS idx_checklist_credito_franqueado ON public.checklist_credito(franqueado_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.credito_acesso_permitido (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  nome TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_credito_acesso_permitido_user_id ON public.credito_acesso_permitido(user_id);

ALTER TABLE public.checklist_credito ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura autenticada" ON public.checklist_credito;
CREATE POLICY "Leitura autenticada"
  ON public.checklist_credito
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Insert autenticado" ON public.checklist_credito;
CREATE POLICY "Insert autenticado"
  ON public.checklist_credito
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Update pelo preenchedor" ON public.checklist_credito;
CREATE POLICY "Update pelo preenchedor"
  ON public.checklist_credito
  FOR UPDATE
  USING (auth.uid() = preenchido_por);

ALTER TABLE public.credito_acesso_permitido ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura autenticada" ON public.credito_acesso_permitido;
CREATE POLICY "Leitura autenticada"
  ON public.credito_acesso_permitido
  FOR SELECT
  USING (auth.role() = 'authenticated');

