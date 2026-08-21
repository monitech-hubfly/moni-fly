-- 209: Checklists — Funil Jurídico (diligência) e Funil Contabilidade (incorporadora + SPE).
-- Idempotente: INSERT … SELECT com WHERE NOT EXISTS (fase_id + label), alinhado ao Step One (157).

-- ─── Funil Jurídico — fase juridico_diligencia ───────────────────────────────
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT 'f1c2a62b-2f04-4968-8bfc-77d7d53c92bd'::uuid, ordem, label, tipo, obrigatorio, false
FROM (VALUES
  (1, 'Matrícula atualizada (menos de 30 dias)', 'anexo', true),
  (2, 'Certidão de ônus reais', 'anexo', true),
  (3, 'Certidões negativas do proprietário (cível + trabalhista)', 'anexo', true),
  (4, 'IPTU em dia confirmado', 'checkbox', true),
  (5, 'Documentos pessoais de todos os proprietários', 'anexo', true),
  (6, 'Comprovante de endereço dos proprietários', 'anexo', true),
  (7, 'Convenção do condomínio com recuos e restrições', 'anexo', false),
  (8, 'Parecer jurídico final', 'texto_longo', true)
) AS t(ordem, label, tipo, obrigatorio)
WHERE EXISTS (SELECT 1 FROM public.kanban_fases WHERE id = 'f1c2a62b-2f04-4968-8bfc-77d7d53c92bd'::uuid)
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens
    WHERE fase_id = 'f1c2a62b-2f04-4968-8bfc-77d7d53c92bd'::uuid AND label = t.label
  );

-- ─── Funil Contabilidade — fase contabilidade_incorporadora ──────────────────
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT 'd3b12d36-0a87-4f30-bd1d-5f206eba037d'::uuid, ordem, label, tipo, obrigatorio, false
FROM (VALUES
  (1, 'Contrato social da Incorporadora redigido', 'anexo', true),
  (2, 'CNPJ da Incorporadora emitido', 'anexo', true),
  (3, 'Alvará de funcionamento', 'checkbox', false)
) AS t(ordem, label, tipo, obrigatorio)
WHERE EXISTS (SELECT 1 FROM public.kanban_fases WHERE id = 'd3b12d36-0a87-4f30-bd1d-5f206eba037d'::uuid)
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens
    WHERE fase_id = 'd3b12d36-0a87-4f30-bd1d-5f206eba037d'::uuid AND label = t.label
  );

-- ─── Funil Contabilidade — fase contabilidade_spe ────────────────────────────
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT 'a5facdfc-b6f2-41cb-aea2-63614712910b'::uuid, ordem, label, tipo, obrigatorio, false
FROM (VALUES
  (1, 'Contrato social da SPE', 'anexo', true),
  (2, 'CNPJ da SPE emitido', 'anexo', true),
  (3, 'Conta bancária da SPE aberta', 'checkbox', true)
) AS t(ordem, label, tipo, obrigatorio)
WHERE EXISTS (SELECT 1 FROM public.kanban_fases WHERE id = 'a5facdfc-b6f2-41cb-aea2-63614712910b'::uuid)
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens
    WHERE fase_id = 'a5facdfc-b6f2-41cb-aea2-63614712910b'::uuid AND label = t.label
  );
