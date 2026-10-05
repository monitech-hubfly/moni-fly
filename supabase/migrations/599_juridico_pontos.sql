-- Pontos Jurídicos do Funil Jurídico (fase Em alterações e respostas).
-- Um ponto nasce incompleto e é preenchido aos poucos.
-- A conclusão (texto final, motivo, FAQ) fica na aplicação, não em CHECK.
-- Excluir o card não apaga o ponto: a operação é recusada enquanto houver ponto.
-- Arquivar o card não mexe nesta tabela.
-- Não editar 596, 597 ou 598.

CREATE TABLE IF NOT EXISTS public.juridico_pontos (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  juridico_card_id        uuid NOT NULL REFERENCES public.kanban_cards(id) ON DELETE RESTRICT,
  tipo                    text NOT NULL,
  rodada                  integer NOT NULL,
  ordem                   integer NOT NULL,
  criado_em               timestamptz NOT NULL DEFAULT now(),
  atualizado_em           timestamptz NOT NULL DEFAULT now(),
  criado_por              uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  duvida_recebida         text,
  resposta                text,
  clausula_trecho         text,
  solicitacao_alteracao   text,
  decisao                 text,
  texto_final_aprovado    text,
  aplicacao_futura        text,
  motivo_resposta         text,
  faq_status              text,
  faq_article_id          uuid REFERENCES public.faq_articles(id) ON DELETE SET NULL,
  CONSTRAINT juridico_pontos_tipo_chk
    CHECK (tipo IN ('duvida', 'alteracao')),
  CONSTRAINT juridico_pontos_rodada_chk
    CHECK (rodada >= 1),
  CONSTRAINT juridico_pontos_decisao_chk
    CHECK (decisao IS NULL OR decisao IN ('aceita', 'aceita_parcialmente', 'nao_aceita')),
  CONSTRAINT juridico_pontos_aplicacao_chk
    CHECK (
      aplicacao_futura IS NULL
      OR aplicacao_futura IN (
        'somente_este_documento',
        'alterar_documento_padrao',
        'criar_nova_variacao',
        'alterar_variacao_existente'
      )
    ),
  CONSTRAINT juridico_pontos_faq_status_chk
    CHECK (faq_status IS NULL OR faq_status IN ('ja_existe', 'retroalimentar', 'nao_se_aplica')),
  CONSTRAINT juridico_pontos_campos_do_tipo_chk
    CHECK (
      (
        tipo = 'duvida'
        AND decisao IS NULL
        AND clausula_trecho IS NULL
        AND solicitacao_alteracao IS NULL
        AND texto_final_aprovado IS NULL
        AND aplicacao_futura IS NULL
        AND motivo_resposta IS NULL
      )
      OR (
        tipo = 'alteracao'
        AND duvida_recebida IS NULL
        AND resposta IS NULL
      )
    )
);

COMMENT ON TABLE public.juridico_pontos IS
  'Pontos tratados em Em alterações e respostas. A rodada é copiada de kanban_cards.juridico_bolinha_count na criação e não acompanha mudanças posteriores do card. O tipo documental sai de kanban_cards.juridico_tipo_contrato.';

COMMENT ON COLUMN public.juridico_pontos.rodada IS
  'Cópia de juridico_bolinha_count no insert. Não recalcular pela fase atual.';

COMMENT ON COLUMN public.juridico_pontos.faq_article_id IS
  'Opcional. Usado quando faq_status = ja_existe. Não cria artigo.';

CREATE INDEX IF NOT EXISTS juridico_pontos_card_rodada_ordem_idx
  ON public.juridico_pontos (juridico_card_id, rodada, ordem);

CREATE INDEX IF NOT EXISTS juridico_pontos_tipo_idx
  ON public.juridico_pontos (tipo);

CREATE INDEX IF NOT EXISTS juridico_pontos_decisao_idx
  ON public.juridico_pontos (decisao)
  WHERE decisao IS NOT NULL;

CREATE INDEX IF NOT EXISTS juridico_pontos_faq_article_idx
  ON public.juridico_pontos (faq_article_id)
  WHERE faq_article_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.juridico_pontos_set_atualizado_em()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_juridico_pontos_atualizado_em ON public.juridico_pontos;
CREATE TRIGGER trg_juridico_pontos_atualizado_em
  BEFORE UPDATE ON public.juridico_pontos
  FOR EACH ROW
  EXECUTE PROCEDURE public.juridico_pontos_set_atualizado_em();

ALTER TABLE public.juridico_pontos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS juridico_pontos_select_staff ON public.juridico_pontos;
CREATE POLICY juridico_pontos_select_staff
  ON public.juridico_pontos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team')
    )
  );

DROP POLICY IF EXISTS juridico_pontos_insert_staff ON public.juridico_pontos;
CREATE POLICY juridico_pontos_insert_staff
  ON public.juridico_pontos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team')
    )
  );

DROP POLICY IF EXISTS juridico_pontos_update_staff ON public.juridico_pontos;
CREATE POLICY juridico_pontos_update_staff
  ON public.juridico_pontos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team')
    )
  );

DROP POLICY IF EXISTS juridico_pontos_delete_staff ON public.juridico_pontos;
CREATE POLICY juridico_pontos_delete_staff
  ON public.juridico_pontos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team')
    )
  );

REVOKE ALL ON TABLE public.juridico_pontos FROM PUBLIC;
REVOKE ALL ON TABLE public.juridico_pontos FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.juridico_pontos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.juridico_pontos TO service_role;
