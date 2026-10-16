-- Intenção do ponto jurídico sobre o Repositório e publicação atômica da versão vigente.
-- Não edita a migration 600. Não aplicar em produção neste passo.

ALTER TABLE public.juridico_pontos
  ADD COLUMN IF NOT EXISTS repositorio_tipo_id uuid REFERENCES public.repositorio_tipos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS repositorio_variacao_id uuid REFERENCES public.repositorio_variacoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS repositorio_nova_variacao_nome text,
  ADD COLUMN IF NOT EXISTS repositorio_nova_variacao_quando_utilizar text;

COMMENT ON COLUMN public.juridico_pontos.repositorio_tipo_id IS
  'Tipo de documento alvo quando a aplicação futura mexe no Repositório. A seção não é gravada.';
COMMENT ON COLUMN public.juridico_pontos.repositorio_variacao_id IS
  'Variação existente a atualizar. Nulo ao criar variação nova, até a resolução.';
COMMENT ON COLUMN public.juridico_pontos.repositorio_nova_variacao_nome IS
  'Nome pretendido da variação nova. A linha em repositorio_variacoes só nasce na resolução.';
COMMENT ON COLUMN public.juridico_pontos.repositorio_nova_variacao_quando_utilizar IS
  'Quando utilizar da variação nova. Só é gravado na variação na resolução.';

CREATE UNIQUE INDEX IF NOT EXISTS repositorio_documentos_ponto_unico_idx
  ON public.repositorio_documentos (juridico_ponto_id)
  WHERE juridico_ponto_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.repositorio_registrar_versao_vigente(
  p_secao_id uuid,
  p_nome text,
  p_storage_path text,
  p_bucket text,
  p_criado_por uuid,
  p_tipo_id uuid,
  p_variacao_id uuid,
  p_juridico_ponto_id uuid
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF (p_tipo_id IS NULL) = (p_variacao_id IS NULL) THEN
    RAISE EXCEPTION 'A versão precisa de tipo ou de variação, não dos dois.';
  END IF;

  INSERT INTO public.repositorio_documentos (
    secao_id, nome, storage_path, bucket, criado_por, ordem,
    tipo_id, variacao_id, vigente, juridico_ponto_id
  ) VALUES (
    p_secao_id, p_nome, p_storage_path, p_bucket, p_criado_por, 0,
    p_tipo_id, p_variacao_id, false, p_juridico_ponto_id
  ) RETURNING id INTO v_id;

  IF p_tipo_id IS NOT NULL THEN
    UPDATE public.repositorio_documentos
       SET vigente = false
     WHERE tipo_id = p_tipo_id AND vigente AND id <> v_id;
  ELSE
    UPDATE public.repositorio_documentos
       SET vigente = false
     WHERE variacao_id = p_variacao_id AND vigente AND id <> v_id;
  END IF;

  UPDATE public.repositorio_documentos SET vigente = true WHERE id = v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.repositorio_registrar_versao_vigente(uuid, text, text, text, uuid, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.repositorio_registrar_versao_vigente(uuid, text, text, text, uuid, uuid, uuid, uuid) TO service_role;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('601', 'juridico_pontos_repositorio')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
