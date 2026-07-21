CREATE TABLE public.sirene_anexos_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  anexo_id bigint,
  chamado_id bigint,
  storage_path text,
  nome_original text,
  excluido_por uuid REFERENCES auth.users(id),
  excluido_por_nome text,
  excluido_em timestamptz DEFAULT now()
);

ALTER TABLE public.sirene_anexos_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_team_podem_ler_log" ON public.sirene_anexos_log
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'team')
));
