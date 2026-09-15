-- 547: Instruções + checklist (Pré Obra e Obra).
-- Idempotente. UPDATE instrucoes por kanban_id+slug; INSERT checklist só se não existir (fase_id+label).
-- UUIDs: Pré Obra 91686091-077d-479d-bbb3-cb062ded286e | Obra 8b25508c-afdc-4a44-84a8-36c4fcf8cb4b

-- ============================================================================
-- PART 1 — Instruções das fases (Funil Pré Obra)
-- ============================================================================

UPDATE public.kanban_fases
SET instrucoes = '<p>Receber e registrar o contato do cliente (origem, dados e interesse no projeto).</p><ul><li>Registrar nome, telefone, e-mail e endereço/terreno no card.</li><li>Agendar reunião de briefing (presencial ou online) com o time responsável.</li><li>Conduzir o briefing: programa de necessidades, prazo desejado, orçamento preliminar e restrições do terreno/condomínio.</li><li>Anexar ata ou notas do briefing no card.</li><li>Avançar para a próxima fase somente após o briefing completo.</li></ul>'
WHERE kanban_id = '91686091-077d-479d-bbb3-cb062ded286e'
  AND slug = 'pre_briefing';

UPDATE public.kanban_fases
SET instrucoes = '<p>Analisar a viabilidade técnica, urbanística e comercial do terreno.</p><ul><li>Verificar zoneamento, recuos, taxa de ocupação, gabarito e exigências do condomínio (se houver).</li><li>Avaliar topografia, acessos, infraestrutura e restrições ambientais/legais.</li><li>Estimar custos preliminares e alinhamento com o orçamento do cliente.</li><li>Se INVIÁVEL: registrar o motivo no card e arquivar.</li><li>Se VIÁVEL: documentar o parecer e avançar para Proposta Comercial.</li></ul>'
WHERE kanban_id = '91686091-077d-479d-bbb3-cb062ded286e'
  AND slug = 'pre_viabilidade';

UPDATE public.kanban_fases
SET instrucoes = '<p>Elaborar e apresentar a proposta comercial ao cliente.</p><ul><li>Montar proposta com escopo, prazo estimado, condições comerciais e exclusões.</li><li>Enviar proposta formal e registrar data de envio no card.</li><li>Fazer follow-up em até 3 dias úteis após o envio.</li><li>Registrar dúvidas, renegociações e versões da proposta.</li><li>Após aprovação formal do cliente, anexar o aceite e avançar.</li></ul>'
WHERE kanban_id = '91686091-077d-479d-bbb3-cb062ded286e'
  AND slug = 'pre_proposta';

UPDATE public.kanban_fases
SET instrucoes = '<p>Reunir documentação e formalizar o contrato com o cliente.</p><ul><li>Coletar documentos do cliente e do terreno (matrícula, IPTU, documentos pessoais/empresa).</li><li>Encaminhar ao Jurídico para elaboração/revisão do contrato.</li><li>Coletar assinaturas das duas partes (digital ou física).</li><li>Anexar contrato assinado, matrícula do terreno e ART/RRT registrada.</li><li>Conferir checklist obrigatório antes de avançar.</li></ul>'
WHERE kanban_id = '91686091-077d-479d-bbb3-cb062ded286e'
  AND slug = 'pre_contrato';

UPDATE public.kanban_fases
SET instrucoes = '<p>Desenvolver o projeto arquitetônico até a aprovação do cliente.</p><ul><li>Produzir pelo menos 2 layouts/opções de implantação e planta.</li><li>Apresentar ao cliente e registrar feedback.</li><li>Incorporar revisões acordadas (controle de versões no card).</li><li>Evoluir para projeto legal (plantas, cortes, fachadas conforme prefeitura).</li><li>Obter avaliação/aprovação formal do cliente antes de protocolar.</li></ul>'
WHERE kanban_id = '91686091-077d-479d-bbb3-cb062ded286e'
  AND slug = 'pre_projeto_arq';

UPDATE public.kanban_fases
SET instrucoes = '<p>Protocolar e acompanhar a aprovação do projeto na prefeitura.</p><ul><li>Protocolar o projeto legal na prefeitura/órgão competente.</li><li>Registrar o número do protocolo no card.</li><li>Acompanhar exigências e responder dentro do prazo.</li><li>Anexar todas as exigências e respostas no card.</li><li>Quando emitido, anexar o alvará e registrar o número do alvará antes de avançar.</li></ul>'
WHERE kanban_id = '91686091-077d-479d-bbb3-cb062ded286e'
  AND slug = 'pre_aprovacao_projeto';

