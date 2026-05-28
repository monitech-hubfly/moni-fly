-- =============================================================================
-- Sirene ↔ Pastelaria: vínculo auth ↔ area_pessoas, chamado ↔ pastel
-- Pré-requisitos: area_pessoas, pastelaria_cards, sirene_chamados
-- =============================================================================

-- Mapeamento 1:1 entre usuário auth e pessoa do Carômetro/Pastelaria
CREATE TABLE IF NOT EXISTS public.area_pessoas_users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_pessoa_id  uuid NOT NULL REFERENCES public.area_pessoas(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (area_pessoa_id),
  UNIQUE (user_id)
);

COMMENT ON TABLE public.area_pessoas_users IS
  'Vínculo 1:1 entre auth.users e area_pessoas (responsável na Pastelaria).';

CREATE INDEX IF NOT EXISTS idx_area_pessoas_users_area_pessoa
  ON public.area_pessoas_users (area_pessoa_id);

CREATE INDEX IF NOT EXISTS idx_area_pessoas_users_user
  ON public.area_pessoas_users (user_id);

-- Vínculo 1:1 entre chamado Sirene e card Pastelaria
CREATE TABLE IF NOT EXISTS public.sirene_pastelaria_vinculos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sirene_chamado_id   bigint NOT NULL REFERENCES public.sirene_chamados(id) ON DELETE CASCADE,
  pastelaria_card_id  uuid NOT NULL REFERENCES public.pastelaria_cards(id) ON DELETE CASCADE,
  created_at          timestamptz DEFAULT now(),
  UNIQUE (sirene_chamado_id),
  UNIQUE (pastelaria_card_id)
);

COMMENT ON TABLE public.sirene_pastelaria_vinculos IS
  'Um chamado Sirene gera no máximo um pastel; um pastel referencia no máximo um chamado.';

CREATE INDEX IF NOT EXISTS idx_sirene_pastelaria_vinculos_card
  ON public.sirene_pastelaria_vinculos (pastelaria_card_id);

-- Rastreio direto no card (consultas / inbox sem join na tabela de vínculos)
ALTER TABLE public.pastelaria_cards
  ADD COLUMN IF NOT EXISTS sirene_chamado_id bigint REFERENCES public.sirene_chamados(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.pastelaria_cards.sirene_chamado_id IS
  'Chamado Sirene de origem quando o pastel foi criado a partir da central.';

CREATE INDEX IF NOT EXISTS idx_pastelaria_cards_sirene_chamado
  ON public.pastelaria_cards (sirene_chamado_id)
  WHERE sirene_chamado_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.area_pessoas_users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sirene_pastelaria_vinculos TO authenticated;

NOTIFY pgrst, 'reload schema';
