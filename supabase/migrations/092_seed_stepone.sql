-- ─── 092: Seed do Funil Step One ────────────────────────────────────────────
-- Idempotente via WHERE NOT EXISTS (não requer ALTER TABLE / UNIQUE constraint).
-- Seguro para rodar quantas vezes quiser.

-- ─── 1. Kanban ───────────────────────────────────────────────────────────────
INSERT INTO public.kanbans (nome, ordem, ativo)
SELECT 'Funil Step One', 1, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanbans WHERE nome = 'Funil Step One'
);

-- ─── 2. Fases ────────────────────────────────────────────────────────────────
INSERT INTO public.kanban_fases (kanban_id, nome, ordem, sla_dias, ativo)
SELECT
  k.id,
  fase.nome,
  fase.ordem,
  fase.sla_dias,
  true
FROM public.kanbans k
CROSS JOIN (
  VALUES
    ('Dados da Cidade',        1,  7),
    ('Lista de Condomínios',   2,  7),
    ('Dados dos Condomínios',  3, 10),
    ('Lotes disponíveis',      4,  7),
    ('Mapa de Competidores',   5,  7),
    ('BCA + Batalha de Casas', 6, 14),
    ('Hipóteses',              7,  7)
) AS fase(nome, ordem, sla_dias)
WHERE k.nome = 'Funil Step One'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fases kf
    WHERE kf.kanban_id = k.id
      AND kf.nome = fase.nome
  );

-- ─── 3. Verificação (retorna o que foi inserido) ─────────────────────────────
SELECT
  k.id         AS kanban_id,
  k.nome       AS kanban_nome,
  k.ativo      AS kanban_ativo,
  kf.nome      AS fase_nome,
  kf.ordem     AS fase_ordem,
  kf.sla_dias  AS sla_dias
FROM public.kanbans k
JOIN public.kanban_fases kf ON kf.kanban_id = k.id
WHERE k.nome = 'Funil Step One'
ORDER BY kf.ordem;
