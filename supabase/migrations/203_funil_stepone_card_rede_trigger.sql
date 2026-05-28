-- 203: Card do Funil Step One ao cadastrar rede — só via app (criarLinhaRedeECard).
-- Remove trigger legado que criava card em "Dados da Cidade" sem rede_franqueado_id.

DROP TRIGGER IF EXISTS trg_rede_franqueados_criar_card_funil ON public.rede_franqueados;

COMMENT ON FUNCTION public.fn_criar_card_funil_ao_inserir_franqueado() IS
  'Legado: substituído por ensureFunilStepOneCardFromRede (TS). Trigger removido na 203.';
