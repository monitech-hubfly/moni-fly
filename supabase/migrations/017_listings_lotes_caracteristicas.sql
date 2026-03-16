-- Características do condomínio vindas da glue-api (listing.amenities)

ALTER TABLE public.listings_lotes
  ADD COLUMN IF NOT EXISTS caracteristicas TEXT;

COMMENT ON COLUMN public.listings_lotes.caracteristicas IS 'Características/amenidades do condomínio (ex.: Piscina, Academia) - preenchido pela ZAP (amenities)';
