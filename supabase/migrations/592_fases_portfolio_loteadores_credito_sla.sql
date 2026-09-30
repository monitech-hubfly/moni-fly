-- 592: Renomeia fases do Portfólio, divide NDA e Cto de Parceria em Loteadores,
-- inclui fases novas, remove Docs Alvará do Crédito Obra, zera o SLA visível
-- na troca de fase (histórico de atraso fica em kanban_historico) e avisa
-- Renata Bendassi quando entra um franqueado na Rede.
-- Idempotente. Não apaga colunas nem fases.

-- ── Portfólio ────────────────────────────────────────────────────────────────
UPDATE public.kanban_fases
SET nome = 'Em Estudo'
WHERE kanban_id = 'c57120a0-991c-422b-8def-4d16a9411d45'::uuid
  AND slug = 'step_2';

UPDATE public.kanban_fases
SET nome = 'Checks Legal, Diligência e Revisões'
WHERE kanban_id = 'c57120a0-991c-422b-8def-4d16a9411d45'::uuid
  AND slug = 'step_4';

UPDATE public.kanban_fases
SET nome = 'Enviar Acoplamento p/ Frank'
WHERE kanban_id = 'c57120a0-991c-422b-8def-4d16a9411d45'::uuid
  AND slug = 'enviar_acoplamento_frank';

-- ── Loteadores ───────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_kanban_id uuid := '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid;
  r record;
  v_ord int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban_id) THEN
    SELECT id INTO v_kanban_id
    FROM public.kanbans
    WHERE nome = 'Funil Loteadores' AND COALESCE(ativo, true)
    ORDER BY id
    LIMIT 1;
  END IF;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '592: Funil Loteadores não encontrado — pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases
  SET nome = 'Jurídico NDA', ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'nda_moni_inc';

  UPDATE public.kanban_fases
  SET nome = 'Revisões R02', ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'revisoes_moni_inc';

  UPDATE public.kanban_fases
  SET nome = 'Revisões Comitê', ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'revisoes_pos_comite_moni_inc';

  UPDATE public.kanban_fases
  SET nome = 'Jurídico Cto de Parceria', ativo = true
  WHERE kanban_id = v_kanban_id AND slug = 'contrato_parceria_moni_inc';

  INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, sla_dias, ativo, fase_conversao)
  SELECT '7c1e9a40-4d2b-4f6a-8c11-8e2b0f4a61d3'::uuid, v_kanban_id, 'Assinaturas NDA', 'assinaturas_nda_moni_inc', 80, 3, true, false
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'assinaturas_nda_moni_inc'
  );

  INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, sla_dias, ativo, fase_conversao)
  SELECT '8d2f0b51-5e3c-4a7b-9d22-9f3c1a5b72e4'::uuid, v_kanban_id, 'NDA Assinado', 'nda_assinado_moni_inc', 81, 3, true, false
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'nda_assinado_moni_inc'
  );

  INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, sla_dias, ativo, fase_conversao)
  SELECT '9e301c62-6f4d-4b8c-ae33-a04d2b6c83f5'::uuid, v_kanban_id, 'Enviar Acoplamento p/ Loteador', 'enviar_acoplamento_loteador', 82, 3, true, false
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'enviar_acoplamento_loteador'
  );

  INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, sla_dias, ativo, fase_conversao)
  SELECT 'af412d73-705e-4c9d-bf44-b15e3c7d9406'::uuid, v_kanban_id, 'Demais Comitês', 'demais_comites_moni_inc', 83, 3, true, false
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'demais_comites_moni_inc'
  );

  INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, sla_dias, ativo, fase_conversao)
  SELECT 'b0523e84-816f-4dae-9055-c26f4d8ea517'::uuid, v_kanban_id, 'Assinaturas Cto de Parceria', 'assinaturas_cto_parceria_moni_inc', 84, 3, true, false
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'assinaturas_cto_parceria_moni_inc'
  );

  INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, sla_dias, ativo, fase_conversao)
  SELECT 'c1634f95-9270-4ebf-a166-d3705e9fb628'::uuid, v_kanban_id, 'Cto de Parceria Assinado', 'cto_parceria_assinado_moni_inc', 85, 3, true, false
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fases WHERE kanban_id = v_kanban_id AND slug = 'cto_parceria_assinado_moni_inc'
  );

  UPDATE public.kanban_fases SET nome = 'Assinaturas NDA', ativo = true, sla_dias = COALESCE(sla_dias, 3)
  WHERE kanban_id = v_kanban_id AND slug = 'assinaturas_nda_moni_inc';
  UPDATE public.kanban_fases SET nome = 'NDA Assinado', ativo = true, sla_dias = COALESCE(sla_dias, 3)
  WHERE kanban_id = v_kanban_id AND slug = 'nda_assinado_moni_inc';
  UPDATE public.kanban_fases SET nome = 'Enviar Acoplamento p/ Loteador', ativo = true, sla_dias = COALESCE(sla_dias, 3)
  WHERE kanban_id = v_kanban_id AND slug = 'enviar_acoplamento_loteador';
  UPDATE public.kanban_fases SET nome = 'Demais Comitês', ativo = true, sla_dias = COALESCE(sla_dias, 3)
  WHERE kanban_id = v_kanban_id AND slug = 'demais_comites_moni_inc';
  UPDATE public.kanban_fases SET nome = 'Assinaturas Cto de Parceria', ativo = true, sla_dias = COALESCE(sla_dias, 3)
  WHERE kanban_id = v_kanban_id AND slug = 'assinaturas_cto_parceria_moni_inc';
  UPDATE public.kanban_fases SET nome = 'Cto de Parceria Assinado', ativo = true, sla_dias = COALESCE(sla_dias, 3)
  WHERE kanban_id = v_kanban_id AND slug = 'cto_parceria_assinado_moni_inc';

  v_ord := 0;
  FOR r IN
    SELECT kf.id AS id FROM (
      VALUES
        (1,  'primeiro_contato_moni_inc'),
        (2,  'nda_moni_inc'),
        (3,  'assinaturas_nda_moni_inc'),
        (4,  'nda_assinado_moni_inc'),
        (5,  'aguardando_ficha_moni_inc'),
        (6,  'novo_produto_moni_inc'),
        (7,  'viabilidade_moni_inc'),
        (8,  'validacao_moni_inc'),
        (9,  'r2_plano_teorico_moni_inc'),
        (10, 'revisoes_moni_inc'),
        (11, 'acoplamento_gbox_moni_inc'),
        (12, 'enviar_acoplamento_loteador'),
        (13, 'comite_moni_inc'),
        (14, 'revisoes_pos_comite_moni_inc'),
        (15, 'demais_comites_moni_inc'),
        (16, 'contrato_parceria_moni_inc'),
        (17, 'assinaturas_cto_parceria_moni_inc'),
        (18, 'cto_parceria_assinado_moni_inc'),
        (19, 'passagem_waysers_moni_inc'),
        (20, 'assinados_moni_inc')
    ) AS t(ord_pref, slug)
    JOIN public.kanban_fases kf ON kf.kanban_id = v_kanban_id AND kf.slug = t.slug
    ORDER BY t.ord_pref
  LOOP
    v_ord := v_ord + 1;
    UPDATE public.kanban_fases SET ordem = v_ord, ativo = true WHERE id = r.id;
  END LOOP;
