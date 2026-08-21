-- 541: Modelo e Simulações IMOB — dados de card + oferta por empreendimento.
-- Card (1:1): status do imóvel + imagem principal.
-- Empreendimento: produto/modelo, oferta, metragem, links, imagem + simulações (540).

CREATE TABLE IF NOT EXISTS public.imob_card_modelo (
  card_id                 uuid PRIMARY KEY REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  status_imovel           text,
  imagem_principal_path   text,
  imagem_principal_nome   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.imob_card_modelo IS
  'Dados de Modelo no card (status do imóvel + imagem principal), independentes de cada empreendimento.';

-- Se a 541 antiga já criou colunas de oferta no card, remove (passam a ser por empreendimento).
ALTER TABLE public.imob_card_modelo
  DROP COLUMN IF EXISTS produto_modelo,
  DROP COLUMN IF EXISTS titulo_oferta,
  DROP COLUMN IF EXISTS ano_lancamento,
  DROP COLUMN IF EXISTS quartos,
  DROP COLUMN IF EXISTS banheiros,
  DROP COLUMN IF EXISTS vagas,
  DROP COLUMN IF EXISTS area_vendas_m2,
  DROP COLUMN IF EXISTS link_modelo,
  DROP COLUMN IF EXISTS descricao,
  DROP COLUMN IF EXISTS link_imagens_planta;

ALTER TABLE public.imob_card_modelo
  ADD COLUMN IF NOT EXISTS imagem_principal_path text,
  ADD COLUMN IF NOT EXISTS imagem_principal_nome text;

ALTER TABLE public.imob_card_empreendimentos
  ADD COLUMN IF NOT EXISTS produto_modelo text,
  ADD COLUMN IF NOT EXISTS titulo_oferta text,
  ADD COLUMN IF NOT EXISTS ano_lancamento integer,
  ADD COLUMN IF NOT EXISTS quartos numeric(8,2),
  ADD COLUMN IF NOT EXISTS banheiros numeric(8,2),
  ADD COLUMN IF NOT EXISTS vagas numeric(8,2),
  ADD COLUMN IF NOT EXISTS area_vendas_m2 numeric(12,2),
  ADD COLUMN IF NOT EXISTS link_modelo text,
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS link_imagens_planta text,
  ADD COLUMN IF NOT EXISTS imagem_oferta_path text,
  ADD COLUMN IF NOT EXISTS imagem_oferta_nome text;

COMMENT ON COLUMN public.imob_card_empreendimentos.produto_modelo IS
  'Produto/modelo da oferta (lista Moní). Valores livres legados em processo_step_one.produto_modelo_casa são preservados.';

ALTER TABLE public.imob_card_modelo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "imob_card_modelo_select_auth" ON public.imob_card_modelo;
CREATE POLICY "imob_card_modelo_select_auth"
  ON public.imob_card_modelo
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "imob_card_modelo_write_admin_team" ON public.imob_card_modelo;
CREATE POLICY "imob_card_modelo_write_admin_team"
  ON public.imob_card_modelo
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'team')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'team')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imob_card_modelo TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
