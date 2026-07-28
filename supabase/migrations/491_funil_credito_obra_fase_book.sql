-- 491: Funil Crédito Obra — fase Book, renomeia Envio p/ Parceiros, remove Procurar Outro Parceiro.
-- UUID: 6463af1d-850d-4958-b74c-404f8d668e21 (KANBAN_IDS.CREDITO_OBRA)
-- Bastões co_outro_parceiro / credito_obra_ok preservados para cards legados (fase inativa).

DO $$
DECLARE
  v_kanban_id uuid := '6463af1d-850d-4958-b74c-404f8d668e21'::uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanbans WHERE id = v_kanban_id) THEN
    SELECT id INTO v_kanban_id
    FROM public.kanbans
    WHERE nome IN ('Funil Crédito Obra', 'Funil Cash Me', 'Funil Crédito')
    ORDER BY CASE
      WHEN nome = 'Funil Crédito Obra' THEN 0
      WHEN nome = 'Funil Cash Me' THEN 1
      ELSE 2
    END
    LIMIT 1;
  END IF;

  IF v_kanban_id IS NULL THEN
    RAISE EXCEPTION '[491] Kanban Funil Crédito Obra não encontrado';
  END IF;

  RAISE NOTICE '[491] Funil Crédito Obra kanban_id=%', v_kanban_id;
END $$;

-- ─── Nova fase: Book (após Novo Projeto) ─────────────────────────────────────
INSERT INTO public.kanban_fases (
  kanban_id, nome, slug, ordem, sla_dias, sla_tipo, fase_conversao, ativo, instrucoes, materiais
)
SELECT
  k.id,
  'Book',
  'co_book',
  2,
  2,
  'uteis',
  false,
  true,
  NULL,
  '[]'::jsonb
FROM public.kanbans k
WHERE (k.id = '6463af1d-850d-4958-b74c-404f8d668e21'::uuid
    OR k.nome IN ('Funil Crédito Obra', 'Funil Cash Me', 'Funil Crédito'))
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fases kf
    WHERE kf.kanban_id = k.id AND kf.slug = 'co_book'
  );

-- ─── Desativar fase removida do funil ────────────────────────────────────────
UPDATE public.kanban_fases kf
SET ativo = false
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '6463af1d-850d-4958-b74c-404f8d668e21'::uuid
    OR k.nome IN ('Funil Crédito Obra', 'Funil Cash Me', 'Funil Crédito'))
  AND kf.slug = 'co_outro_parceiro';

-- ─── Nomes e ordem das fases ativas ──────────────────────────────────────────
UPDATE public.kanban_fases kf
SET
  nome = v.nome,
  ordem = v.ordem,
  sla_tipo = COALESCE(kf.sla_tipo, 'uteis'),
  ativo = true
FROM public.kanbans k,
  (VALUES
    ('co_novo_projeto',            'Novo Projeto',                              1),
    ('co_book',                    'Book',                                      2),
    ('co_envio_cashme',            'Envio p/ Parceiros',                        3),
    ('co_documentacao_alvara',     'Documentação Alvará e Terreno SPE',         4),
    ('co_validacao_contrato',      'Aguardando Validação do Contrato',          5),
    ('co_contrato_assinaturas',    'Contrato para Assinaturas das 3 Partes',    6),
    ('co_followup_cartorio',       'Follow-up Cartório',                        7),
    ('co_aguardando_1a_tranche',   'Aguardando 1ª Tranche',                     8),
    ('co_solicitacao_tranche',     'Necessidade de 2ª Tranche',                 9),
    ('co_sharepoint_cashme',       '2ª T: SharePoint CASHME + Email do Franqueado', 10),
    ('co_acompanhamento_tranche',  '2ª T: Acompanhamento da Liberação',         11),
    ('co_necessidade_3a_tranche',  'Necessidade de 3ª Tranche',                12),
    ('co_sharepoint_3a',           '3ª T: SharePoint CASHME + Email do Franqueado', 13),
    ('co_acompanhamento_3a',       '3ª T: Acompanhamento da Liberação',         14),
    ('co_necessidade_4a_tranche',  'Necessidade de 4ª Tranche',                15),
    ('co_sharepoint_4a',           '4ª T: SharePoint CASHME + Email do Franqueado', 16),
    ('co_acompanhamento_4a',       '4ª T: Acompanhamento da Liberação',         17),
    ('co_necessidade_5a_tranche',  'Necessidade de 5ª Tranche',                18),
    ('co_sharepoint_5a',           '5ª T: SharePoint CASHME + Email do Franqueado', 19),
    ('co_acompanhamento_5a',       '5ª T: Acompanhamento da Liberação',         20),
    ('co_necessidade_6a_tranche',  'Necessidade de 6ª Tranche',                21),
    ('co_sharepoint_6a',           '6ª T: SharePoint CASHME + Email do Franqueado', 22),
    ('co_acompanhamento_6a',       '6ª T: Acompanhamento da Liberação',         23),
    ('credito_obra_aprovado',      'Obra Aprovada',                            24),
    ('credito_obra_reprovado',     'Obra Reprovada',                           25)
  ) AS v(slug, nome, ordem)
