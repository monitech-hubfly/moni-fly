-- Remove todas as "atividades" dos cards do painel:
-- - Itens de checklist (processo_card_checklist) e pareceres ligados (CASCADE)
-- - Tópicos/tarefas por etapa (processo_etapa_topicos) e anexos (CASCADE)
-- - Histórico de eventos do card (processo_card_eventos)
--
-- NÃO remove: comentários (processo_card_comentarios), documentos (processo_card_documentos),
-- checklist legal (processo_card_checklist_legal), dados do processo.

BEGIN;

DELETE FROM public.processo_etapa_topicos;
-- anexos em processo_etapa_topicos_anexos são removidos em CASCADE

DELETE FROM public.processo_card_checklist;
-- processo_card_checklist_pareceres removidos em CASCADE

DELETE FROM public.processo_card_eventos;

COMMIT;