END $$;

-- ── Crédito Obra ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_kanban_id uuid := '6463af1d-850d-4958-b74c-404f8d668e21'::uuid;
  v_nova_id uuid;
  v_velha_id uuid;
  r record;
  v_ord int;
  v_sla int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban_id) THEN
    SELECT id INTO v_kanban_id
    FROM public.kanbans
    WHERE nome IN ('Funil Crédito Obra', 'Funil Cash Me', 'Funil Crédito')
      AND COALESCE(ativo, true)
    ORDER BY id
    LIMIT 1;
  END IF;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '592: Funil Crédito Obra não encontrado — pulando.';
    RETURN;
  END IF;

  SELECT COALESCE(sla_dias, 5) INTO v_sla
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'co_documentacao_alvara'
  LIMIT 1;
  v_sla := COALESCE(v_sla, 5);

  INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, sla_dias, ativo, fase_conversao)
  SELECT 'd2745096-a381-4fc0-b277-e4816fa0c739'::uuid, v_kanban_id,
         'Aguardando Alvará e Transferência', 'co_aguardando_alvara_transferencia', 90, v_sla, true, false
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND slug = 'co_aguardando_alvara_transferencia'
  );

  UPDATE public.kanban_fases
  SET nome = 'Aguardando Alvará e Transferência', ativo = true, fase_conversao = false
  WHERE kanban_id = v_kanban_id AND slug = 'co_aguardando_alvara_transferencia';

  SELECT id INTO v_nova_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'co_aguardando_alvara_transferencia'
  LIMIT 1;

  SELECT id INTO v_velha_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'co_documentacao_alvara'
  LIMIT 1;

  IF v_nova_id IS NOT NULL AND v_velha_id IS NOT NULL THEN
    UPDATE public.kanban_cards
    SET fase_id = v_nova_id
    WHERE fase_id = v_velha_id;
  END IF;

  UPDATE public.kanban_fases
  SET ativo = false, ordem = 950
  WHERE kanban_id = v_kanban_id AND slug = 'co_documentacao_alvara';

  v_ord := 0;
  FOR r IN
    SELECT kf.id AS id FROM (
      VALUES
        (1,  'co_novo_projeto'),
        (2,  'co_book'),
        (3,  'co_aguardando_alvara_transferencia'),
        (4,  'co_envio_cashme'),
        (5,  'co_validacao_contrato'),
        (6,  'co_contrato_assinaturas'),
        (7,  'co_followup_cartorio'),
        (8,  'co_aguardando_1a_tranche'),
        (9,  'co_solicitacao_tranche'),
        (10, 'co_sharepoint_cashme'),
        (11, 'co_acompanhamento_tranche'),
        (12, 'co_necessidade_3a_tranche'),
        (13, 'co_sharepoint_3a')
    ) AS t(ord_pref, slug)
    JOIN public.kanban_fases kf ON kf.kanban_id = v_kanban_id AND kf.slug = t.slug
    ORDER BY t.ord_pref
  LOOP
    v_ord := v_ord + 1;
    UPDATE public.kanban_fases SET ordem = v_ord, ativo = true WHERE id = r.id;
  END LOOP;
