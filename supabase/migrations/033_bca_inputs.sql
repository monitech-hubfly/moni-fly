-- BCA (Business Case Analysis) - inputs por processo
-- vgv_planta e obra_mes8 são calculados no cliente; não existem no banco.

CREATE TABLE IF NOT EXISTS public.bca_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  -- Identificação
  nome_condominio TEXT DEFAULT '',
  nome_casa TEXT DEFAULT '',
  area_vendas_m2 NUMERIC DEFAULT 627,
  -- Terreno
  custo_terreno NUMERIC DEFAULT -1000000,
  itbi_percentual NUMERIC DEFAULT 0.04,
  -- Casa e obra
  custo_casa NUMERIC DEFAULT -2510000,
  mes_inicio_obra INTEGER DEFAULT 3,
  -- Fluxo de obra (mês 8 = 1 - SUM(mes1..mes7); NÃO salvar obra_mes8)
  obra_mes1 NUMERIC DEFAULT 0.15,
  obra_mes2 NUMERIC DEFAULT 0.25,
  obra_mes3 NUMERIC DEFAULT 0.18,
  obra_mes4 NUMERIC DEFAULT 0.10,
  obra_mes5 NUMERIC DEFAULT 0.10,
  obra_mes6 NUMERIC DEFAULT 0.01,
  obra_mes7 NUMERIC DEFAULT 0.01,
  obra_mes9 NUMERIC DEFAULT 0.08,
  obra_mes10 NUMERIC DEFAULT 0.08,
  -- Taxas e despesas (valores negativos)
  comissao_vendas NUMERIC DEFAULT -0.08,
  impostos NUMERIC DEFAULT 0.06,
  taxa_plataforma NUMERIC DEFAULT -0.07,
  taxa_gestao_frank NUMERIC DEFAULT -0.08,
  projetos_taxa_obra NUMERIC DEFAULT -50000,
  capital_giro_inicial NUMERIC DEFAULT -25000,
  -- Cenários VGV (vgv_planta NÃO salvar = (vgv_target+vgv_liquidacao)/2)
  vgv_target NUMERIC DEFAULT 6000000,
  vgv_liquidacao NUMERIC DEFAULT 5400000,
  vgv_recompra NUMERIC DEFAULT 5300000,
  -- % Permuta por cenário
  permuta_planta NUMERIC DEFAULT 0.25,
  permuta_target NUMERIC DEFAULT 0.25,
  permuta_liquidacao NUMERIC DEFAULT 0.25,
  permuta_recompra NUMERIC DEFAULT 0.36,
  -- Funding
  percentual_funding NUMERIC DEFAULT 1.0,
  cdi_an NUMERIC DEFAULT 0.15,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(processo_id)
);

CREATE INDEX IF NOT EXISTS idx_bca_inputs_processo ON public.bca_inputs(processo_id);

ALTER TABLE public.bca_inputs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios podem ver bca_inputs do proprio processo" ON public.bca_inputs;
CREATE POLICY "Usuarios podem ver bca_inputs do proprio processo"
  ON public.bca_inputs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.processo_step_one p WHERE p.id = processo_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "Usuarios podem inserir bca_inputs" ON public.bca_inputs;
CREATE POLICY "Usuarios podem inserir bca_inputs"
  ON public.bca_inputs FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.processo_step_one p WHERE p.id = processo_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "Usuarios podem atualizar bca_inputs" ON public.bca_inputs;
CREATE POLICY "Usuarios podem atualizar bca_inputs"
  ON public.bca_inputs FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.processo_step_one p WHERE p.id = processo_id AND p.user_id = auth.uid()));
