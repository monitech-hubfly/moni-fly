-- 548: Funil Corretores + colunas de lead + tokens de formulário do corretor.
-- Idempotente. DEV first. Sem cor_hex em kanbans (coluna inexistente em alguns ambientes).
-- UUID alinhado a kanban-ids.ts (CORRETORES).

-- ─── Colunas de lead comercial em kanban_cards ───────────────────────────────
ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS nome_corretor text,
  ADD COLUMN IF NOT EXISTS imobiliaria_corretor text,
  ADD COLUMN IF NOT EXISTS empreendimento_interesse text,
  ADD COLUMN IF NOT EXISTS tipologia_interesse text,
  ADD COLUMN IF NOT EXISTS orcamento_lead numeric(14,2),
  ADD COLUMN IF NOT EXISTS probabilidade_fechamento text,
  ADD COLUMN IF NOT EXISTS cidade_interesse text,
  ADD COLUMN IF NOT EXISTS telefone_lead text,
  ADD COLUMN IF NOT EXISTS email_lead text,
  ADD COLUMN IF NOT EXISTS mensagem_lead text;

COMMENT ON COLUMN public.kanban_cards.nome_corretor IS 'Funil Corretores — nome do corretor parceiro.';
COMMENT ON COLUMN public.kanban_cards.imobiliaria_corretor IS 'Funil Corretores — imobiliária do corretor.';
COMMENT ON COLUMN public.kanban_cards.empreendimento_interesse IS 'Funil Corretores — empreendimento de interesse do lead.';
COMMENT ON COLUMN public.kanban_cards.tipologia_interesse IS 'Funil Corretores — tipologia de interesse.';
COMMENT ON COLUMN public.kanban_cards.orcamento_lead IS 'Funil Corretores — orçamento estimado do lead.';
COMMENT ON COLUMN public.kanban_cards.probabilidade_fechamento IS 'Funil Corretores — probabilidade (ex.: 25%, 50%, 75%, 90%).';
COMMENT ON COLUMN public.kanban_cards.cidade_interesse IS 'Funil Corretores — cidade de interesse.';
COMMENT ON COLUMN public.kanban_cards.telefone_lead IS 'Funil Corretores — telefone do lead.';
COMMENT ON COLUMN public.kanban_cards.email_lead IS 'Funil Corretores — e-mail do lead.';
COMMENT ON COLUMN public.kanban_cards.mensagem_lead IS 'Funil Corretores — mensagem livre do formulário.';

CREATE INDEX IF NOT EXISTS idx_kanban_cards_nome_corretor
  ON public.kanban_cards (nome_corretor)
  WHERE nome_corretor IS NOT NULL;

-- ─── Tokens de formulário público do corretor (não amarrados a card prévio) ───
CREATE TABLE IF NOT EXISTS public.kanban_corretor_lead_tokens (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token                text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  nome_corretor        text NOT NULL,
  imobiliaria_corretor text NOT NULL,
  email_corretor       text,
  ativo                boolean NOT NULL DEFAULT true,
  expires_at           timestamptz NOT NULL DEFAULT (NOW() + INTERVAL '365 days'),
  created_by           uuid REFERENCES auth.users (id),
  created_at           timestamptz NOT NULL DEFAULT NOW(),
  ultimo_uso_em        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_corretor_lead_tokens_token
  ON public.kanban_corretor_lead_tokens (token);

ALTER TABLE public.kanban_corretor_lead_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "corretor_lead_tokens_select_auth" ON public.kanban_corretor_lead_tokens;
CREATE POLICY "corretor_lead_tokens_select_auth" ON public.kanban_corretor_lead_tokens
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "corretor_lead_tokens_insert_auth" ON public.kanban_corretor_lead_tokens;
CREATE POLICY "corretor_lead_tokens_insert_auth" ON public.kanban_corretor_lead_tokens
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "corretor_lead_tokens_update_auth" ON public.kanban_corretor_lead_tokens;
CREATE POLICY "corretor_lead_tokens_update_auth" ON public.kanban_corretor_lead_tokens
  FOR UPDATE TO authenticated USING (true);

GRANT ALL ON public.kanban_corretor_lead_tokens TO authenticated;
GRANT ALL ON public.kanban_corretor_lead_tokens TO service_role;

-- ─── Kanban Funil Corretores ─────────────────────────────────────────────────
INSERT INTO public.kanbans (id, nome, descricao, ativo)
SELECT
  '1e23c356-9993-4f8e-9d09-e17995e8a5c6'::uuid,
  'Funil Corretores',
  'Leads recebidos via formulário de corretores parceiros',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanbans
  WHERE id = '1e23c356-9993-4f8e-9d09-e17995e8a5c6'::uuid
     OR nome = 'Funil Corretores'
);

INSERT INTO public.kanban_fases (
  kanban_id, nome, slug, ordem, sla_dias, sla_tipo, fase_conversao, ativo, instrucoes, materiais
)
SELECT
  k.id,
  f.nome,
  f.slug,
  f.ordem,
  f.sla_dias,
  f.sla_tipo,
  f.fase_conversao,
  true,
  NULL,
  '[]'::jsonb
FROM public.kanbans k
CROSS JOIN (
  VALUES
    ('Oportunidade',          'cor_oportunidade',     1, 1,    'uteis'::text, false),
    ('Primeiro Contato',      'cor_primeiro_contato', 2, 2,    'uteis',       false),
    ('Agendamento de Visita', 'cor_agendamento',      3, 3,    'uteis',       false),
    ('Visita Realizada',      'cor_visita_realizada', 4, 5,    'uteis',       false),
    ('Proposta Enviada',      'cor_proposta_enviada', 5, 5,    'uteis',       false),
    ('Forecast',              'cor_forecast',         6, 10,   'uteis',       false),
    ('Convertido',            'cor_convertido',       7, NULL::integer, 'uteis', true),
    ('Perdido',               'cor_perdido',          8, NULL::integer, 'uteis', false)
) AS f(nome, slug, ordem, sla_dias, sla_tipo, fase_conversao)
WHERE k.nome = 'Funil Corretores'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fases kf
    WHERE kf.kanban_id = k.id AND kf.slug = f.slug
  );

UPDATE public.kanban_fases kf
SET
  nome = v.nome,
  ordem = v.ordem,
  sla_dias = v.sla_dias,
  sla_tipo = v.sla_tipo,
  fase_conversao = v.fase_conversao,
  ativo = true
FROM public.kanbans k,
  (VALUES
    ('cor_oportunidade',     'Oportunidade',          1, 1,    'uteis'::text, false),
    ('cor_primeiro_contato', 'Primeiro Contato',      2, 2,    'uteis',       false),
    ('cor_agendamento',      'Agendamento de Visita', 3, 3,    'uteis',       false),
    ('cor_visita_realizada', 'Visita Realizada',      4, 5,    'uteis',       false),
    ('cor_proposta_enviada', 'Proposta Enviada',      5, 5,    'uteis',       false),
    ('cor_forecast',         'Forecast',              6, 10,   'uteis',       false),
    ('cor_convertido',       'Convertido',            7, NULL::integer, 'uteis', true),
    ('cor_perdido',          'Perdido',               8, NULL::integer, 'uteis', false)
  ) AS v(slug, nome, ordem, sla_dias, sla_tipo, fase_conversao)
WHERE kf.kanban_id = k.id
  AND k.nome = 'Funil Corretores'
  AND kf.slug = v.slug;

NOTIFY pgrst, 'reload schema';
