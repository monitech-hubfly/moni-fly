-- 328: Funil Step One — BCA simulador no checklist (bca_cenarios + tipo bca_simulador).

CREATE TABLE IF NOT EXISTS public.bca_cenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  prospect_row_id TEXT NOT NULL DEFAULT '',
  condominio_nome TEXT NOT NULL DEFAULT '',
  ordem INTEGER NOT NULL DEFAULT 1,
  catalogo_casa_id UUID REFERENCES public.catalogo_casas(id) ON DELETE SET NULL,
  topografia TEXT,
  faixa_mercado TEXT,
  inputs_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  resultado_json JSONB,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'confirmado')),
  confirmado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (card_id, prospect_row_id, ordem)
);

CREATE INDEX IF NOT EXISTS idx_bca_cenarios_card_id ON public.bca_cenarios (card_id);
CREATE INDEX IF NOT EXISTS idx_bca_cenarios_processo_id ON public.bca_cenarios (processo_id);
CREATE INDEX IF NOT EXISTS idx_bca_cenarios_prospect ON public.bca_cenarios (card_id, prospect_row_id);

COMMENT ON TABLE public.bca_cenarios IS
  'Cenários BCA por card Kanban — N casas por condomínio (prospect_row_id da Tabela de Condomínios).';

ALTER TABLE public.bca_cenarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bca_cenarios_select_admin_team" ON public.bca_cenarios;
CREATE POLICY "bca_cenarios_select_admin_team"
  ON public.bca_cenarios FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'team')
    )
  );

DROP POLICY IF EXISTS "bca_cenarios_select_frank_card" ON public.bca_cenarios;
CREATE POLICY "bca_cenarios_select_frank_card"
  ON public.bca_cenarios FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.kanban_cards kc
      WHERE kc.id = bca_cenarios.card_id AND kc.franqueado_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "bca_cenarios_select_processo_owner" ON public.bca_cenarios;
CREATE POLICY "bca_cenarios_select_processo_owner"
  ON public.bca_cenarios FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.processo_step_one ps
      WHERE ps.id = bca_cenarios.processo_id AND ps.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "bca_cenarios_write_admin_team" ON public.bca_cenarios;
CREATE POLICY "bca_cenarios_write_admin_team"
  ON public.bca_cenarios FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'team')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'team')
    )
  );

DROP POLICY IF EXISTS "bca_cenarios_write_frank_card" ON public.bca_cenarios;
CREATE POLICY "bca_cenarios_write_frank_card"
  ON public.bca_cenarios FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.kanban_cards kc
      WHERE kc.id = bca_cenarios.card_id AND kc.franqueado_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.kanban_cards kc
      WHERE kc.id = bca_cenarios.card_id AND kc.franqueado_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "bca_cenarios_write_processo_owner" ON public.bca_cenarios;
CREATE POLICY "bca_cenarios_write_processo_owner"
  ON public.bca_cenarios FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.processo_step_one ps
      WHERE ps.id = bca_cenarios.processo_id AND ps.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.processo_step_one ps
      WHERE ps.id = bca_cenarios.processo_id AND ps.user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bca_cenarios TO authenticated;

ALTER TABLE public.kanban_fase_checklist_itens
  DROP CONSTRAINT IF EXISTS kanban_fase_checklist_itens_tipo_check;

ALTER TABLE public.kanban_fase_checklist_itens
  ADD CONSTRAINT kanban_fase_checklist_itens_tipo_check
  CHECK (tipo IN (
    'texto_curto',
    'texto_longo',
    'email',
    'telefone',
    'numero',
    'url',
    'anexo',
    'anexo_template',
    'checkbox',
    'data',
    'hora',
    'tabela',
    'condominio',
    'pesquisa_condominio',
    'lotes_condominio',
    'listagem_casas_zap',
    'dados_cidade_ibge',
    'mapa_praca',
    'configurador_casas_ranking',
    'bca_simulador'
  ));

DO $$
DECLARE
  v_fase_id UUID;
BEGIN
  SELECT f.id
  INTO v_fase_id
  FROM public.kanban_fases f
  JOIN public.kanbans k ON k.id = f.kanban_id
  WHERE f.slug IN ('bca', 'stepone_bca', 'bca_batalha_casas')
    AND (k.id = '4d89f111-cef6-48aa-93ff-72d6406f0a32'::uuid
      OR (k.nome = 'Funil Step One' AND COALESCE(k.ativo, true) = true))
    AND COALESCE(f.ativo, true) = true
  ORDER BY CASE WHEN f.slug = 'bca' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '328: fase bca não encontrada; pulando checklist.';
    RETURN;
  END IF;

  DELETE FROM public.kanban_fase_checklist_respostas r
  USING public.kanban_fase_checklist_itens i
  WHERE r.item_id = i.id AND i.fase_id = v_fase_id;

  DELETE FROM public.kanban_fase_checklist_itens WHERE fase_id = v_fase_id;

  INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
  VALUES
    (v_fase_id, 1, 'Simulador BCA — casas por condomínio', 'bca_simulador', true, true,
     'Abas por condomínio da Tabela de Condomínios; dentro de cada uma, abas por casa com modelo, custo, terreno, cenários e resultado.'),
    (v_fase_id, 2, 'BCA confirmado para todos os condomínios', 'checkbox', true, true,
     'Marque quando todos os condomínios prospectados tiverem pelo menos um cenário BCA confirmado.');

  UPDATE public.kanban_fases
  SET instrucoes = $instr$
Com os custos registrados na fase Configurador de Casas, monte o BCA para cada condomínio prospectado:

1. Selecione o condomínio (aba) e adicione uma ou mais casas candidatas
2. Escolha o modelo Moní — área e dimensões vêm do catálogo; custo vem do Configurador
3. Informe terreno (custo + ITBI) e cenários de venda (Target, Liquidação, Recompra)
4. Revise o resultado automático (%VGV, margem, TIR) em linguagem clara
5. Confirme cada casa e marque «BCA confirmado para todos os condomínios»

Referência legada: /step-one/[id]/etapa/10
$instr$
  WHERE id = v_fase_id;
END;
$$;
