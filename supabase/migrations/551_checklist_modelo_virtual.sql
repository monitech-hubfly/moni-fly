-- 551: Checklist de anexos/checkboxes do Funil Modelo Virtual.
-- Depende de 550 (slugs mv_*). Idempotente por (fase_id, label).

-- mv_modelagem_casa
INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 1, 'Arquivo PLN', 'anexo', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_modelagem_casa'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Arquivo PLN');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 2, 'Arquivo DWG', 'anexo', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_modelagem_casa'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Arquivo DWG');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 3, 'Arquivo IFC', 'anexo', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_modelagem_casa'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Arquivo IFC');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 4, 'Arquivo SKP', 'anexo', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_modelagem_casa'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Arquivo SKP');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 5, 'IFC/DWG/SKP enviados para Boss Panel (orçamento)', 'checkbox', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_modelagem_casa'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'IFC/DWG/SKP enviados para Boss Panel (orçamento)');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 6, 'Esteira de validação de custos iniciada (Karol e Fer)', 'checkbox', false, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_modelagem_casa'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Esteira de validação de custos iniciada (Karol e Fer)');

-- mv_modelagem_infra
INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 1, 'Arquivo IFC', 'anexo', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_modelagem_infra'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Arquivo IFC');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 2, 'Arquivo DWG', 'anexo', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_modelagem_infra'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Arquivo DWG');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 3, 'Arquivo PDF', 'anexo', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_modelagem_infra'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Arquivo PDF');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 4, 'IFC/DWG/PDF enviados para Mtechne (orçamento infra)', 'checkbox', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_modelagem_infra'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'IFC/DWG/PDF enviados para Mtechne (orçamento infra)');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 5, 'Aguardando orçamento Mtechne', 'checkbox', false, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_modelagem_infra'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Aguardando orçamento Mtechne');

-- mv_aguardar_boss
INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 1, 'Orçamento Boss Panel recebido', 'checkbox', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_aguardar_boss'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Orçamento Boss Panel recebido');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 2, 'Projeto Boss Panel (estrutura) recebido', 'checkbox', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_aguardar_boss'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Projeto Boss Panel (estrutura) recebido');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 3, 'Data estimada de entrega Boss Panel', 'texto_curto', false, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_aguardar_boss'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Data estimada de entrega Boss Panel');

-- mv_compat_estrutura
INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 1, 'Arquivo PLN', 'anexo', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_compat_estrutura'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Arquivo PLN');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 2, 'Arquivo DWG', 'anexo', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_compat_estrutura'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Arquivo DWG');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 3, 'Arquivo IFC', 'anexo', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_compat_estrutura'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Arquivo IFC');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 4, 'Arquivo SKP', 'anexo', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_compat_estrutura'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Arquivo SKP');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 5, 'Estrutura conferida com Boss Panel', 'checkbox', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_compat_estrutura'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Estrutura conferida com Boss Panel');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 6, 'Paredes externas conferidas', 'checkbox', false, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_compat_estrutura'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Paredes externas conferidas');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 7, 'Paredes internas conferidas', 'checkbox', false, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_compat_estrutura'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Paredes internas conferidas');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 8, 'Produto novo identificado (não incluso na Gbox)?', 'checkbox', false, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_compat_estrutura'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Produto novo identificado (não incluso na Gbox)?');

-- mv_compat_infra
INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 1, 'Arquivo DWG', 'anexo', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_compat_infra'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Arquivo DWG');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 2, 'Arquivo IFC', 'anexo', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_compat_infra'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Arquivo IFC');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 3, 'Arquivo PDF', 'anexo', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_compat_infra'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Arquivo PDF');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 4, 'IFC/DWG/PDF enviados para Mtechne (projetos completos)', 'checkbox', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_compat_infra'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'IFC/DWG/PDF enviados para Mtechne (projetos completos)');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 5, 'Parecer técnico dos exec locais recebido', 'checkbox', false, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_compat_infra'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Parecer técnico dos exec locais recebido');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 6, 'Compatibilização com ambientes do terreno validada (Lari/Letícia)', 'checkbox', false, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_compat_infra'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Compatibilização com ambientes do terreno validada (Lari/Letícia)');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 7, 'Produto novo identificado (não incluso na Gbox)?', 'checkbox', false, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_compat_infra'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Produto novo identificado (não incluso na Gbox)?');

