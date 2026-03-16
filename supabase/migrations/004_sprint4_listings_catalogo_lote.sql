-- Sprint 4: tabelas para Etapas 4 (casas à venda), 5 (lotes à venda), 6 (catálogo Moní), 7 (lote escolhido)

-- Casas à venda (Etapa 4) — por processo
CREATE TABLE IF NOT EXISTS public.listings_casas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  condominio TEXT,
  recuos_permitidos TEXT,
  localizacao_condominio TEXT,
  corretor TEXT,
  area_lote_m2 NUMERIC(10,2),
  area_casa_m2 NUMERIC(10,2),
  topografia TEXT CHECK (topografia IS NULL OR topografia IN ('aclive', 'declive', 'plano')),
  medidas_frente_fundo TEXT,
  quartos INT,
  suites INT,
  banheiros INT,
  vagas INT,
  piscina BOOLEAN DEFAULT false,
  marcenaria BOOLEAN DEFAULT false,
  preco NUMERIC(14,2),
  preco_m2 NUMERIC(14,2),
  link TEXT,
  foto_url TEXT,
  data_publicacao DATE,
  data_coleta DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Lotes à venda (Etapa 5) — por processo
CREATE TABLE IF NOT EXISTS public.listings_lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  condominio TEXT,
  area_lote_m2 NUMERIC(10,2),
  preco NUMERIC(14,2),
  preco_m2 NUMERIC(14,2),
  link TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Catálogo Moní (Etapa 6) — modelos de casa (global, não por processo)
CREATE TABLE IF NOT EXISTS public.catalogo_casas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  largura_m NUMERIC(6,2),
  profundidade_m NUMERIC(6,2),
  area_m2 NUMERIC(10,2),
  topografia TEXT CHECK (topografia IS NULL OR topografia IN ('aclive', 'declive', 'plano')),
  quartos INT,
  suites INT,
  banheiros INT,
  vagas INT,
  preco_custo NUMERIC(14,2),
  preco_venda NUMERIC(14,2),
  preco_custo_m2 NUMERIC(14,2),
  preco_venda_m2 NUMERIC(14,2),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Lote escolhido pelo franqueado (Etapa 7) — um por processo
CREATE TABLE IF NOT EXISTS public.lote_escolhido (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE UNIQUE,
  cidade TEXT,
  condominio TEXT,
  recuos_permitidos TEXT,
  localizacao_condominio TEXT,
  area_lote_m2 NUMERIC(10,2),
  topografia TEXT CHECK (topografia IS NULL OR topografia IN ('aclive', 'declive', 'plano')),
  frente_m NUMERIC(6,2),
  fundo_m NUMERIC(6,2),
  preco NUMERIC(14,2),
  preco_m2 NUMERIC(14,2),
  foto_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: listings_casas e listings_lotes — Frank só do próprio processo (DROP IF EXISTS para poder reexecutar o script)
ALTER TABLE public.listings_casas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings_lotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Frank listings_casas" ON public.listings_casas;
CREATE POLICY "Frank listings_casas" ON public.listings_casas FOR ALL
  USING (EXISTS (SELECT 1 FROM public.processo_step_one p WHERE p.id = processo_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "Frank listings_lotes" ON public.listings_lotes;
CREATE POLICY "Frank listings_lotes" ON public.listings_lotes FOR ALL
  USING (EXISTS (SELECT 1 FROM public.processo_step_one p WHERE p.id = processo_id AND p.user_id = auth.uid()));

-- RLS: catalogo_casas — todos leem (Frank, consultor, admin)
ALTER TABLE public.catalogo_casas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Todos leem catalogo_casas" ON public.catalogo_casas;
CREATE POLICY "Todos leem catalogo_casas" ON public.catalogo_casas FOR SELECT USING (true);

-- RLS: lote_escolhido — Frank só do próprio processo
ALTER TABLE public.lote_escolhido ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Frank lote_escolhido" ON public.lote_escolhido;
CREATE POLICY "Frank lote_escolhido" ON public.lote_escolhido FOR ALL
  USING (EXISTS (SELECT 1 FROM public.processo_step_one p WHERE p.id = processo_id AND p.user_id = auth.uid()));

-- Índices
CREATE INDEX IF NOT EXISTS idx_listings_casas_processo ON public.listings_casas(processo_id);
CREATE INDEX IF NOT EXISTS idx_listings_lotes_processo ON public.listings_lotes(processo_id);
CREATE INDEX IF NOT EXISTS idx_lote_escolhido_processo ON public.lote_escolhido(processo_id);

-- Seed: 2 modelos exemplo no catálogo Moní (só insere se ainda não existir)
INSERT INTO public.catalogo_casas (nome, largura_m, profundidade_m, area_m2, topografia, quartos, suites, banheiros, vagas, preco_venda, preco_venda_m2, ativo)
SELECT 'Modelo A', 12, 18, 180, 'plano', 3, 1, 3, 2, 1200000, 6666.67, true
WHERE NOT EXISTS (SELECT 1 FROM public.catalogo_casas WHERE nome = 'Modelo A' LIMIT 1);
INSERT INTO public.catalogo_casas (nome, largura_m, profundidade_m, area_m2, topografia, quartos, suites, banheiros, vagas, preco_venda, preco_venda_m2, ativo)
SELECT 'Modelo B', 15, 20, 220, 'plano', 4, 2, 4, 2, 1500000, 6818.18, true
WHERE NOT EXISTS (SELECT 1 FROM public.catalogo_casas WHERE nome = 'Modelo B' LIMIT 1);
