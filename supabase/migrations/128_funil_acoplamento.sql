-- Migration 128: Kanban "Funil Acoplamento" + 4 fases (idempotente).
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 1 — Registrar o kanban
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO public.kanbans (nome, descricao)
VALUES ('Funil Acoplamento', 'Gestão do processo de acoplamento de terreno e casa')
ON CONFLICT (nome) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 2 — Inserir as 4 fases
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo)
SELECT
  k.id,
  fase.nome,
  fase.slug,
  fase.ordem,
  7 AS sla_dias,
  true AS ativo
FROM public.kanbans k
CROSS JOIN (VALUES
  ('Modelagem do Terreno', 'modelagem_terreno', 1),
  ('Modelagem da Casa + GBox', 'modelagem_casa_gbox', 2),
  ('Validação do Acoplamento', 'validacao_acoplamento', 3),
  ('Alterações do Acoplamento', 'alteracoes_acoplamento', 4)
) AS fase(nome, slug, ordem)
WHERE k.nome = 'Funil Acoplamento'
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 3 — Garantir GRANTs
-- ═══════════════════════════════════════════════════════════════════════════
GRANT SELECT ON public.kanbans TO authenticated, anon;
GRANT SELECT ON public.kanban_fases TO authenticated, anon;
