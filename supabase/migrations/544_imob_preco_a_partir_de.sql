-- 544: preço "A partir de" no Modelo IMOB (card, abaixo da imagem principal).

ALTER TABLE public.imob_card_modelo
  ADD COLUMN IF NOT EXISTS preco_a_partir_de numeric(14,2);

COMMENT ON COLUMN public.imob_card_modelo.preco_a_partir_de IS
  'Valor "A partir de" exibido no showroom/flyer do card.';

NOTIFY pgrst, 'reload schema';
