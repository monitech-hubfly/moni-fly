-- View: painel de saúde do Funil Portfólio (flags de bastão + datas de fases-chave)
-- Datas via kanban_historico (card_criado + mudanças de fase)

CREATE OR REPLACE VIEW public.v_portfolio_saude AS
SELECT
  kc.id AS card_id,
  kc.titulo,
  kc.rede_franqueado_id,
  rf.nome_completo AS franqueado_nome,
  rf.n_franquia,
  kf.slug AS fase_slug,
  kf.nome AS fase_nome,
  kf.ordem AS fase_ordem,
  kc.acoplamento_concluido,
  kc.credito_terreno_ok,
  kc.contabilidade_ok,
  kc.juridico_ok,
  kc.capital_ok,
  kc.credito_obra_ok,
  kc.created_at,
  kc.updated_at,
  (
    SELECT min(kh.criado_em)
    FROM public.kanban_historico kh
    JOIN public.kanban_fases kf2 ON kf2.id = COALESCE(
      (kh.detalhe->>'fase_nova_id')::uuid,
      (kh.detalhe->>'fase_id')::uuid
    )
    WHERE kh.card_id = kc.id
      AND kh.acao IN ('fase_avancada', 'fase_retrocedida', 'card_criado')
      AND kf2.slug = 'step_3'
  ) AS data_step3_opcao,
  (
    SELECT min(kh.criado_em)
    FROM public.kanban_historico kh
    JOIN public.kanban_fases kf2 ON kf2.id = COALESCE(
      (kh.detalhe->>'fase_nova_id')::uuid,
      (kh.detalhe->>'fase_id')::uuid
    )
    WHERE kh.card_id = kc.id
      AND kh.acao IN ('fase_avancada', 'fase_retrocedida', 'card_criado')
      AND kf2.slug = 'step_5'
  ) AS data_step5_comite,
  (
    SELECT min(kh.criado_em)
    FROM public.kanban_historico kh
    JOIN public.kanban_fases kf2 ON kf2.id = COALESCE(
      (kh.detalhe->>'fase_nova_id')::uuid,
      (kh.detalhe->>'fase_id')::uuid
    )
    WHERE kh.card_id = kc.id
      AND kh.acao IN ('fase_avancada', 'fase_retrocedida', 'card_criado')
      AND kf2.slug = 'step_7'
  ) AS data_step7_contrato,
  (
    kf.slug = 'captacao_moni_capital'
    OR kf.ordem >= COALESCE(
      (
        SELECT min(kf_cap.ordem)
        FROM public.kanban_fases kf_cap
        WHERE kf_cap.kanban_id = k.id
          AND kf_cap.slug = 'captacao_moni_capital'
      ),
      999999
    )
  ) AS capital_aplicavel
FROM public.kanban_cards kc
JOIN public.kanbans k ON k.id = kc.kanban_id
JOIN public.kanban_fases kf ON kf.id = kc.fase_id
LEFT JOIN public.rede_franqueados rf ON rf.id = kc.rede_franqueado_id
WHERE k.nome = 'Funil Portfólio'
  AND kc.arquivado = false
  AND kc.concluido = false;

COMMENT ON VIEW public.v_portfolio_saude IS
  'Cards ativos do Funil Portfólio com flags de esteiras paralelas e datas de entrada em step_3/5/7.';

GRANT SELECT ON public.v_portfolio_saude TO service_role;
GRANT SELECT ON public.v_portfolio_saude TO authenticated;
