-- 549: Instruções + checklist do Funil Corretores.
-- Idempotente. UUID: 1e23c356-9993-4f8e-9d09-e17995e8a5c6

-- ============================================================================
-- Instruções
-- ============================================================================

UPDATE public.kanban_fases
SET instrucoes = '<p>Lead recebido via formulário do corretor — verificar se os dados estão completos.</p><ul><li>Confirmar nome, telefone e empreendimento de interesse.</li><li>Entrar em contato com o corretor para alinhar abordagem com o cliente.</li><li>Avançar para Primeiro Contato assim que os dados estiverem validados.</li><li>SLA: 1 dia útil para o primeiro contato interno.</li></ul>'
WHERE kanban_id = '1e23c356-9993-4f8e-9d09-e17995e8a5c6'
  AND slug = 'cor_oportunidade';

UPDATE public.kanban_fases
SET instrucoes = '<p>Contatar o cliente via WhatsApp ou ligação.</p><ul><li>Apresentar brevemente a Moní e o empreendimento de interesse.</li><li>Identificar perfil: urgência, orçamento real, quem decide a compra.</li><li>Registrar o resultado do contato no histórico do card.</li><li>Se cliente sem interesse: mover para Perdido com motivo.</li><li>Se interesse confirmado: avançar para Agendamento de Visita.</li></ul>'
WHERE kanban_id = '1e23c356-9993-4f8e-9d09-e17995e8a5c6'
  AND slug = 'cor_primeiro_contato';

UPDATE public.kanban_fases
SET instrucoes = '<p>Propor ao menos 2 opções de data e horário para a visita.</p><ul><li>Confirmar com o cliente e com o corretor (se acompanhará).</li><li>Registrar data, horário e endereço do encontro no card.</li><li>Enviar lembrete ao cliente 1 dia antes via WhatsApp.</li><li>Se não confirmar em 2 dias úteis: fazer follow-up e registrar tentativa.</li></ul>'
WHERE kanban_id = '1e23c356-9993-4f8e-9d09-e17995e8a5c6'
  AND slug = 'cor_agendamento';

UPDATE public.kanban_fases
SET instrucoes = '<p>Registrar feedback do cliente logo após a visita (quente).</p><ul><li>Identificar objeções e próximos passos combinados na visita.</li><li>Se muito interessado: avançar para Proposta Enviada imediatamente.</li><li>Se neutro/pouco interessado: nutrir com mais informações e agendar follow-up.</li><li>Se desistiu: mover para Perdido.</li></ul>'
WHERE kanban_id = '1e23c356-9993-4f8e-9d09-e17995e8a5c6'
  AND slug = 'cor_visita_realizada';

UPDATE public.kanban_fases
SET instrucoes = '<p>Elaborar proposta comercial com valor, condições e prazo.</p><ul><li>Enviar via WhatsApp ou e-mail e confirmar recebimento.</li><li>Registrar validade da proposta no card.</li><li>Fazer follow-up após 2 dias úteis sem resposta.</li><li>Se aprovada: avançar para Forecast.</li><li>Se rejeitada por preço/condições: renegociar ou mover para Perdido.</li></ul>'
WHERE kanban_id = '1e23c356-9993-4f8e-9d09-e17995e8a5c6'
  AND slug = 'cor_proposta_enviada';

UPDATE public.kanban_fases
SET instrucoes = '<p>Lead com alta probabilidade de fechar — manter contato próximo.</p><ul><li>Registrar probabilidade estimada de fechamento (25% / 50% / 75% / 90%).</li><li>Registrar data prevista de fechamento.</li><li>Acompanhar diariamente até a decisão final.</li><li>Se fechar: mover para Convertido.</li><li>Se desistir: mover para Perdido com motivo.</li></ul>'
WHERE kanban_id = '1e23c356-9993-4f8e-9d09-e17995e8a5c6'
  AND slug = 'cor_forecast';

