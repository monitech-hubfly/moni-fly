-- 542: tipo showroom | empreendimento nas linhas de Modelo e Simulações IMOB.

ALTER TABLE public.imob_card_empreendimentos
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'empreendimento';

DO $$
BEGIN
  ALTER TABLE public.imob_card_empreendimentos
    ADD CONSTRAINT imob_card_empreendimentos_tipo_check
    CHECK (tipo IN ('empreendimento', 'showroom'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.imob_card_empreendimentos.tipo IS
  'empreendimento = oferta por empreendimento; showroom = bloco Showroom (mesmos campos).';

CREATE INDEX IF NOT EXISTS idx_imob_card_empreendimentos_card_tipo
  ON public.imob_card_empreendimentos (card_id, tipo, ordem);

NOTIFY pgrst, 'reload schema';