UPDATE public.kanban_fases
SET instrucoes = '<p>Contratar e compatibilizar os projetos complementares.</p><ul><li>Elaborar/contratar projetos estrutural, elétrico e hidráulico (e demais necessários).</li><li>Realizar compatibilização entre arquitetura e complementares.</li><li>Registrar pendências de compatibilização e resolver antes da liberação.</li><li>Organizar pasta completa em PDF + DWG e anexar no card.</li><li>Validar com engenharia/arquitetura antes de avançar para orçamento.</li></ul>'
WHERE kanban_id = '91686091-077d-479d-bbb3-cb062ded286e'
  AND slug = 'pre_projetos_comp';

UPDATE public.kanban_fases
SET instrucoes = '<p>Montar o orçamento executivo detalhado e obter o aceite do cliente.</p><ul><li>Elaborar orçamento detalhado por etapas e insumos.</li><li>Incluir contingência de 5% a 10% e deixar explícito na proposta de custos.</li><li>Apresentar ao cliente e registrar dúvidas/ajustes.</li><li>Obter aceite formal do orçamento (assinatura ou confirmação documentada).</li><li>Anexar planilha/versão aprovada no card e avançar.</li></ul>'
WHERE kanban_id = '91686091-077d-479d-bbb3-cb062ded286e'
  AND slug = 'pre_orcamento';

UPDATE public.kanban_fases
SET instrucoes = '<p>Planejar a execução da obra (cronograma, equipe e fornecedores).</p><ul><li>Montar cronograma físico-financeiro alinhado ao orçamento aprovado.</li><li>Definir engenheiro responsável e mestre de obras.</li><li>Selecionar/contratar empreiteiras e fornecedores críticos.</li><li>Definir data de início e marcos de medição.</li><li>Anexar cronograma e lista de responsáveis no card antes de avançar.</li></ul>'
WHERE kanban_id = '91686091-077d-479d-bbb3-cb062ded286e'
  AND slug = 'pre_planejamento';

UPDATE public.kanban_fases
SET instrucoes = '<p>Mobilizar o canteiro e liberar o início oficial da obra.</p><ul><li>Instalar placa de obra, cercamento e barracão/container conforme normas.</li><li>Solicitar ligações provisórias (água, energia e esgoto, se aplicável).</li><li>Elaborar e assinar a Ata de Início com o cliente.</li><li>Conferir checklist obrigatório (placa, cercamento e ata).</li><li><strong>AO MOVER:</strong> o sistema abre automaticamente um card no Funil Obra vinculado a este processo.</li></ul>'
WHERE kanban_id = '91686091-077d-479d-bbb3-cb062ded286e'
  AND slug = 'pre_mobilizacao';

-- ============================================================================
-- PART 1 — Instruções das fases (Funil Obra)
-- ============================================================================

UPDATE public.kanban_fases
SET instrucoes = '<p>Executar os serviços preliminares no terreno.</p><ul><li>Realizar topografia e locação da obra conforme projeto.</li><li>Executar limpeza, terraplenagem e preparo do canteiro.</li><li>Implantar acessos, depósitos e sinalização de segurança.</li><li>Fotodocumentar o estado inicial e os serviços preliminares.</li><li>Liberar a frente para fundação somente após conferência técnica.</li></ul>'
WHERE kanban_id = '8b25508c-afdc-4a44-84a8-36c4fcf8cb4b'
  AND slug = 'obra_preliminares';

UPDATE public.kanban_fases
SET instrucoes = '<p>Executar a fundação conforme projeto estrutural.</p><ul><li>Executar escavações, formas, armação e concretagem da fundação.</li><li>Respeitar níveis, cotas e especificações do projeto.</li><li>Realizar ensaios/controle tecnológico quando exigido.</li><li>Fotodocumentar etapas críticas antes do reaterro.</li><li>Avançar após liberação técnica da fundação.</li></ul>'
WHERE kanban_id = '8b25508c-afdc-4a44-84a8-36c4fcf8cb4b'
  AND slug = 'obra_fundacao';

UPDATE public.kanban_fases
SET instrucoes = '<p>Executar a estrutura (pilares, vigas, lajes e demais elementos).</p><ul><li>Montar formas, armação e concretagem conforme cronograma estrutural.</li><li>Controlar prumo, nível e resistência do concreto.</li><li>Registrar medições e ocorrências no card.</li><li>Fotodocumentar etapas estruturais relevantes.</li><li>Liberar vedações somente após cura/liberação técnica adequada.</li></ul>'
WHERE kanban_id = '8b25508c-afdc-4a44-84a8-36c4fcf8cb4b'
  AND slug = 'obra_estrutura';

