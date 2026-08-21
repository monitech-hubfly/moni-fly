-- Reparo idempotente: alinha kanban_cards.fase_id do Funil Portfólio com processo_step_one.etapa_painel.
-- Rodar no SQL Editor do Supabase (PROD). Seguro reexecutar: só atualiza linhas divergentes.
--
-- UUID canônico PROD: c57120a0-991c-422b-8def-4d16a9411d45 (Funil Portfólio)

-- ─── Diagnóstico: quantos cards divergem por slug de etapa ─────────────────
SELECT
  p.etapa_painel,
  COUNT(*) AS qtd_divergentes
FROM public.kanban_cards kc
JOIN public.processo_step_one p ON p.id = kc.id
JOIN public.kanban_fases kf ON kf.kanban_id = kc.kanban_id AND kf.slug = p.etapa_painel
WHERE kc.kanban_id = 'c57120a0-991c-422b-8def-4d16a9411d45'::uuid
  AND kc.fase_id IS DISTINCT FROM kf.id
  AND p.etapa_painel IS NOT NULL
  AND TRIM(p.etapa_painel) <> ''
  AND p.cancelado_em IS NULL
  AND p.removido_em IS NULL
GROUP BY p.etapa_painel
ORDER BY qtd_divergentes DESC;

-- ─── Diagnóstico: etapa_painel sem fase correspondente no Portfólio ───────
SELECT
  p.id AS processo_id,
  p.etapa_painel,
  kc.fase_id AS fase_id_atual
FROM public.kanban_cards kc
JOIN public.processo_step_one p ON p.id = kc.id
WHERE kc.kanban_id = 'c57120a0-991c-422b-8def-4d16a9411d45'::uuid
  AND p.cancelado_em IS NULL
  AND p.removido_em IS NULL
  AND p.etapa_painel IS NOT NULL
  AND TRIM(p.etapa_painel) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases kf
    WHERE kf.kanban_id = kc.kanban_id
      AND kf.slug = p.etapa_painel
  )
ORDER BY p.etapa_painel, p.id
LIMIT 200;

-- ─── Reparo ───────────────────────────────────────────────────────────────
UPDATE public.kanban_cards kc
SET
  fase_id = kf.id,
  updated_at = NOW()
FROM public.processo_step_one p
JOIN public.kanban_fases kf
  ON kf.kanban_id = kc.kanban_id
 AND kf.slug = p.etapa_painel
WHERE kc.id = p.id
  AND kc.kanban_id = 'c57120a0-991c-422b-8def-4d16a9411d45'::uuid
  AND kc.fase_id IS DISTINCT FROM kf.id
  AND p.etapa_painel IS NOT NULL
  AND TRIM(p.etapa_painel) <> ''
  AND p.cancelado_em IS NULL
  AND p.removido_em IS NULL;

-- ─── Pós-reparo: cards ativos ainda com fase_id fora do kanban Portfólio ───
SELECT
  kc.id,
  kc.titulo,
  kc.status,
  kc.fase_id,
  kf_out.slug AS slug_fase_atual,
  p.etapa_painel
FROM public.kanban_cards kc
LEFT JOIN public.kanban_fases kf_out ON kf_out.id = kc.fase_id
LEFT JOIN public.processo_step_one p ON p.id = kc.id
WHERE kc.kanban_id = 'c57120a0-991c-422b-8def-4d16a9411d45'::uuid
  AND kc.status = 'ativo'
  AND COALESCE(kc.arquivado, false) = false
  AND COALESCE(kc.concluido, false) = false
  AND (
    kf_out.id IS NULL
    OR kf_out.kanban_id IS DISTINCT FROM kc.kanban_id
  )
ORDER BY p.etapa_painel NULLS LAST, kc.created_at DESC
LIMIT 100;
