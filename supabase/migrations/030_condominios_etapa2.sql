-- Etapa 2: condomínios encontrados via ZAP (casas >5MM) e checklist detalhado por condomínio

CREATE TABLE public.condominios_etapa2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  nome TEXT,
  qtd_casas INTEGER,
  preco_medio NUMERIC,
  m2_medio NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_condominios_etapa2_processo ON public.condominios_etapa2(processo_id);

CREATE TABLE public.checklist_condominios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  condominio_id UUID REFERENCES public.condominios_etapa2(id) ON DELETE CASCADE,
  lotes_total INTEGER,
  lotes_disponiveis INTEGER,
  lotes_tamanho_medio NUMERIC,
  lotes_preco_m2 NUMERIC,
  lotes_area_valorizada TEXT,
  casas_prontas INTEGER,
  casas_construindo INTEGER,
  casas_construindo_venda INTEGER,
  casas_construindo_cliente INTEGER,
  casas_para_venda INTEGER,
  casas_preco_m2 NUMERIC,
  casas_tempo_medio_venda NUMERIC,
  casas_vendidas_12m INTEGER,
  casas_remanescentes_motivo TEXT,
  casas_impacto_negativo TEXT,
  casas_erros_projeto TEXT,
  casas_caracteristicas_elogiadas TEXT,
  casas_caracteristicas_buscadas TEXT,
  locacao_exemplos TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklist_condominios_processo ON public.checklist_condominios(processo_id);
CREATE INDEX IF NOT EXISTS idx_checklist_condominios_condominio ON public.checklist_condominios(condominio_id);

-- RLS: Frank só acessa dados dos próprios processos
ALTER TABLE public.condominios_etapa2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_condominios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Frank condominios_etapa2" ON public.condominios_etapa2;
CREATE POLICY "Frank condominios_etapa2" ON public.condominios_etapa2 FOR ALL
  USING (EXISTS (SELECT 1 FROM public.processo_step_one p WHERE p.id = processo_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "Frank checklist_condominios" ON public.checklist_condominios;
CREATE POLICY "Frank checklist_condominios" ON public.checklist_condominios FOR ALL
  USING (EXISTS (SELECT 1 FROM public.processo_step_one p WHERE p.id = processo_id AND p.user_id = auth.uid()));