UPDATE public.kanban_fases
SET instrucoes = '<p>Executar vedações e cobertura.</p><ul><li>Executar alvenaria/vedações conforme projeto arquitetônico.</li><li>Instalar estrutura de cobertura, telhado/impermeabilização e calhas.</li><li>Conferir aberturas (portas/janelas) e pontos de passagem de instalações.</li><li>Fotodocumentar fachadas e cobertura.</li><li>Avançar após estanqueidade básica e liberação para instalações.</li></ul>'
WHERE kanban_id = '8b25508c-afdc-4a44-84a8-36c4fcf8cb4b'
  AND slug = 'obra_vedacoes';

UPDATE public.kanban_fases
SET instrucoes = '<p>Executar e validar as instalações embutidas e aparentes.</p><ul><li>Executar instalações elétricas, hidráulicas, esgoto, gás e lógica conforme projetos.</li><li>Fotodocumentar as instalações embutidas antes do fechamento.</li><li>Solicitar e anexar aprovações das concessionárias quando aplicável.</li><li>Realizar testes de funcionamento e estanqueidade.</li><li>Conferir checklist obrigatório antes de avançar para revestimentos.</li></ul>'
WHERE kanban_id = '8b25508c-afdc-4a44-84a8-36c4fcf8cb4b'
  AND slug = 'obra_instalacoes';

UPDATE public.kanban_fases
SET instrucoes = '<p>Executar revestimentos internos e externos.</p><ul><li>Aplicar impermeabilizações, chapisco, emboço/reboco e contrapiso conforme especificação.</li><li>Assentar pisos, azulejos e revestimentos de parede.</li><li>Executar pintura base e preparos de superfície.</li><li>Conferir níveis, alinhamentos e acabamento visual.</li><li>Fotodocumentar ambientes principais antes dos acabamentos finais.</li></ul>'
WHERE kanban_id = '8b25508c-afdc-4a44-84a8-36c4fcf8cb4b'
  AND slug = 'obra_revestimentos';

UPDATE public.kanban_fases
SET instrucoes = '<p>Instalar esquadrias e concluir acabamentos.</p><ul><li>Instalar portas, janelas, ferragens e vidros.</li><li>Instalar louças, metais, bancadas e marcenaria prevista.</li><li>Concluir pinturas finais e detalhes de acabamento.</li><li>Testar funcionamento de esquadrias e metais.</li><li>Registrar pendências remanescentes para a vistoria.</li></ul>'
WHERE kanban_id = '8b25508c-afdc-4a44-84a8-36c4fcf8cb4b'
  AND slug = 'obra_acabamentos';

UPDATE public.kanban_fases
SET instrucoes = '<p>Executar paisagismo e áreas externas.</p><ul><li>Finalizar passeios, muros, drenagem superficial e limpeza externa.</li><li>Executar paisagismo, irrigação e iluminação externa conforme projeto.</li><li>Conferir acessos, garagem e áreas de lazer.</li><li>Fotodocumentar áreas externas concluídas.</li><li>Preparar o imóvel para vistoria final com o cliente.</li></ul>'
WHERE kanban_id = '8b25508c-afdc-4a44-84a8-36c4fcf8cb4b'
  AND slug = 'obra_paisagismo';

UPDATE public.kanban_fases
SET instrucoes = '<p>Realizar a vistoria final e tratar o punch list.</p><ul><li>Agendar vistoria com o cliente presente.</li><li>Preencher o punch list (pendências e prazos de correção).</li><li>Corrigir itens apontados e registrar evidências.</li><li>Obter aceite do cliente sobre a vistoria (ou nova rodada, se necessário).</li><li>Conferir checklist obrigatório antes de avançar para entrega.</li></ul>'
WHERE kanban_id = '8b25508c-afdc-4a44-84a8-36c4fcf8cb4b'
  AND slug = 'obra_vistoria';

UPDATE public.kanban_fases
SET instrucoes = '<p>Emitir o habite-se e formalizar a entrega das chaves.</p><ul><li>Protocolar e obter o habite-se; anexar o documento no card.</li><li>Entregar o Manual do Proprietário ao cliente.</li><li>Assinar a Ata de Entrega com o cliente.</li><li>Coletar NPS/avaliação de satisfação pós-entrega.</li><li><strong>AO MOVER:</strong> o sistema abre automaticamente o fluxo Moní Care (pós-obra / garantia).</li></ul>'
WHERE kanban_id = '8b25508c-afdc-4a44-84a8-36c4fcf8cb4b'
  AND slug = 'obra_entrega';