WHERE kf.kanban_id = k.id
  AND (k.id = '6463af1d-850d-4958-b74c-404f8d668e21'::uuid
    OR k.nome IN ('Funil Crédito Obra', 'Funil Cash Me', 'Funil Crédito'))
  AND kf.slug = v.slug;

-- ─── Instruções ──────────────────────────────────────────────────────────────
UPDATE public.kanban_fases kf
SET instrucoes = $instr$Montagem e validação do book de apresentação do projeto para envio aos parceiros de crédito obra.
Consolidar dados do empreendimento, SPE, documentação inicial e premissas comerciais antes do primeiro envio externo.

Bastão → Envio p/ Parceiros: book revisado e aprovado internamente.$instr$
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '6463af1d-850d-4958-b74c-404f8d668e21'::uuid
    OR k.nome IN ('Funil Crédito Obra', 'Funil Cash Me', 'Funil Crédito'))
  AND kf.slug = 'co_book';

UPDATE public.kanban_fases kf
SET instrucoes = $instr$Primeiro envio formal do pacote do projeto aos parceiros de crédito obra (ex.: CASHME e demais).
Registrar data de envio, confirmação de recebimento e canal utilizado.

Bastão → Documentação Alvará e Terreno SPE: parceiro confirmou recebimento e deu encaminhamento.$instr$
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '6463af1d-850d-4958-b74c-404f8d668e21'::uuid
    OR k.nome IN ('Funil Crédito Obra', 'Funil Cash Me', 'Funil Crédito'))
  AND kf.slug = 'co_envio_cashme';

-- ─── Checklist — Book ────────────────────────────────────────────────────────
INSERT INTO public.kanban_fase_checklist_itens (
  fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json, placeholder
)
SELECT f.id, i.ordem, i.label, i.tipo, i.obrigatorio, false, i.campo_slug, i.config_json::jsonb, i.placeholder
FROM public.kanban_fases f
INNER JOIN public.kanbans k ON k.id = f.kanban_id
CROSS JOIN (
  VALUES
    (1, 'Book estruturado', 'checkbox', true, 'co_book_estruturado', '{}', NULL),
    (2, 'Link ou anexo do book', 'url', true, 'co_book_link', '{}', NULL),
    (3, 'Revisão interna concluída', 'checkbox', true, 'co_book_revisao_interna', '{}', NULL)
) AS i(ordem, label, tipo, obrigatorio, campo_slug, config_json, placeholder)
WHERE (k.id = '6463af1d-850d-4958-b74c-404f8d668e21'::uuid
    OR k.nome IN ('Funil Crédito Obra', 'Funil Cash Me', 'Funil Crédito'))
  AND f.slug = 'co_book'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens x
    WHERE x.fase_id = f.id AND x.campo_slug = i.campo_slug
  );

-- ─── Responsável da fase (oculto) — Book ─────────────────────────────────────
INSERT INTO public.kanban_fase_checklist_itens (
  fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
)
SELECT
  f.id, i.ordem, i.label, i.tipo, false, false, i.campo_slug, i.config_json::jsonb
FROM public.kanban_fases f
INNER JOIN public.kanbans k ON k.id = f.kanban_id
CROSS JOIN (
  VALUES
    (-2, 'Responsável da fase — tipo', 'select', 'responsavel_da_fase_tipo',
     '{"oculto_ui": true, "opcoes": ["Franqueado", "Moní"]}'),
    (-1, 'Responsável da fase — usuário Moní', 'usuario', 'responsavel_da_fase_usuario',
     '{"oculto_ui": true}')
) AS i(ordem, label, tipo, campo_slug, config_json)
WHERE (k.id = '6463af1d-850d-4958-b74c-404f8d668e21'::uuid
    OR k.nome IN ('Funil Crédito Obra', 'Funil Cash Me', 'Funil Crédito'))
  AND f.slug = 'co_book'
  AND COALESCE(f.ativo, true) = true
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens x
    WHERE x.fase_id = f.id AND x.campo_slug = i.campo_slug
  );

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('491', 'funil_credito_obra_fase_book')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
