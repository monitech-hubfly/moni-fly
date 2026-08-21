-- 445: Funil Cash Me (Crédito Obra) — checklist por fase (25 fases co_* + terminais)
--   • Insere itens em kanban_fase_checklist_itens (tipo checkbox, obrigatorio=false).
--   • fase_id resolvido por slug + kanban Cash Me (UUID 6463af1d-… ou nome).
--   • Idempotente: WHERE NOT EXISTS por (fase_id, label). Rodar 2x não duplica.
-- NÃO altera fases, SLAs nem respostas existentes.

INSERT INTO public.kanban_fase_checklist_itens (fase_id, label, tipo, obrigatorio, ordem)
SELECT kf.id, v.label, 'checkbox', false, v.ordem
FROM public.kanban_fases kf
JOIN public.kanbans k ON k.id = kf.kanban_id
JOIN (
  VALUES
    -- co_novo_projeto
    ('co_novo_projeto', 'Projeto vinculado ao Frank correto', 1),
    ('co_novo_projeto', 'Documentação inicial recebida (link Google Docs verificado)', 2),
    ('co_novo_projeto', 'Contato CASHME estabelecido', 3),
    -- co_envio_cashme
    ('co_envio_cashme', 'Pacote de documentos enviado', 1),
    ('co_envio_cashme', 'Confirmação de recebimento da CASHME registrada', 2),
    ('co_envio_cashme', 'Data de envio anotada no card', 3),
    -- co_outro_parceiro
    ('co_outro_parceiro', 'Motivo da recusa da CASHME documentado', 1),
    ('co_outro_parceiro', 'Frank notificado com justificativa', 2),
    ('co_outro_parceiro', 'Alternativas mapeadas', 3),
    -- co_documentacao_alvara
    ('co_documentacao_alvara', 'Alvará enviado (alvara_url preenchido)', 1),
    ('co_documentacao_alvara', 'Documentos do terreno em nome da SPE (docs_terreno_url preenchido)', 2),
    ('co_documentacao_alvara', 'SLA iniciado após upload dos dois documentos', 3),
    -- co_validacao_contrato
    ('co_validacao_contrato', 'CASHME notificada da chegada dos documentos', 1),
    ('co_validacao_contrato', 'Data prevista de validação registrada', 2),
    ('co_validacao_contrato', 'Follow-up agendado para D+1', 3),
    -- co_contrato_assinaturas
    ('co_contrato_assinaturas', 'Contrato enviado ao Frank', 1),
    ('co_contrato_assinaturas', 'Contrato enviado à CASHME', 2),
    ('co_contrato_assinaturas', 'Data limite de assinatura definida', 3),
    ('co_contrato_assinaturas', 'Assinatura Frank confirmada', 4),
    ('co_contrato_assinaturas', 'Assinatura CASHME confirmada', 5),
    ('co_contrato_assinaturas', 'Assinatura Moní confirmada', 6),
    -- co_followup_cartorio
    ('co_followup_cartorio', 'Follow-up realizado com a CASHME', 1),
    ('co_followup_cartorio', 'Confirmação de conclusão no cartório recebida', 2),
    ('co_followup_cartorio', 'Comprovante de registro no card', 3),
    -- co_aguardando_1a_tranche
    ('co_aguardando_1a_tranche', 'Data prevista de liberação confirmada com CASHME', 1),
    ('co_aguardando_1a_tranche', 'Frank notificado da data', 2),
    ('co_aguardando_1a_tranche', 'Alerta criado para D-1 da liberação', 3),

    -- Grupo «Necessidade de Tranche» (2ª a 6ª)
    ('co_solicitacao_tranche', '% físico-financeiro informado pelo Frank', 1),
    ('co_solicitacao_tranche', 'NFs recebidas e verificadas', 2),
    ('co_solicitacao_tranche', 'Evidências / fotos da obra recebidas', 3),
    ('co_solicitacao_tranche', 'Tudo aprovado internamente antes de subir', 4),
    ('co_necessidade_3a_tranche', '% físico-financeiro informado pelo Frank', 1),
    ('co_necessidade_3a_tranche', 'NFs recebidas e verificadas', 2),
    ('co_necessidade_3a_tranche', 'Evidências / fotos da obra recebidas', 3),
    ('co_necessidade_3a_tranche', 'Tudo aprovado internamente antes de subir', 4),
    ('co_necessidade_4a_tranche', '% físico-financeiro informado pelo Frank', 1),
    ('co_necessidade_4a_tranche', 'NFs recebidas e verificadas', 2),
    ('co_necessidade_4a_tranche', 'Evidências / fotos da obra recebidas', 3),
    ('co_necessidade_4a_tranche', 'Tudo aprovado internamente antes de subir', 4),
    ('co_necessidade_5a_tranche', '% físico-financeiro informado pelo Frank', 1),
    ('co_necessidade_5a_tranche', 'NFs recebidas e verificadas', 2),
    ('co_necessidade_5a_tranche', 'Evidências / fotos da obra recebidas', 3),
    ('co_necessidade_5a_tranche', 'Tudo aprovado internamente antes de subir', 4),
    ('co_necessidade_6a_tranche', '% físico-financeiro informado pelo Frank', 1),
    ('co_necessidade_6a_tranche', 'NFs recebidas e verificadas', 2),
    ('co_necessidade_6a_tranche', 'Evidências / fotos da obra recebidas', 3),
    ('co_necessidade_6a_tranche', 'Tudo aprovado internamente antes de subir', 4),

    -- Grupo «SharePoint CASHME + Email» (2ª a 6ª)
    ('co_sharepoint_cashme', 'Documentos subidos no SharePoint da CASHME', 1),
    ('co_sharepoint_cashme', 'E-mail padrão enviado à CASHME', 2),
    ('co_sharepoint_cashme', 'Confirmação de recebimento da CASHME registrada', 3),
    ('co_sharepoint_3a', 'Documentos subidos no SharePoint da CASHME', 1),
    ('co_sharepoint_3a', 'E-mail padrão enviado à CASHME', 2),
    ('co_sharepoint_3a', 'Confirmação de recebimento da CASHME registrada', 3),
    ('co_sharepoint_4a', 'Documentos subidos no SharePoint da CASHME', 1),
    ('co_sharepoint_4a', 'E-mail padrão enviado à CASHME', 2),
    ('co_sharepoint_4a', 'Confirmação de recebimento da CASHME registrada', 3),
    ('co_sharepoint_5a', 'Documentos subidos no SharePoint da CASHME', 1),
    ('co_sharepoint_5a', 'E-mail padrão enviado à CASHME', 2),
    ('co_sharepoint_5a', 'Confirmação de recebimento da CASHME registrada', 3),
    ('co_sharepoint_6a', 'Documentos subidos no SharePoint da CASHME', 1),
    ('co_sharepoint_6a', 'E-mail padrão enviado à CASHME', 2),
    ('co_sharepoint_6a', 'Confirmação de recebimento da CASHME registrada', 3),

    -- Grupo «Acompanhamento da Liberação» (2ª a 6ª)
    ('co_acompanhamento_tranche', 'Data prevista de liberação registrada', 1),
    ('co_acompanhamento_tranche', 'Frank notificado do status e da data', 2),
    ('co_acompanhamento_tranche', 'Follow-up agendado para D+2 caso não libere', 3),
    ('co_acompanhamento_3a', 'Data prevista de liberação registrada', 1),
    ('co_acompanhamento_3a', 'Frank notificado do status e da data', 2),
    ('co_acompanhamento_3a', 'Follow-up agendado para D+2 caso não libere', 3),
    ('co_acompanhamento_4a', 'Data prevista de liberação registrada', 1),
    ('co_acompanhamento_4a', 'Frank notificado do status e da data', 2),
    ('co_acompanhamento_4a', 'Follow-up agendado para D+2 caso não libere', 3),
    ('co_acompanhamento_5a', 'Data prevista de liberação registrada', 1),
    ('co_acompanhamento_5a', 'Frank notificado do status e da data', 2),
    ('co_acompanhamento_5a', 'Follow-up agendado para D+2 caso não libere', 3),
    ('co_acompanhamento_6a', 'Data prevista de liberação registrada', 1),
    ('co_acompanhamento_6a', 'Frank notificado do status e da data', 2),
    ('co_acompanhamento_6a', 'Follow-up agendado para D+2 caso não libere', 3),

    -- Terminais
    ('credito_obra_aprovado', 'Frank notificado da conclusão', 1),
    ('credito_obra_aprovado', 'Processo encerrado no sistema', 2),
    ('credito_obra_aprovado', 'Relatório final enviado', 3),
    ('credito_obra_reprovado', 'Motivo documentado no card', 1),
    ('credito_obra_reprovado', 'Frank notificado com justificativa por escrito', 2),
    ('credito_obra_reprovado', 'Próximos passos definidos', 3)
) AS v(fase_slug, label, ordem)
  ON kf.slug = v.fase_slug
WHERE (
    k.id = '6463af1d-850d-4958-b74c-404f8d668e21'::uuid
    OR k.nome IN ('Funil Cash Me', 'Funil Crédito Obra', 'Funil Crédito')
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = kf.id
      AND i.label = v.label
  );

DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.kanban_fase_checklist_itens i
  JOIN public.kanban_fases kf ON kf.id = i.fase_id
  JOIN public.kanbans k ON k.id = kf.kanban_id
  WHERE (
    k.id = '6463af1d-850d-4958-b74c-404f8d668e21'::uuid
    OR k.nome IN ('Funil Cash Me', 'Funil Crédito Obra', 'Funil Crédito')
  );
  RAISE NOTICE '445: itens de checklist no Funil Cash Me = % (esperado 83)', v_count;
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('445', 'funil_cash_me_fases_checklist')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