-- ============================================================================
-- PART 2 — Checklist itens (INSERT se não existir)
-- ============================================================================

-- pre_contrato
INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 1, 'Contrato assinado pelas duas partes', 'checkbox', true, true
FROM kanban_fases f
WHERE f.kanban_id = '91686091-077d-479d-bbb3-cb062ded286e' AND f.slug = 'pre_contrato'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Contrato assinado pelas duas partes');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 2, 'Matrícula do terreno anexada', 'checkbox', true, true
FROM kanban_fases f
WHERE f.kanban_id = '91686091-077d-479d-bbb3-cb062ded286e' AND f.slug = 'pre_contrato'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Matrícula do terreno anexada');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 3, 'ART/RRT registrada', 'checkbox', true, true
FROM kanban_fases f
WHERE f.kanban_id = '91686091-077d-479d-bbb3-cb062ded286e' AND f.slug = 'pre_contrato'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'ART/RRT registrada');

-- pre_aprovacao_projeto
INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 1, 'Alvará anexado no card', 'checkbox', true, true
FROM kanban_fases f
WHERE f.kanban_id = '91686091-077d-479d-bbb3-cb062ded286e' AND f.slug = 'pre_aprovacao_projeto'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Alvará anexado no card');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 2, 'Número do alvará registrado', 'checkbox', true, true
FROM kanban_fases f
WHERE f.kanban_id = '91686091-077d-479d-bbb3-cb062ded286e' AND f.slug = 'pre_aprovacao_projeto'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Número do alvará registrado');

-- pre_mobilizacao
INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 1, 'Placa de obra instalada', 'checkbox', true, true
FROM kanban_fases f
WHERE f.kanban_id = '91686091-077d-479d-bbb3-cb062ded286e' AND f.slug = 'pre_mobilizacao'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Placa de obra instalada');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 2, 'Cercamento instalado', 'checkbox', true, true
FROM kanban_fases f
WHERE f.kanban_id = '91686091-077d-479d-bbb3-cb062ded286e' AND f.slug = 'pre_mobilizacao'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Cercamento instalado');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 3, 'Ata de início assinada', 'checkbox', true, true
FROM kanban_fases f
WHERE f.kanban_id = '91686091-077d-479d-bbb3-cb062ded286e' AND f.slug = 'pre_mobilizacao'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Ata de início assinada');

-- obra_instalacoes
INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 1, 'Instalações fotodocumentadas (embutidas)', 'checkbox', true, true
FROM kanban_fases f
WHERE f.kanban_id = '8b25508c-afdc-4a44-84a8-36c4fcf8cb4b' AND f.slug = 'obra_instalacoes'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Instalações fotodocumentadas (embutidas)');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 2, 'Aprovação das concessionárias', 'checkbox', true, true
FROM kanban_fases f
WHERE f.kanban_id = '8b25508c-afdc-4a44-84a8-36c4fcf8cb4b' AND f.slug = 'obra_instalacoes'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Aprovação das concessionárias');

-- obra_vistoria
INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 1, 'Punch list preenchido', 'checkbox', true, true
FROM kanban_fases f
WHERE f.kanban_id = '8b25508c-afdc-4a44-84a8-36c4fcf8cb4b' AND f.slug = 'obra_vistoria'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Punch list preenchido');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 2, 'Cliente presente na vistoria', 'checkbox', true, true
FROM kanban_fases f
WHERE f.kanban_id = '8b25508c-afdc-4a44-84a8-36c4fcf8cb4b' AND f.slug = 'obra_vistoria'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Cliente presente na vistoria');

-- obra_entrega
INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 1, 'Habite-se emitido e anexado', 'checkbox', true, true
FROM kanban_fases f
WHERE f.kanban_id = '8b25508c-afdc-4a44-84a8-36c4fcf8cb4b' AND f.slug = 'obra_entrega'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Habite-se emitido e anexado');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 2, 'Manual do Proprietário entregue', 'checkbox', true, true
FROM kanban_fases f
WHERE f.kanban_id = '8b25508c-afdc-4a44-84a8-36c4fcf8cb4b' AND f.slug = 'obra_entrega'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Manual do Proprietário entregue');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 3, 'Ata de Entrega assinada', 'checkbox', true, true
FROM kanban_fases f
WHERE f.kanban_id = '8b25508c-afdc-4a44-84a8-36c4fcf8cb4b' AND f.slug = 'obra_entrega'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Ata de Entrega assinada');

NOTIFY pgrst, 'reload schema';