UPDATE public.kanban_fases
SET instrucoes = '<p>Parabéns — lead convertido em cliente Moní!</p><ul><li>Registrar data de conversão e valor final do negócio.</li><li>Comunicar ao corretor sobre a conversão.</li><li>O card será arquivado automaticamente como Convertido.</li><li>Futuramente: um card no Funil Pré Obra será aberto automaticamente.</li></ul>'
WHERE kanban_id = '1e23c356-9993-4f8e-9d09-e17995e8a5c6'
  AND slug = 'cor_convertido';

UPDATE public.kanban_fases
SET instrucoes = '<p>Registrar o motivo da perda (obrigatório antes de avançar).</p><ul><li>Agradecer ao lead pela atenção e manter relacionamento.</li><li>Comunicar ao corretor sobre o resultado.</li><li>O card será arquivado automaticamente com o motivo informado.</li><li>Análise semanal dos motivos de perda — compartilhar com time comercial.</li></ul>'
WHERE kanban_id = '1e23c356-9993-4f8e-9d09-e17995e8a5c6'
  AND slug = 'cor_perdido';

-- ============================================================================
-- Checklist seed
-- ============================================================================

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 1, 'Dados do cliente validados (nome + telefone)', 'checkbox', true, false
FROM kanban_fases f
WHERE f.kanban_id = '1e23c356-9993-4f8e-9d09-e17995e8a5c6' AND f.slug = 'cor_oportunidade'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Dados do cliente validados (nome + telefone)');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 2, 'Corretor identificado e vinculado ao card', 'checkbox', true, false
FROM kanban_fases f
WHERE f.kanban_id = '1e23c356-9993-4f8e-9d09-e17995e8a5c6' AND f.slug = 'cor_oportunidade'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Corretor identificado e vinculado ao card');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 1, 'Data e horário da visita confirmados com o cliente', 'checkbox', true, false
FROM kanban_fases f
WHERE f.kanban_id = '1e23c356-9993-4f8e-9d09-e17995e8a5c6' AND f.slug = 'cor_agendamento'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Data e horário da visita confirmados com o cliente');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 2, 'Lembrete enviado ao cliente 1 dia antes', 'checkbox', false, false
FROM kanban_fases f
WHERE f.kanban_id = '1e23c356-9993-4f8e-9d09-e17995e8a5c6' AND f.slug = 'cor_agendamento'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Lembrete enviado ao cliente 1 dia antes');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 1, 'Feedback do cliente registrado no card', 'checkbox', true, false
FROM kanban_fases f
WHERE f.kanban_id = '1e23c356-9993-4f8e-9d09-e17995e8a5c6' AND f.slug = 'cor_visita_realizada'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Feedback do cliente registrado no card');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 1, 'Proposta enviada e confirmada pelo cliente', 'checkbox', true, false
FROM kanban_fases f
WHERE f.kanban_id = '1e23c356-9993-4f8e-9d09-e17995e8a5c6' AND f.slug = 'cor_proposta_enviada'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Proposta enviada e confirmada pelo cliente');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 2, 'Validade da proposta registrada', 'checkbox', true, false
FROM kanban_fases f
WHERE f.kanban_id = '1e23c356-9993-4f8e-9d09-e17995e8a5c6' AND f.slug = 'cor_proposta_enviada'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Validade da proposta registrada');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 1, 'Corretor comunicado sobre a conversão', 'checkbox', true, false
FROM kanban_fases f
WHERE f.kanban_id = '1e23c356-9993-4f8e-9d09-e17995e8a5c6' AND f.slug = 'cor_convertido'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Corretor comunicado sobre a conversão');

INSERT INTO kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
SELECT f.id, 1, 'Motivo da perda registrado', 'checkbox', true, false
FROM kanban_fases f
WHERE f.kanban_id = '1e23c356-9993-4f8e-9d09-e17995e8a5c6' AND f.slug = 'cor_perdido'
AND NOT EXISTS (SELECT 1 FROM kanban_fase_checklist_itens i WHERE i.fase_id = f.id AND i.label = 'Motivo da perda registrado');

NOTIFY pgrst, 'reload schema';
