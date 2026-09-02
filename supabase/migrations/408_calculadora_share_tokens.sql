-- 408: Tokens de acesso público à Calculadora por card (link /calculadora/[token]/leitura).

BEGIN;

CREATE TABLE IF NOT EXISTS calculadora_share_tokens (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     uuid        NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
  token       text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_by  uuid        REFERENCES auth.users(id),
  created_at  timestamptz DEFAULT now(),
  expires_at  timestamptz DEFAULT (now() + interval '90 days'),
  acessado_em timestamptz,
  acessos     integer     DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_calculadora_tokens_card_id ON calculadora_share_tokens(card_id);
CREATE INDEX IF NOT EXISTS idx_calculadora_tokens_token   ON calculadora_share_tokens(token);

ALTER TABLE calculadora_share_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calculadora_token_public_select"
  ON calculadora_share_tokens FOR SELECT
  TO anon, authenticated
  USING (expires_at > now());

CREATE POLICY "calculadora_token_insert"
  ON calculadora_share_tokens FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','team'))
  );

CREATE POLICY "calculadora_token_delete"
  ON calculadora_share_tokens FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','team'))
  );

CREATE OR REPLACE FUNCTION public.get_card_id_by_calculadora_token(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_card_id uuid;
BEGIN
  SELECT card_id INTO v_card_id
  FROM calculadora_share_tokens
  WHERE token = p_token AND expires_at > now();

  IF v_card_id IS NOT NULL THEN
    UPDATE calculadora_share_tokens
    SET acessado_em = now(), acessos = acessos + 1
    WHERE token = p_token;
  END IF;

  RETURN v_card_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_card_id_by_calculadora_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_card_id_by_calculadora_token(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_calculadora_share_token(p_card_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_token text;
BEGIN
  SELECT token INTO v_token
  FROM calculadora_share_tokens
  WHERE card_id = p_card_id AND expires_at > now()
  ORDER BY created_at DESC LIMIT 1;

  IF v_token IS NULL THEN
    INSERT INTO calculadora_share_tokens (card_id, created_by)
    VALUES (p_card_id, auth.uid())
    RETURNING token INTO v_token;
  END IF;

  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_calculadora_share_token(uuid) TO authenticated;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('408', 'calculadora_share_tokens')
ON CONFLICT (version) DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';
