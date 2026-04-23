-- 149: Checklist estrutural por fase (itens configuráveis) + respostas por card
--      + bucket de templates + seed da fase "Dados do Candidato"

-- ─── Itens de checklist por fase ────────────────────────────────────────────
CREATE TABLE public.kanban_fase_checklist_itens (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  fase_id               UUID        NOT NULL REFERENCES public.kanban_fases(id) ON DELETE CASCADE,
  ordem                 INTEGER     NOT NULL DEFAULT 0,
  label                 TEXT        NOT NULL,
  tipo                  TEXT        NOT NULL DEFAULT 'texto_curto'
    CHECK (tipo IN (
      'texto_curto','texto_longo','email','telefone',
      'numero','anexo','anexo_template','checkbox'
    )),
  obrigatorio           BOOLEAN     DEFAULT TRUE,
  visivel_candidato     BOOLEAN     DEFAULT TRUE,
  template_storage_path TEXT,
  placeholder           TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fase_checklist_itens_fase ON public.kanban_fase_checklist_itens(fase_id);

ALTER TABLE public.kanban_fase_checklist_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fase_checklist_select_interno" ON public.kanban_fase_checklist_itens;
CREATE POLICY "fase_checklist_select_interno" ON public.kanban_fase_checklist_itens
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "fase_checklist_admin" ON public.kanban_fase_checklist_itens;
CREATE POLICY "fase_checklist_admin" ON public.kanban_fase_checklist_itens
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── Respostas por card ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kanban_fase_checklist_respostas (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id        UUID        NOT NULL REFERENCES public.kanban_fase_checklist_itens(id) ON DELETE CASCADE,
  card_id        UUID        NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  valor          TEXT,
  arquivo_path   TEXT,
  preenchido_por UUID        REFERENCES auth.users(id),
  preenchido_em  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(item_id, card_id)
);

CREATE INDEX IF NOT EXISTS idx_fase_checklist_respostas_card ON public.kanban_fase_checklist_respostas(card_id);
CREATE INDEX IF NOT EXISTS idx_fase_checklist_respostas_item ON public.kanban_fase_checklist_respostas(item_id);

ALTER TABLE public.kanban_fase_checklist_respostas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fase_checklist_resp_select" ON public.kanban_fase_checklist_respostas;
CREATE POLICY "fase_checklist_resp_select" ON public.kanban_fase_checklist_respostas
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "fase_checklist_resp_upsert" ON public.kanban_fase_checklist_respostas;
CREATE POLICY "fase_checklist_resp_upsert" ON public.kanban_fase_checklist_respostas
  FOR ALL USING (auth.role() = 'authenticated');

-- ─── Bucket de templates de documentos ──────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos-templates', 'documentos-templates', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "templates_select_auth" ON storage.objects;
CREATE POLICY "templates_select_auth" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'documentos-templates');

DROP POLICY IF EXISTS "templates_insert_admin" ON storage.objects;
CREATE POLICY "templates_insert_admin" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos-templates'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── Seed: fase "Dados do Candidato" — SLA, instruções e itens ──────────────
DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_id   UUID;
BEGIN
  SELECT id INTO v_kanban_id FROM public.kanbans WHERE nome = 'Funil Step One' LIMIT 1;
  SELECT id INTO v_fase_id   FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND nome = 'Dados do Candidato' LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '149: fase "Dados do Candidato" não encontrada; pulando seed.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases SET sla_dias = 1 WHERE id = v_fase_id;

  UPDATE public.kanban_fases SET instrucoes =
    '1. Preencher itens abaixo
2. Baixar documentos
3. Assinar documentos
4. Subir documentos assinados'
  WHERE id = v_fase_id;

  INSERT INTO public.kanban_fase_checklist_itens
    (fase_id, ordem, label, tipo, visivel_candidato, placeholder)
  SELECT * FROM (VALUES
    (v_fase_id,  1, 'Nome',                                          'texto_curto',   true,  'Nome completo'),
    (v_fase_id,  2, 'E-mail',                                        'email',         false, 'seu@email.com'),
    (v_fase_id,  3, 'Telefone',                                      'telefone',      false, '(11) 99999-9999'),
    (v_fase_id,  4, 'Idade',                                         'numero',        true,  'Ex: 35'),
    (v_fase_id,  5, 'Profissão',                                     'texto_curto',   true,  ''),
    (v_fase_id,  6, 'Experiências profissionais relevantes',         'texto_longo',   true,  ''),
    (v_fase_id,  7, 'Trajetória e aprendizados mais importantes',    'texto_longo',   true,  ''),
    (v_fase_id,  8, 'Por que acredita que seria um bom franqueado Moní', 'texto_longo', true, ''),
    (v_fase_id,  9, 'Termo de Confidencialidade e Não-Divulgação',   'anexo_template', true, ''),
    (v_fase_id, 10, 'Termo de Autorização para Consulta de Informações', 'anexo_template', true, '')
  ) AS t(fase_id, ordem, label, tipo, visivel_candidato, placeholder)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens WHERE fase_id = v_fase_id
  );
END $$;
