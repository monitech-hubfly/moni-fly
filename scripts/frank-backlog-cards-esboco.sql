-- Esboço: cards ativos no backlog de um Frank (profile frank/franqueado).
-- Parâmetro: substituir :frank_user_id pelo UUID do profile.
--
-- Regras espelham responsavel-fase-checklist.ts (versão SQL simplificada):
--   • Step One: rede_franqueado_id → profiles.rede_franqueado_id OU processo_step_one.user_id
--   • Demais funis: checklist responsavel_* OU ownership (franqueado_id)
--   • Exclui staff gravado no checklist e valor = criador do card
--
-- Limitação conhecida: match por email_frank / nome_completo da rede fica na camada TS.

\set frank_user_id '00000000-0000-0000-0000-000000000000'

WITH params AS (
  SELECT :'frank_user_id'::uuid AS frank_uid
),
staff_roles AS (
  SELECT unnest(ARRAY['admin', 'team', 'consultor', 'supervisor']) AS role
),
frank_roles AS (
  SELECT unnest(ARRAY['frank', 'franqueado']) AS role
),
cards_ativos AS (
  SELECT
    kc.*,
    k.nome AS kanban_nome,
    kf.nome AS fase_nome,
    kf.ordem AS fase_ordem
  FROM public.kanban_cards kc
  JOIN public.kanbans k ON k.id = kc.kanban_id
  JOIN public.kanban_fases kf ON kf.id = kc.fase_id
  WHERE kc.arquivado IS NOT TRUE
    AND kc.concluido IS NOT TRUE
),
-- Step One: resolução em 2 níveis (rede → processo)
stepone_responsavel AS (
  SELECT
    ca.id AS card_id,
    COALESCE(pf_rede.id, pf_proc.id) AS responsavel_profile_id,
    CASE
      WHEN pf_rede.id IS NOT NULL THEN 'rede_franqueado_id'
      WHEN pf_proc.id IS NOT NULL THEN 'processo_step_one.user_id'
    END AS fonte_responsavel
  FROM cards_ativos ca
  LEFT JOIN public.processo_step_one ps
    ON ps.id = COALESCE(ca.processo_step_one_id, ca.id)
  LEFT JOIN LATERAL (
    SELECT p.id
    FROM public.profiles p
    WHERE ca.rede_franqueado_id IS NOT NULL
      AND p.rede_franqueado_id = ca.rede_franqueado_id
      AND p.role IN (SELECT role FROM frank_roles)
    ORDER BY (p.role = 'frank') DESC, p.created_at NULLS LAST
    LIMIT 1
  ) pf_rede ON TRUE
  LEFT JOIN LATERAL (
    SELECT p.id
    FROM public.profiles p
    WHERE ps.user_id IS NOT NULL
      AND p.id = ps.user_id
      AND p.role IN (SELECT role FROM frank_roles)
    LIMIT 1
  ) pf_proc ON pf_rede.id IS NULL
  WHERE ca.kanban_id = '4d89f111-cef6-48aa-93ff-72d6406f0a32'
    AND COALESCE(pf_rede.id, pf_proc.id) IS NOT NULL
),
-- Demais funis: checklist responsavel_fase / responsavel_contato / responsavel_revisao
checklist_responsavel AS (
  SELECT DISTINCT
    ca.id AS card_id,
    r.valor::uuid AS responsavel_profile_id,
    i.campo_slug AS fonte_responsavel
  FROM cards_ativos ca
  JOIN public.kanban_fase_checklist_itens i
    ON i.fase_id = ca.fase_id
   AND i.campo_slug IN ('responsavel_fase', 'responsavel_contato', 'responsavel_revisao')
  JOIN public.kanban_fase_checklist_respostas r
    ON r.card_id = ca.id
   AND r.item_id = i.id
  WHERE ca.kanban_id <> '4d89f111-cef6-48aa-93ff-72d6406f0a32'
    AND r.valor ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND NOT EXISTS (
      SELECT 1
      FROM public.profiles p_staff
      JOIN staff_roles sr ON sr.role = p_staff.role
      WHERE p_staff.id = r.valor::uuid
    )
    AND r.valor::uuid IS DISTINCT FROM ca.franqueado_id
),
ownership AS (
  SELECT
    ca.id AS card_id,
    ca.franqueado_id AS responsavel_profile_id,
    'franqueado_id'::text AS fonte_responsavel
  FROM cards_ativos ca
  WHERE ca.franqueado_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN frank_roles fr ON fr.role = p.role
      WHERE p.id = ca.franqueado_id
    )
),
unificado AS (
  SELECT * FROM stepone_responsavel
  UNION ALL
  SELECT * FROM checklist_responsavel
  UNION ALL
  SELECT * FROM ownership
)
SELECT
  ca.id AS card_id,
  ca.titulo,
  ca.kanban_id,
  ca.kanban_nome,
  ca.fase_id,
  ca.fase_nome,
  ca.fase_ordem,
  ca.rede_franqueado_id,
  ca.condominio_id,
  ca.rede_loteador_id,
  u.responsavel_profile_id,
  u.fonte_responsavel,
  sc.id AS sirene_chamado_aberto_id,
  sc.status AS sirene_status
FROM cards_ativos ca
JOIN unificado u ON u.card_id = ca.id
CROSS JOIN params p
LEFT JOIN LATERAL (
  SELECT sc2.id, sc2.status
  FROM public.sirene_chamados sc2
  WHERE sc2.card_id = ca.id
    AND sc2.status <> 'concluido'
  ORDER BY sc2.created_at DESC
  LIMIT 1
) sc ON TRUE
WHERE u.responsavel_profile_id = p.frank_uid
ORDER BY ca.kanban_nome, ca.fase_ordem, ca.titulo;

-- ---------------------------------------------------------------------------
-- Enriquecimento Gantt (após migration 389): tarefa + card + condomínio + CNPJ
-- ---------------------------------------------------------------------------
/*
SELECT
  gp.id AS gantt_id,
  gp.titulo AS gantt_titulo,
  gp.sirene_chamado_id,
  sc.card_id,
  kc.titulo AS card_titulo,
  kc.condominio_id,
  c.nome AS condominio_nome,
  kc.rede_loteador_id,
  rl.nome AS loteador_nome,
  gp.portfolio_franqueado_id,
  rf.nome_completo AS franqueado_rede,
  gp.adm_cnpj_id,
  ac.cnpj,
  ac.descritivo AS cnpj_descritivo
FROM public.gantt_planejamento gp
LEFT JOIN public.sirene_chamados sc ON sc.id = gp.sirene_chamado_id
LEFT JOIN public.kanban_cards kc ON kc.id = sc.card_id
LEFT JOIN public.condominios c ON c.id = kc.condominio_id
LEFT JOIN public.rede_loteadores rl ON rl.id = kc.rede_loteador_id
LEFT JOIN public.rede_franqueados rf ON rf.id = gp.portfolio_franqueado_id
LEFT JOIN public.adm_cnpjs ac ON ac.id = gp.adm_cnpj_id
WHERE gp.sirene_chamado_id IS NOT NULL;
*/
