-- 256: Funil Step One — instruções da fase Dados dos Condomínios apontam ao checklist (idempotente).
-- Corrige ambientes onde a migration 248 ainda define "painel esquerdo" após a 255.

DO $$
DECLARE
  v_fase_id UUID;
BEGIN
  SELECT f.id
  INTO v_fase_id
  FROM public.kanban_fases f
  JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
  WHERE f.slug IN ('dados_condominios', 'stepone_dados_cond')
    AND COALESCE(f.ativo, true) = true
  ORDER BY CASE WHEN f.slug = 'dados_condominios' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '256: fase dados_condominios não encontrada; pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases
  SET instrucoes = $instr$
Preencha os dados do condomínio nos itens do checklist abaixo: selecione o condomínio no cadastro,
informe quadra e lote. Os campos do cadastro (endereço, tickets, giro e extrato) vêm de Rede → Condomínios
e aparecem automaticamente após a seleção.
$instr$
  WHERE id = v_fase_id;
END;
$$;
