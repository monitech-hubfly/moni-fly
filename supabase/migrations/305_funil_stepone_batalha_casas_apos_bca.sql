-- 305: Funil Step One — fase «Batalha de Casas» após BCA (regras completas, 3 eixos).
-- Sequência após Lotes: … → BCA → Batalha de Casas → Escolha → Hipóteses.
-- Move itens de checklist de batalha da fase BCA para a nova fase.

DO $$
DECLARE
  v_kanban_id UUID;
  v_ordem_lotes INT;
  v_fase_batalha_casas_id UUID;
  v_fase_bca_id UUID;
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE id = '4d89f111-cef6-48aa-93ff-72d6406f0a32'::uuid
     OR (nome = 'Funil Step One' AND COALESCE(ativo, true) = true)
  ORDER BY CASE WHEN id = '4d89f111-cef6-48aa-93ff-72d6406f0a32'::uuid THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '305: kanban Funil Step One não encontrado; pulando.';
    RETURN;
  END IF;

  SELECT MIN(ordem)
  INTO v_ordem_lotes
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug IN ('lotes_disponiveis', 'stepone_lotes')
    AND COALESCE(ativo, true) = true;

  IF v_ordem_lotes IS NULL THEN
    RAISE NOTICE '305: fase Lotes Disponíveis não encontrada; pulando.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id
      AND slug IN ('batalha_casas', 'stepone_batalha_casas')
  ) THEN
    INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo, instrucoes, materiais)
    VALUES (
      v_kanban_id,
      'Batalha de Casas',
      'batalha_casas',
      v_ordem_lotes + 4,
      1,
      true,
      $instr$
Com o BCA preenchido e os custos do Configurador registrados, aplique a Batalha de Casas completa:

1. Selecione até 3 modelos Moní do catálogo para batalhar com a listagem do condomínio
2. Para cada combinação modelo × anúncio, preencha os 3 eixos (escala -3 a +2 em cada critério):
   • Atributos do Lote — vista, área verde, muro, convivência, lixeira
   • Preço — checklist de reforma (8 categorias A–H) + sub-notas D/E/I/P (pesos 4/3/2/1)
   • Produto — Tamanho m², Amenidades, Quartos, Banheiros, Vagas, Design, Idade
3. Nota final = soma dos três eixos (Atributos + Preço + Produto)
4. Desempate: Atributos do Lote > Preço > Produto
5. Gere o PDF Score & Batalha e interprete vs. Giro: posição ≤ giro → vende no prazo

Acesse: /step-one/[id]/etapa/6
Guia completo: /universidade/ferramentas/batalha-casas
$instr$,
      '[
        {"tipo":"link","titulo":"Abrir Batalha de Casas","url":"/step-one/[id]/etapa/6"},
        {"tipo":"link","titulo":"Guia passo a passo","url":"/universidade/ferramentas/batalha-casas"}
      ]'::jsonb
    );
  ELSE
    UPDATE public.kanban_fases
    SET
      nome = 'Batalha de Casas',
      ativo = true,
      sla_dias = 1,
      instrucoes = $instr$
Com o BCA preenchido e os custos do Configurador registrados, aplique a Batalha de Casas completa:

1. Selecione até 3 modelos Moní do catálogo para batalhar com a listagem do condomínio
2. Para cada combinação modelo × anúncio, preencha os 3 eixos (escala -3 a +2 em cada critério):
   • Atributos do Lote — vista, área verde, muro, convivência, lixeira
   • Preço — checklist de reforma (8 categorias A–H) + sub-notas D/E/I/P (pesos 4/3/2/1)
   • Produto — Tamanho m², Amenidades, Quartos, Banheiros, Vagas, Design, Idade
3. Nota final = soma dos três eixos (Atributos + Preço + Produto)
4. Desempate: Atributos do Lote > Preço > Produto
5. Gere o PDF Score & Batalha e interprete vs. Giro: posição ≤ giro → vende no prazo