END $$;

-- Campo responsável nas fases novas
INSERT INTO public.kanban_fase_checklist_itens (
  fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
)
SELECT f.id, 0, 'Responsável da fase', 'usuario', false, true, 'responsavel_fase', '{}'::jsonb
FROM public.kanban_fases f
WHERE COALESCE(f.ativo, true) = true
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id AND i.campo_slug = 'responsavel_fase'
  );

-- Projeto Legal: Elisabete é a responsável do card (To Do Planning lê responsavel_id e o checklist)
WITH alvos AS (
  SELECT c.id AS card_id, i.id AS item_id, p.id AS user_id
  FROM public.profiles p
  INNER JOIN public.kanban_cards c
    ON c.kanban_id = '39de341d-aebf-481c-9118-ce6fc6574187'::uuid
   AND COALESCE(c.arquivado, false) = false
   AND COALESCE(c.concluido, false) = false
  INNER JOIN public.kanban_fase_checklist_itens i
    ON i.fase_id = c.fase_id AND i.campo_slug = 'responsavel_fase'
  WHERE lower(trim(p.email)) = 'elisabete.nucci@moni.casa'
)
INSERT INTO public.kanban_fase_checklist_respostas (item_id, card_id, valor, preenchido_em)
SELECT a.item_id, a.card_id, a.user_id::text, NOW()
FROM alvos a
ON CONFLICT (item_id, card_id) DO UPDATE
SET valor = EXCLUDED.valor, preenchido_em = EXCLUDED.preenchido_em;

UPDATE public.kanban_cards c
SET responsavel_id = p.id
FROM public.profiles p
WHERE lower(trim(p.email)) = 'elisabete.nucci@moni.casa'
  AND c.kanban_id = '39de341d-aebf-481c-9118-ce6fc6574187'::uuid
  AND COALESCE(c.arquivado, false) = false
  AND COALESCE(c.concluido, false) = false
  AND c.responsavel_id IS DISTINCT FROM p.id;

-- Troca de fase: relógio da fase atual começa agora. O atraso da fase que ficou para trás vai no histórico.
CREATE OR REPLACE FUNCTION public.fn_kanban_cards_entered_fase_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.entered_fase_at := COALESCE(NEW.entered_fase_at, NOW());
  ELSIF TG_OP = 'UPDATE' AND NEW.fase_id IS DISTINCT FROM OLD.fase_id THEN
    NEW.entered_fase_at := NOW();
    NEW.sla_iniciado_em := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_historico_fase_alterada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ordem_antiga INT;
  v_ordem_nova   INT;
  v_nome_antiga  TEXT;
  v_nome_nova    TEXT;
  v_acao         TEXT;
  v_user_id      UUID;
  v_sla_dias     INT;
  v_sla_tipo     TEXT;
  v_inicio       TIMESTAMPTZ;
  v_dias         INT := 0;
  v_atraso       INT := 0;
  v_d            DATE;
  v_fim          DATE;
  v_guard        INT := 0;
