-- 329: Fase BCA checklist — colunas planas em bca_cenarios + catálogo Moní.

ALTER TABLE public.catalogo_casas
  ADD COLUMN IF NOT EXISTS fluxo_obra_json JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS custo_projetos_padrao NUMERIC(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mes_inicio_obra_padrao INTEGER DEFAULT 3;

ALTER TABLE public.bca_cenarios
  ADD COLUMN IF NOT EXISTS condominio_id UUID REFERENCES public.checklist_condominios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS casa_nome TEXT,
  ADD COLUMN IF NOT EXISTS casa_area_m2 NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS casa_largura_m NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS casa_profundidade_m NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS casa_quartos INTEGER,
  ADD COLUMN IF NOT EXISTS casa_suites INTEGER,
  ADD COLUMN IF NOT EXISTS casa_banheiros INTEGER,
  ADD COLUMN IF NOT EXISTS casa_vagas INTEGER,
  ADD COLUMN IF NOT EXISTS fluxo_obra_json JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS custo_projetos NUMERIC(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mes_inicio_obra INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS custo_casa NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS custo_terreno NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS itbi_percentual NUMERIC(8, 4) DEFAULT 0.04,
  ADD COLUMN IF NOT EXISTS vgv_target NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS vgv_liquidacao NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS vgv_recompra NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS cet_am NUMERIC(8, 4) DEFAULT 0.021;

ALTER TABLE public.bca_cenarios DROP CONSTRAINT IF EXISTS bca_cenarios_status_check;
ALTER TABLE public.bca_cenarios
  ADD CONSTRAINT bca_cenarios_status_check
  CHECK (status IN ('rascunho', 'confirmado', 'completo'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_bca_cenarios_card_cond_ordem
  ON public.bca_cenarios (card_id, condominio_id, ordem)
  WHERE condominio_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bca_cenarios_condominio_id ON public.bca_cenarios (condominio_id);

COMMENT ON COLUMN public.bca_cenarios.condominio_id IS
  'checklist_condominios.id — aba de condomínio no simulador BCA do funil.';
