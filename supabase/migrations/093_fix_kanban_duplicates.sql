-- ─── 093: Remove duplicatas do kanban "Funil Step One" ──────────────────────
-- Diagnóstico: mostra quantas linhas existem antes de limpar.

-- 1. Ver o que existe
SELECT id, nome, ordem, ativo, ctid
FROM public.kanbans
WHERE nome = 'Funil Step One'
ORDER BY ctid;

-- 2. Manter apenas o registro mais antigo (menor ctid) e deletar os extras
DELETE FROM public.kanbans
WHERE nome = 'Funil Step One'
  AND ctid NOT IN (
    SELECT min(ctid)
    FROM public.kanbans
    WHERE nome = 'Funil Step One'
  );

-- 3. Confirma: deve restar exatamente 1 linha
SELECT id, nome, ativo FROM public.kanbans WHERE nome = 'Funil Step One';

-- 4. Confirma as 7 fases vinculadas
SELECT kf.nome, kf.ordem, kf.sla_dias
FROM public.kanban_fases kf
JOIN public.kanbans k ON k.id = kf.kanban_id
WHERE k.nome = 'Funil Step One'
ORDER BY kf.ordem;