-- mv_doc_fase1
INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 1, 'Arquivo DWG', 'anexo', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase1'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Arquivo DWG');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 2, 'Arquivo IFC', 'anexo', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase1'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Arquivo IFC');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 3, 'Arquivo PDF', 'anexo', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase1'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Arquivo PDF');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 4, '1410 Esquadrias de alumínio — documentado', 'checkbox', false, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase1'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = '1410 Esquadrias de alumínio — documentado');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 5, '1110 LightWall — documentado', 'checkbox', false, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase1'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = '1110 LightWall — documentado');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 6, '1130 Cimentícia — documentado', 'checkbox', false, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase1'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = '1130 Cimentícia — documentado');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 7, '1220 Revestimento externo — documentado', 'checkbox', false, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase1'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = '1220 Revestimento externo — documentado');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 8, '1320 Brises — documentado', 'checkbox', false, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase1'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = '1320 Brises — documentado');

-- mv_doc_fase2
INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 1, 'Arquivo DWG', 'anexo', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase2'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Arquivo DWG');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 2, 'Arquivo IFC', 'anexo', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase2'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Arquivo IFC');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 3, 'Arquivo PDF', 'anexo', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase2'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Arquivo PDF');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 4, '1100 Estrutura cobertura, telha e acabamentos — documentado', 'checkbox', false, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase2'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = '1100 Estrutura cobertura, telha e acabamentos — documentado');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 5, '1330 Forro — documentado', 'checkbox', false, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase2'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = '1330 Forro — documentado');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 6, '1510 Piso, contrapiso e impermeabilização — documentado', 'checkbox', false, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase2'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = '1510 Piso, contrapiso e impermeabilização — documentado');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 7, '110 Layout e fachadas — documentado', 'checkbox', false, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase2'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = '110 Layout e fachadas — documentado');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 8, '1120 Deck — documentado', 'checkbox', false, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase2'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = '1120 Deck — documentado');

-- mv_doc_fase3
INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 1, 'Arquivo DWG', 'anexo', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase3'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Arquivo DWG');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 2, 'Arquivo IFC', 'anexo', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase3'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Arquivo IFC');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 3, 'Arquivo PDF', 'anexo', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase3'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Arquivo PDF');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 4, '330 Estrutura casa — documentado', 'checkbox', false, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase3'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = '330 Estrutura casa — documentado');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 5, '340 Escada — documentado', 'checkbox', false, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase3'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = '340 Escada — documentado');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 6, '1200 Reforço cobertura para lareira — documentado', 'checkbox', false, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase3'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = '1200 Reforço cobertura para lareira — documentado');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 7, '1210 Parede Boss Panel — documentado', 'checkbox', false, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase3'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = '1210 Parede Boss Panel — documentado');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 8, '1230 Reforço para marmoraria e marcenaria — documentado', 'checkbox', false, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase3'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = '1230 Reforço para marmoraria e marcenaria — documentado');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 9, '1310 MDF paredes e portas + Drywall — documentado', 'checkbox', false, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase3'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = '1310 MDF paredes e portas + Drywall — documentado');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 10, '1520 Revestimentos internos — documentado', 'checkbox', false, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase3'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = '1520 Revestimentos internos — documentado');

-- mv_doc_fase4
INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 1, 'Arquivo DWG', 'anexo', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase4'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Arquivo DWG');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 2, 'Arquivo IFC', 'anexo', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase4'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Arquivo IFC');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 3, 'Arquivo PDF', 'anexo', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase4'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Arquivo PDF');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 4, '1530 Louças e metais — documentado', 'checkbox', false, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase4'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = '1530 Louças e metais — documentado');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 5, '1610 Projeto de marmoraria — documentado', 'checkbox', false, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase4'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = '1610 Projeto de marmoraria — documentado');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 6, '1620 Projeto de marcenaria — documentado', 'checkbox', false, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase4'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = '1620 Projeto de marcenaria — documentado');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 7, '1630 Projeto de box e espelhos — documentado', 'checkbox', false, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase4'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = '1630 Projeto de box e espelhos — documentado');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 8, 'Marcenaria/box/espelhos (SLA 8 dias) — incluídos nesta fase?', 'checkbox', false, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_doc_fase4'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Marcenaria/box/espelhos (SLA 8 dias) — incluídos nesta fase?');

-- mv_concluido
INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 1, 'Todos os projetos entregues aos Waysers', 'checkbox', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_concluido'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Todos os projetos entregues aos Waysers');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 2, 'Pasta de arquivos organizada e arquivada', 'checkbox', true, false
FROM kanban_fases f
WHERE f.kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48' AND f.slug = 'mv_concluido'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Pasta de arquivos organizada e arquivada');

NOTIFY pgrst, 'reload schema';
