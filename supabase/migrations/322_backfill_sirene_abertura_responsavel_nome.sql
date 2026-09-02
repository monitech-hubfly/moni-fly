-- Backfill abertura_responsavel_nome from criado_por profile
UPDATE sirene_chamados sc
SET abertura_responsavel_nome = p.full_name
FROM kanban_atividades ka
JOIN profiles p ON p.id = ka.criado_por
WHERE ka.sirene_chamado_id = sc.id
AND sc.abertura_responsavel_nome IS NULL
AND p.full_name IS NOT NULL;
