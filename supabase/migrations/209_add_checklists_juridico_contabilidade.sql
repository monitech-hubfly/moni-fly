-- 209: Checklists — Funil Jurídico (diligência) e Funil Contabilidade (incorporadora + SPE).
-- Idempotente: INSERT … SELECT com WHERE NOT EXISTS (fase_id + label), alinhado ao Step One (157).

-- ─── Funil Jurídico — juridico_diligencia ───────────────────────────────────
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT v.fase_id, v.ordem, v.label, v.tipo, v.obrigatorio, false
FROM (
  VALUES
    ('f1c2a62b-2f04-4968-8bfc-77d7d53c92bd'::uuid, 1, 'Matrícula atualizada (menos de 30 dias)', 'anexo', true),
    ('f1c2a62b-2f04-4968-8bfc-77d7d53c92bd'::uuid, 2, 'Certidão de ônus reais', 'anexo', true),
    ('f1c2a62b-2f04-4968-8bfc-77d7d53c92bd'::uuid, 3, 'Certidões negativas do proprietário (cível + trabalhista)', 'anexo', true),
    ('f1c2a62b-2f04-4968-8bfc-77d7d53c92bd'::uuid, 4, 'IPTU em dia confirmado', 'checkbox', true),
    ('f1c2a62b-2f04-4968-8bfc-77d7d53c92bd'::uuid, 5, 'Documentos pessoais de todos os proprietários', 'anexo', true),
    ('f1c2a62b-2f04-4968-8bfc-77d7d53c92bd'::uuid, 6, 'Comprovante de endereço dos proprietários', 'anexo', true),
    ('f1c2a62b-2f04-4968-8bfc-77d7d53c92bd'::uuid, 7, 'Convenção do condomínio com recuos e restrições', 'anexo', false),
    ('f1c2a62b-2f04-4968-8bfc-77d7d53c92bd'::uuid, 8, 'Parecer jurídico final', 'texto_longo', true)
) AS v(fase_id, ordem, label, tipo, obrigatorio)
WHERE EXISTS (SELECT 1 FROM public.kanban_fases f WHERE f.id = v.fase_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = v.fase_id AND i.label = v.label
  );

-- ─── Funil Contabilidade — contabilidade_incorporadora ──────────────────────
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT v.fase_id, v.ordem, v.label, v.tipo, v.obrigatorio, false
FROM (
  VALUES
    ('d3b12d36-0a87-4f30-bd1d-5f206eba037d'::uuid, 1, 'Contrato social da Incorporadora redigido', 'anexo', true),
    ('d3b12d36-0a87-4f30-bd1d-5f206eba037d'::uuid, 2, 'CNPJ da Incorporadora emitido', 'anexo', true),
    ('d3b12d36-0a87-4f30-bd1d-5f206eba037d'::uuid, 3, 'Alvará de funcionamento', 'checkbox', false)
) AS v(fase_id, ordem, label, tipo, obrigatorio)
WHERE EXISTS (SELECT 1 FROM public.kanban_fases f WHERE f.id = v.fase_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = v.fase_id AND i.label = v.label
  );

-- ─── Funil Contabilidade — contabilidade_spe ──────────────────────────────────
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT v.fase_id, v.ordem, v.label, v.tipo, v.obrigatorio, false
FROM (
  VALUES
    ('a5facdfc-b6f2-41cb-aea2-63614712910b'::uuid, 1, 'Contrato social da SPE', 'anexo', true),
    ('a5facdfc-b6f2-41cb-aea2-63614712910b'::uuid, 2, 'CNPJ da SPE emitido', 'anexo', true),
    ('a5facdfc-b6f2-41cb-aea2-63614712910b'::uuid, 3, 'Conta bancária da SPE aberta', 'checkbox', true)
) AS v(fase_id, ordem, label, tipo, obrigatorio)
WHERE EXISTS (SELECT 1 FROM public.kanban_fases f WHERE f.id = v.fase_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = v.fase_id AND i.label = v.label
  );
