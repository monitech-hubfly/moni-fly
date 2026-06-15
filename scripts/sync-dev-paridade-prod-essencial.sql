-- =============================================================================
-- Paridade DEV ↔ PROD (essencial) — cole no Supabase SQL Editor do projeto DEV
-- Idempotente. Cobre gaps mais comuns vs PROD (kanban + checklist Mapa).
-- Para paridade completa: npm run db:sync-dev (migrations 269→370)
-- =============================================================================

-- ─── Kanban cards: RLS, grants, colunas ─────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_cards TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.processo_step_one TO authenticated, service_role;

DROP POLICY IF EXISTS "kanban_cards_select" ON public.kanban_cards;
CREATE POLICY "kanban_cards_select"
  ON public.kanban_cards FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
    OR franqueado_id = auth.uid()
  );

DROP POLICY IF EXISTS "kanban_cards_insert_admin_team" ON public.kanban_cards;
DROP POLICY IF EXISTS "kanban_cards_insert_staff" ON public.kanban_cards;
CREATE POLICY "kanban_cards_insert_staff"
  ON public.kanban_cards FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  );

DROP POLICY IF EXISTS "kanban_cards_update_admin_team" ON public.kanban_cards;
DROP POLICY IF EXISTS "kanban_cards_update_staff" ON public.kanban_cards;
CREATE POLICY "kanban_cards_update_staff"
  ON public.kanban_cards FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  );

DROP POLICY IF EXISTS "kanban_cards_delete_admin_team" ON public.kanban_cards;
DROP POLICY IF EXISTS "kanban_cards_delete_staff" ON public.kanban_cards;
CREATE POLICY "kanban_cards_delete_staff"
  ON public.kanban_cards FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
  );

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS processo_step_one_id UUID
  REFERENCES public.processo_step_one(id) ON DELETE SET NULL;

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS hora_reuniao TEXT;

CREATE INDEX IF NOT EXISTS idx_kanban_cards_processo_step_one_id
  ON public.kanban_cards (processo_step_one_id)
  WHERE processo_step_one_id IS NOT NULL;

UPDATE public.kanban_cards SET concluido = false WHERE concluido IS NULL;
UPDATE public.kanban_cards SET arquivado = false WHERE arquivado IS NULL;

-- ─── Checklist: meta colunas + Mapa de Competidores (269/290/294) ───────────
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

DO $$
DECLARE
  v_fase_id UUID;
BEGIN
  SELECT f.id INTO v_fase_id
  FROM public.kanban_fases f
  JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
  WHERE f.slug IN ('mapa_competidores', 'stepone_mapa')
    AND COALESCE(f.ativo, true) = true
  ORDER BY CASE WHEN f.slug = 'mapa_competidores' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_fase_id IS NULL THEN RETURN; END IF;

  DELETE FROM public.kanban_fase_checklist_respostas r
  USING public.kanban_fase_checklist_itens i
  WHERE r.item_id = i.id AND i.fase_id = v_fase_id;

  DELETE FROM public.kanban_fase_checklist_itens WHERE fase_id = v_fase_id;

  INSERT INTO public.kanban_fase_checklist_itens (
    fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder, config_json
  )
  VALUES
    (v_fase_id, 1, 'Listagem de casas por condomínio prospectado', 'listagem_casas_zap', true, false,
     'Para cada condomínio da Tabela de Condomínios: varredura ZAP e cadastro manual de casas.', '{}'::jsonb),
    (v_fase_id, 2, 'Link planilha / mapa externo', 'url', false, false, 'https://…', '{}'::jsonb),
    (v_fase_id, 3, 'Observações do levantamento', 'texto_longo', false, true, NULL, '{}'::jsonb);
END;
$$;

-- ─── listings_casas: GRANTs + RLS staff (370) ───────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings_casas TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings_lotes TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lote_escolhido TO authenticated, service_role;

DROP POLICY IF EXISTS "Staff listings_casas" ON public.listings_casas;
CREATE POLICY "Staff listings_casas"
  ON public.listings_casas FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = listings_casas.processo_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles pf
          WHERE pf.id = auth.uid() AND pf.role IN ('admin', 'team', 'supervisor')
        )
        OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.kanban_cards k
      WHERE k.franqueado_id = auth.uid()
        AND (
          k.processo_step_one_id = listings_casas.processo_id
          OR k.projeto_id = listings_casas.processo_id
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = listings_casas.processo_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles pf
          WHERE pf.id = auth.uid() AND pf.role IN ('admin', 'team', 'supervisor')
        )
        OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.kanban_cards k
      WHERE k.franqueado_id = auth.uid()
        AND (
          k.processo_step_one_id = listings_casas.processo_id
          OR k.projeto_id = listings_casas.processo_id
        )
    )
  );

NOTIFY pgrst, 'reload schema';
