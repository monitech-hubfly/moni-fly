-- 428: adiciona responsaveis_ids à view v_atividades_unificadas.
--
-- Contexto: o filtro "Meus" no relatório Sirene comparava só responsavel_id
-- (campo único). Atividades onde o usuário está em responsaveis_ids[] mas não é
-- responsavel_id principal ficavam invisíveis no filtro.
--
-- Mesmo padrão da 425: DROP + CREATE (evita conflito de ordem de colunas) + GRANTs.

DROP VIEW IF EXISTS public.v_atividades_unificadas;
CREATE VIEW public.v_atividades_unificadas AS
SELECT a.id,
   a.card_id,
   a.numero AS chamado_numero,
   COALESCE(kc.titulo, vmap.titulo,
       CASE a.origem
           WHEN 'sirene'::text THEN '(chamado direto)'::text
           WHEN 'externo'::text THEN '(externo)'::text
           ELSE '(sem título)'::text
       END) AS card_titulo,
   COALESCE(kf.nome, ''::text) AS fase_nome,
   COALESCE(k.nome, k_sirene.nome,
       CASE a.origem
           WHEN 'sirene'::text THEN 'Sirene'::text
           WHEN 'externo'::text THEN 'Externo'::text
           ELSE ''::text
       END) AS kanban_nome,
   COALESCE(kc.kanban_id, vmap.kanban_id, kc_sirene.kanban_id) AS kanban_id,
   a.responsavel_id,
   a.responsaveis_ids,
   COALESCE(rsp.full_name, rsp.email) AS responsavel_nome,
   a.tipo,
   a.categoria,
   a.time_abertura_nome,
   COALESCE(NULLIF(TRIM(BOTH FROM a.titulo), ''::text), NULLIF(TRIM(BOTH FROM a.descricao), ''::text), '(sem título)'::text) AS titulo,
   a.descricao,
   a.status AS atividade_status,
   a.data_vencimento,
   a."time" AS time_nome,
   a.times_ids,
   ARRAY( SELECT t.nome
          FROM kanban_times t
         WHERE t.id = ANY (a.times_ids)
         ORDER BY t.nome) AS times_nomes,
   COALESCE(fp_card.full_name, fp_card.email, fp_leg.full_name, fp_leg.email) AS franqueado_nome,
   a.created_at AS criado_em,
       CASE
           WHEN a.data_vencimento IS NULL THEN NULL::text
           WHEN a.data_vencimento < CURRENT_DATE THEN 'atrasado'::text
           WHEN a.data_vencimento = CURRENT_DATE THEN 'vence_hoje'::text
           ELSE 'ok'::text
       END AS sla_status,
   a.origem
  FROM kanban_atividades a
    LEFT JOIN kanban_cards kc ON kc.id = a.card_id AND a.origem = 'nativo'::text
    LEFT JOIN v_processo_como_kanban_cards vmap ON vmap.id = a.card_id AND a.origem = 'legado'::text
    LEFT JOIN kanban_cards kc_sirene ON kc_sirene.id = a.card_id AND a.origem = 'sirene'::text
    LEFT JOIN kanbans k_sirene ON k_sirene.id = kc_sirene.kanban_id
    LEFT JOIN kanban_fases kf ON kf.id = COALESCE(kc.fase_id, vmap.fase_id)
    LEFT JOIN kanbans k ON k.id = COALESCE(kc.kanban_id, vmap.kanban_id)
    LEFT JOIN profiles rsp ON rsp.id = a.responsavel_id
    LEFT JOIN profiles fp_card ON fp_card.id = kc.franqueado_id
    LEFT JOIN profiles fp_leg ON fp_leg.id = vmap.responsavel_id
 WHERE a.origem = 'nativo'::text AND kc.id IS NOT NULL
    OR a.origem = 'legado'::text AND vmap.id IS NOT NULL
    OR a.origem = 'sirene'::text
    OR a.origem = 'externo'::text;

GRANT SELECT ON public.v_atividades_unificadas TO authenticated, anon, service_role;
NOTIFY pgrst, 'reload schema';
