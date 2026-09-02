-- Fix DEV: checklist Mapa de Competidores (meta colunas + seed migration 269/290/294)
-- Idempotente — pode rodar mais de uma vez.

-- 340: meta colunas
ALTER TABLE public.kanban_fase_checklist_itens
  ADD COLUMN IF NOT EXISTS campo_slug TEXT;

ALTER TABLE public.kanban_fase_checklist_itens
  ADD COLUMN IF NOT EXISTS config_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.kanban_fase_checklist_itens
  DROP CONSTRAINT IF EXISTS kanban_fase_checklist_itens_tipo_check;

ALTER TABLE public.kanban_fase_checklist_itens
  ADD CONSTRAINT kanban_fase_checklist_itens_tipo_check
  CHECK (tipo IN (
    'texto_curto', 'texto_longo', 'email', 'telefone', 'numero', 'url',
    'anexo', 'anexo_multiplo', 'anexo_template', 'checkbox', 'data', 'hora',
    'select', 'usuario', 'cnpj', 'catalog_casa', 'calculado', 'faixa_moeda',
    'faixa_numero', 'tabela', 'condominio', 'pesquisa_condominio', 'lotes_condominio',
    'listagem_casas_zap', 'dados_cidade_ibge', 'mapa_praca',
    'configurador_casas_ranking', 'bca_simulador', 'bca_condominio', 'rede_loteador'
  ));

GRANT SELECT ON public.kanban_fase_checklist_itens TO authenticated, service_role;

-- Seed Mapa de Competidores (269 + 290 + 294)
DO $$
DECLARE
  v_fase_id UUID;
BEGIN
  SELECT f.id
  INTO v_fase_id
  FROM public.kanban_fases f
  JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
  WHERE f.slug IN ('mapa_competidores', 'stepone_mapa')
    AND COALESCE(f.ativo, true) = true
  ORDER BY CASE WHEN f.slug = 'mapa_competidores' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE 'mapa: fase não encontrada';
    RETURN;
  END IF;

  DELETE FROM public.kanban_fase_checklist_respostas r
  USING public.kanban_fase_checklist_itens i
  WHERE r.item_id = i.id AND i.fase_id = v_fase_id;

  DELETE FROM public.kanban_fase_checklist_itens WHERE fase_id = v_fase_id;

  INSERT INTO public.kanban_fase_checklist_itens (
    fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder, config_json
  )
  VALUES
    (
      v_fase_id, 1,
      'Listagem de casas por condomínio prospectado',
      'listagem_casas_zap', true, false,
      'Para cada condomínio da Tabela de Condomínios: varredura ZAP e cadastro manual de casas.',
      '{}'::jsonb
    ),
    (
      v_fase_id, 2, 'Link planilha / mapa externo', 'url', false, false, 'https://…', '{}'::jsonb
    ),
    (
      v_fase_id, 3, 'Observações do levantamento', 'texto_longo', false, true, NULL, '{}'::jsonb
    );

  UPDATE public.kanban_fases
  SET instrucoes = $instr$
Levante todas as casas anunciadas e vendidas em cada condomínio prospectado e na região, na faixa de valor de venda estimada.

Use o checklist abaixo — uma sessão por condomínio (mesma ordem da Tabela de Condomínios, por ticket médio de casas):
1. Varrer a ZAP (Apify) filtrando pelo condomínio da aba
2. Complementar com casas manuais quando necessário
3. Validar mensalmente o status das casas cadastradas manualmente
4. Registrar observações do levantamento

Com base nesse mapa, identifique valores target, programas e estilos do mercado local — insumo para Pré-batalha e Batalha de Casas.
$instr$
  WHERE id = v_fase_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
