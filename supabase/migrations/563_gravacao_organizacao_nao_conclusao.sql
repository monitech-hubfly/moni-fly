-- 563: Gravação — Organização (mkt_grav_decupagem) NÃO é fase de conclusão.
-- Idempotente.

UPDATE public.kanban_fases
SET fase_conversao = false, nome = 'Organização', ativo = true
WHERE kanban_id = 'e8a14c2b-7d53-4f91-a6c0-2b9e5d8f1a47'::uuid
  AND slug = 'mkt_grav_decupagem';

NOTIFY pgrst, 'reload schema';