Acesse: /step-one/[id]/etapa/6
Guia completo: /universidade/ferramentas/batalha-casas
$instr$,
      materiais = COALESCE(
        materiais,
        '[
          {"tipo":"link","titulo":"Abrir Batalha de Casas","url":"/step-one/[id]/etapa/6"},
          {"tipo":"link","titulo":"Guia passo a passo","url":"/universidade/ferramentas/batalha-casas"}
        ]'::jsonb
      )
    WHERE kanban_id = v_kanban_id
      AND slug IN ('batalha_casas', 'stepone_batalha_casas');
  END IF;

  UPDATE public.kanban_fases
  SET ordem = CASE slug
    WHEN 'batalha' THEN v_ordem_lotes + 1
    WHEN 'stepone_batalha' THEN v_ordem_lotes + 1
    WHEN 'configurador_casas' THEN v_ordem_lotes + 2
    WHEN 'stepone_configurador_casas' THEN v_ordem_lotes + 2
    WHEN 'bca' THEN v_ordem_lotes + 3
    WHEN 'stepone_bca' THEN v_ordem_lotes + 3
    WHEN 'bca_batalha_casas' THEN v_ordem_lotes + 3
    WHEN 'batalha_casas' THEN v_ordem_lotes + 4
    WHEN 'stepone_batalha_casas' THEN v_ordem_lotes + 4
    WHEN 'escolha' THEN v_ordem_lotes + 5
    WHEN 'stepone_escolha' THEN v_ordem_lotes + 5
    WHEN 'hipoteses' THEN v_ordem_lotes + 6
    WHEN 'stepone_hipoteses' THEN v_ordem_lotes + 6
    ELSE ordem
  END
  WHERE kanban_id = v_kanban_id
    AND slug IN (
      'batalha',
      'stepone_batalha',
      'configurador_casas',
      'stepone_configurador_casas',
      'bca',
      'stepone_bca',
      'bca_batalha_casas',
      'batalha_casas',
      'stepone_batalha_casas',
      'escolha',
      'stepone_escolha',
      'hipoteses',
      'stepone_hipoteses'
    )
    AND COALESCE(ativo, true) = true;

  SELECT id
  INTO v_fase_batalha_casas_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug IN ('batalha_casas', 'stepone_batalha_casas')
    AND COALESCE(ativo, true) = true
  ORDER BY CASE WHEN slug = 'batalha_casas' THEN 0 ELSE 1 END
  LIMIT 1;

  SELECT id
  INTO v_fase_bca_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND slug IN ('bca', 'stepone_bca', 'bca_batalha_casas')
    AND COALESCE(ativo, true) = true
  ORDER BY CASE WHEN slug = 'bca' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_fase_bca_id IS NOT NULL THEN
    DELETE FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_bca_id
      AND label IN (
        'Batalha de Casas aplicada (3 eixos)',
        'Posição no ranking da batalha',
        'Giro da faixa de valor',
        'Resultado: posição ≤ giro?',
        'Casa escolhida final',
        'Por que esta casa (justificativa)',
        'Vantagens identificadas na batalha',
        'Desvantagens identificadas na batalha',
        'Discurso para amenizar desvantagens'
      );
  END IF;

  IF v_fase_batalha_casas_id IS NOT NULL THEN
    DELETE FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_batalha_casas_id;

    INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
    VALUES
      (v_fase_batalha_casas_id,  1, 'Modelo Moní 1 selecionado para batalha',        'texto_curto', true,  true),
      (v_fase_batalha_casas_id,  2, 'Modelo Moní 2 selecionado para batalha',        'texto_curto', false, true),
      (v_fase_batalha_casas_id,  3, 'Modelo Moní 3 selecionado para batalha',        'texto_curto', false, true),
      (v_fase_batalha_casas_id,  4, 'Batalha de Casas aplicada (3 eixos)',           'checkbox',    true,  true),
      (v_fase_batalha_casas_id,  5, 'PDF Score & Batalha gerado',                    'anexo',       true,  true),
      (v_fase_batalha_casas_id,  6, 'Posição no ranking da batalha',                 'numero',      true,  true),
      (v_fase_batalha_casas_id,  7, 'Giro da faixa de valor',                        'numero',      true,  true),
      (v_fase_batalha_casas_id,  8, 'Resultado: posição ≤ giro?',                    'checkbox',    true,  true),
      (v_fase_batalha_casas_id,  9, 'Casa escolhida final',                          'texto_curto', true,  true),
      (v_fase_batalha_casas_id, 10, 'Por que esta casa (justificativa)',             'texto_longo', true,  true),
      (v_fase_batalha_casas_id, 11, 'Vantagens identificadas na batalha',            'texto_longo', true,  true),
      (v_fase_batalha_casas_id, 12, 'Desvantagens identificadas na batalha',         'texto_longo', true,  true),
      (v_fase_batalha_casas_id, 13, 'Discurso para amenizar desvantagens',           'texto_longo', true,  true);
  END IF;
END;
$$;
