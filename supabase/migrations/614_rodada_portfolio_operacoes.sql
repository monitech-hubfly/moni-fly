-- 614: Rodada do Funil Portfólio e do Funil Pré Obra e Obra.
-- Mesma coluna do Jurídico: kanban_cards.juridico_bolinha_count já é a rodada.
-- Card novo desses funis nasce em 1. Outros funis permanecem em 0.
-- Idempotente. Não move cards.

COMMENT ON COLUMN public.kanban_cards.juridico_bolinha_count IS
  'Rodada atual do Funil Jurídico, do Funil Portfólio e do Funil Pré Obra e Obra. O valor persistido é a rodada. Card novo desses funis = 1; demais funis permanecem em 0. Jurídico soma 1 ao voltar para Em alterações e respostas vindo de Enviado ao Parceiro, Subir p/ Assinatura ou Aguardando Assinaturas. Portfólio soma 1 ao voltar para Análise de Nova Hipótese vindo de Revisão de Hipótese, para Pré Comitê vindo de Revisões Pré Comitê, e para Demais Comitês vindo de Revisões Comitê. Pré Obra e Obra soma 1 ao voltar para Comunique-se Condomínio vindo de Aprovação no Condomínio, e para Comunique-se Prefeitura vindo de Aprovação na Prefeitura.';

CREATE OR REPLACE FUNCTION public.fn_juridico_rodada_na_fase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_juridico uuid := '35fb5c8d-50c0-4999-bc16-89d53c2e758f'::uuid;
  v_portfolio uuid := 'c57120a0-991c-422b-8def-4d16a9411d45'::uuid;
  v_operacoes uuid := 'f6bba1de-a7a1-4b14-89d1-10c2f7bba636'::uuid;
  v_slug_antiga text;
  v_slug_nova text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.kanban_id IN (v_juridico, v_portfolio, v_operacoes)
       AND COALESCE(NEW.juridico_bolinha_count, 0) < 1 THEN
      NEW.juridico_bolinha_count := 1;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.fase_id IS NOT DISTINCT FROM OLD.fase_id THEN
    RETURN NEW;
  END IF;

  IF NEW.kanban_id IS DISTINCT FROM v_juridico
     AND NEW.kanban_id IS DISTINCT FROM v_portfolio
     AND NEW.kanban_id IS DISTINCT FROM v_operacoes THEN
    RETURN NEW;
  END IF;

  SELECT slug INTO v_slug_antiga FROM public.kanban_fases WHERE id = OLD.fase_id;
  SELECT slug INTO v_slug_nova FROM public.kanban_fases WHERE id = NEW.fase_id;

  IF NEW.kanban_id = v_juridico
     AND v_slug_nova = 'juridico_alteracoes_respostas'
     AND v_slug_antiga IN (
       'juridico_enviado_parceiro',
       'juridico_subir_assinatura',
       'juridico_aguardando_assinaturas'
     )
  THEN
    NEW.juridico_bolinha_count := GREATEST(COALESCE(OLD.juridico_bolinha_count, 1), 1) + 1;
  ELSIF NEW.kanban_id = v_portfolio
     AND (
       (v_slug_nova = 'aprovacao_moni_novo_negocio' AND v_slug_antiga = 'revisao_hipotese')
       OR (v_slug_nova = 'pre_comite' AND v_slug_antiga = 'revisoes_pre_comite')
       OR (v_slug_nova = 'segundo_comite' AND v_slug_antiga = 'revisoes_comite')
     )
  THEN
    NEW.juridico_bolinha_count := GREATEST(COALESCE(OLD.juridico_bolinha_count, 1), 1) + 1;
  ELSIF NEW.kanban_id = v_operacoes
     AND (
       (v_slug_nova = 'comunique_se_condominio' AND v_slug_antiga = 'aprovacao_condominio')
       OR (v_slug_nova = 'comunique_se_prefeitura' AND v_slug_antiga = 'aprovacao_prefeitura')
     )
  THEN
    NEW.juridico_bolinha_count := GREATEST(COALESCE(OLD.juridico_bolinha_count, 1), 1) + 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_juridico_rodada_na_fase ON public.kanban_cards;
CREATE TRIGGER trg_juridico_rodada_na_fase
  BEFORE INSERT OR UPDATE OF fase_id
  ON public.kanban_cards
  FOR EACH ROW
  EXECUTE PROCEDURE public.fn_juridico_rodada_na_fase();

UPDATE public.kanban_cards
SET juridico_bolinha_count = 1
WHERE kanban_id IN (
  'c57120a0-991c-422b-8def-4d16a9411d45'::uuid,
  'f6bba1de-a7a1-4b14-89d1-10c2f7bba636'::uuid
)
  AND COALESCE(juridico_bolinha_count, 0) < 1;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('614', 'rodada_portfolio_operacoes')
ON CONFLICT (version) DO NOTHING;