BEGIN
  IF OLD.fase_id IS NOT DISTINCT FROM NEW.fase_id THEN
    RETURN NEW;
  END IF;

  SELECT ordem, nome, sla_dias, COALESCE(sla_tipo, 'uteis')
  INTO v_ordem_antiga, v_nome_antiga, v_sla_dias, v_sla_tipo
  FROM public.kanban_fases WHERE id = OLD.fase_id;

  SELECT ordem, nome INTO v_ordem_nova, v_nome_nova
  FROM public.kanban_fases WHERE id = NEW.fase_id;

  v_acao := CASE
    WHEN COALESCE(v_ordem_nova, 0) >= COALESCE(v_ordem_antiga, 0) THEN 'fase_avancada'
    ELSE 'fase_retrocedida'
  END;

  v_inicio := COALESCE(OLD.sla_iniciado_em, OLD.entered_fase_at);
  IF v_inicio IS NOT NULL AND COALESCE(v_sla_dias, 0) > 0 THEN
    v_d := (v_inicio AT TIME ZONE 'America/Sao_Paulo')::date;
    v_fim := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
    WHILE v_d < v_fim AND v_guard < 4000 LOOP
      v_d := v_d + 1;
      v_guard := v_guard + 1;
      IF v_sla_tipo IN ('corridos', 'dias_corridos', 'dia_corridos')
         OR EXTRACT(DOW FROM v_d)::int NOT IN (0, 6) THEN
        v_dias := v_dias + 1;
      END IF;
    END LOOP;
    v_atraso := GREATEST(0, v_dias - v_sla_dias);
  END IF;

  v_user_id := public.fn_kanban_historico_actor_id();

  INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, tipo, detalhe)
  VALUES (
    NEW.id,
    v_user_id,
    public.fn_resolve_usuario_nome(v_user_id),
    v_acao,
    'fase',
    jsonb_build_object(
      'fase_anterior_id', OLD.fase_id,
      'fase_anterior_nome', COALESCE(v_nome_antiga, ''),
      'fase_anterior_ordem', v_ordem_antiga,
      'fase_nova_id', NEW.fase_id,
      'fase_nova_nome', COALESCE(v_nome_nova, ''),
      'fase_nova_ordem', v_ordem_nova,
      'sla_fase_anterior_inicio', v_inicio,
      'sla_fase_anterior_dias', v_dias,
      'sla_fase_anterior_sla_dias', v_sla_dias,
      'sla_fase_anterior_dias_atraso', v_atraso,
      'sla_fase_anterior_atrasou', v_atraso > 0
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'fn_historico_fase_alterada: erro ignorado — %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Cards que ainda carregam o relógio de uma fase anterior passam a contar só a fase atual.
UPDATE public.kanban_cards
SET sla_iniciado_em = NULL
WHERE sla_iniciado_em IS NOT NULL
  AND entered_fase_at IS NOT NULL
  AND sla_iniciado_em < entered_fase_at
  AND COALESCE(arquivado, false) = false
  AND COALESCE(concluido, false) = false;

-- Sino: novo franqueado na Rede → alerta em Gerais para Renata Bendassi
CREATE OR REPLACE FUNCTION public.fn_alerta_novo_franqueado_rede()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID;
  v_nome TEXT;
  v_nf   TEXT;
BEGIN
  SELECT p.id INTO v_user
  FROM public.profiles p
  WHERE lower(trim(COALESCE(p.full_name, ''))) LIKE '%bendassi%'
     OR lower(trim(COALESCE(p.email, ''))) LIKE '%bendassi%'
  ORDER BY CASE
    WHEN lower(trim(COALESCE(p.full_name, ''))) LIKE '%renata%' THEN 0
    ELSE 1
  END
  LIMIT 1;

  IF v_user IS NULL THEN
    RETURN NEW;
  END IF;

  v_nome := COALESCE(NULLIF(trim(NEW.nome_completo), ''), 'Franqueado');
  v_nf := NULLIF(trim(COALESCE(NEW.n_franquia::text, '')), '');

  INSERT INTO public.alertas (user_id, tipo, mensagem, referencia_path, lido)
  VALUES (
    v_user,
    'novo_franqueado_rede',
    'Novo franqueado cadastrado na Rede: ' || v_nome
      || CASE WHEN v_nf IS NOT NULL THEN ' (' || v_nf || ')' ELSE '' END,
    '/rede-franqueados/' || NEW.id::text,
    false
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'fn_alerta_novo_franqueado_rede: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alerta_novo_franqueado_rede ON public.rede_franqueados;
CREATE TRIGGER trg_alerta_novo_franqueado_rede
  AFTER INSERT ON public.rede_franqueados
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_alerta_novo_franqueado_rede();

NOTIFY pgrst, 'reload schema';
