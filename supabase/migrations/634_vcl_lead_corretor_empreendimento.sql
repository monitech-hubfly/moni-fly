-- 634: Lead de Venda Casas Loteadores nasce ligado ao corretor e ao empreendimento.
-- Não altera imob_empreendimentos.card_id (esse card continua sendo o do cadastro).

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS imob_empreendimento_id uuid REFERENCES public.imob_empreendimentos(id) ON DELETE SET NULL;

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS rede_corretor_id uuid REFERENCES public.rede_corretores(id) ON DELETE SET NULL;

ALTER TABLE public.jornada_cliente_sessao
  ADD COLUMN IF NOT EXISTS vcl_card_id uuid REFERENCES public.kanban_cards(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kanban_cards_imob_empreendimento
  ON public.kanban_cards (imob_empreendimento_id)
  WHERE imob_empreendimento_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kanban_cards_rede_corretor
  ON public.kanban_cards (rede_corretor_id)
  WHERE rede_corretor_id IS NOT NULL;

COMMENT ON COLUMN public.kanban_cards.imob_empreendimento_id IS
  'Empreendimento já cadastrado que originou este card (ex.: lead VCL).';

COMMENT ON COLUMN public.kanban_cards.rede_corretor_id IS
  'Corretor que trouxe o cliente deste card.';

COMMENT ON COLUMN public.jornada_cliente_sessao.vcl_card_id IS
  'Card de Venda Casas Loteadores nascido desta sessão, para não duplicar.';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('634', 'vcl_lead_corretor_empreendimento')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
