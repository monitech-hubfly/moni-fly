-- ========================================
-- QUERIES RÁPIDAS - CARDS DO FUNIL STEP ONE
-- Copie e cole diretamente no Supabase SQL Editor
-- ========================================

-- 🎯 VERIFICAÇÕES RÁPIDAS
-- ========================================

-- 1️⃣ Ver TODOS os cards ativos com status SLA
SELECT 
  CONCAT('FK', LPAD(CAST(ROW_NUMBER() OVER (ORDER BY kc.created_at) AS TEXT), 4, '0')) as id_display,
  kc.titulo,
  kf.nome as fase,
  kc.created_at::date as criado,
  CURRENT_DATE - kc.created_at::date as dias,
  CASE 
    WHEN CURRENT_DATE - kc.created_at::date > 7 THEN '🔴 ATRASADO'
    WHEN CURRENT_DATE - kc.created_at::date >= 5 THEN '🟡 ATENÇÃO'
    ELSE '✅ OK'
  END as status
FROM public.kanban_cards kc
JOIN public.kanban_fases kf ON kc.fase_id = kf.id
JOIN public.kanbans k ON kc.kanban_id = k.id
WHERE k.nome = 'Funil Step One' AND kc.status = 'ativo'
ORDER BY kc.created_at DESC;

-- ========================================

-- 2️⃣ Contar cards por status
SELECT 
  CASE 
    WHEN CURRENT_DATE - kc.created_at::date > 7 THEN '🔴 ATRASADO'
    WHEN CURRENT_DATE - kc.created_at::date >= 5 THEN '🟡 ATENÇÃO'
    ELSE '✅ OK'
  END as status,
  COUNT(*) as total,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) || '%' as percentual
FROM public.kanban_cards kc
JOIN public.kanbans k ON kc.kanban_id = k.id
WHERE k.nome = 'Funil Step One' AND kc.status = 'ativo'
GROUP BY 1
ORDER BY 1;

-- ========================================

-- 3️⃣ Cards por fase
SELECT 
  kf.ordem,
  kf.nome as fase,
  COUNT(*) as total_cards,
  COUNT(*) FILTER (WHERE CURRENT_DATE - kc.created_at::date > 7) as atrasados,
  COUNT(*) FILTER (WHERE CURRENT_DATE - kc.created_at::date BETWEEN 5 AND 7) as atencao,
  COUNT(*) FILTER (WHERE CURRENT_DATE - kc.created_at::date < 5) as ok
FROM public.kanban_cards kc
JOIN public.kanban_fases kf ON kc.fase_id = kf.id
JOIN public.kanbans k ON kc.kanban_id = k.id
WHERE k.nome = 'Funil Step One' AND kc.status = 'ativo'
GROUP BY kf.ordem, kf.nome
ORDER BY kf.ordem;

-- ========================================

-- 4️⃣ Ver APENAS os atrasados
SELECT 
  kc.titulo,
  kf.nome as fase,
  kc.created_at::date as criado,
  CURRENT_DATE - kc.created_at::date as dias_atrasado,
  p.full_name as responsavel
FROM public.kanban_cards kc
JOIN public.kanban_fases kf ON kc.fase_id = kf.id
JOIN public.kanbans k ON kc.kanban_id = k.id
LEFT JOIN public.profiles p ON kc.franqueado_id = p.id
WHERE k.nome = 'Funil Step One' 
  AND kc.status = 'ativo'
  AND CURRENT_DATE - kc.created_at::date > 7
ORDER BY (CURRENT_DATE - kc.created_at::date) DESC;

-- ========================================

-- 5️⃣ Ver cards que vencem HOJE ou AMANHÃ
SELECT 
  kc.titulo,
  kf.nome as fase,
  kc.created_at::date as criado,
  CASE 
    WHEN CURRENT_DATE - kc.created_at::date = 5 THEN '⚠️ VENCE HOJE'
    WHEN CURRENT_DATE - kc.created_at::date = 4 THEN '⚠️ VENCE AMANHÃ'
  END as alerta,
  p.full_name as responsavel
FROM public.kanban_cards kc
JOIN public.kanban_fases kf ON kc.fase_id = kf.id
JOIN public.kanbans k ON kc.kanban_id = k.id
LEFT JOIN public.profiles p ON kc.franqueado_id = p.id
WHERE k.nome = 'Funil Step One' 
  AND kc.status = 'ativo'
  AND CURRENT_DATE - kc.created_at::date BETWEEN 4 AND 5
ORDER BY kc.created_at;

-- ========================================
-- 🛠️ MANUTENÇÃO RÁPIDA
-- ========================================

-- 6️⃣ Limpar TODOS os cards de exemplo
-- ⚠️ CUIDADO: Remove permanentemente!
/*
DELETE FROM public.kanban_cards 
WHERE titulo LIKE 'João Silva%' 
   OR titulo LIKE 'Maria Santos%'
   OR titulo LIKE 'Pedro Costa%'
   OR titulo LIKE 'Ana Oliveira%'
   OR titulo LIKE 'Carlos Mendes%'
   OR titulo LIKE 'Fernanda Lima%'
   OR titulo LIKE 'Roberto Alves%'
   OR titulo LIKE 'Juliana Ferreira%';
*/

-- ========================================

-- 7️⃣ Arquivar cards antigos (>30 dias)
-- ⚠️ CUIDADO: Muda status para 'arquivado'!
/*
UPDATE public.kanban_cards kc
SET status = 'arquivado'
FROM public.kanbans k
WHERE kc.kanban_id = k.id
  AND k.nome = 'Funil Step One'
  AND kc.status = 'ativo'
  AND CURRENT_DATE - kc.created_at::date > 30;
*/

-- ========================================

-- 8️⃣ "Renovar" cards (resetar datas para hoje)
-- Útil para testes: faz todos os cards parecerem recém-criados
/*
UPDATE public.kanban_cards kc
SET created_at = CURRENT_DATE
FROM public.kanbans k
WHERE kc.kanban_id = k.id
  AND k.nome = 'Funil Step One'
  AND kc.status = 'ativo';
*/

-- ========================================
-- 🔍 DIAGNÓSTICO
-- ========================================

-- 9️⃣ Ver configuração das fases
SELECT 
  kf.ordem,
  kf.nome,
  kf.sla_dias as sla_dias_uteis,
  kf.ativo,
  COUNT(kc.id) as total_cards
FROM public.kanban_fases kf
LEFT JOIN public.kanban_cards kc ON kf.id = kc.fase_id AND kc.status = 'ativo'
JOIN public.kanbans k ON kf.kanban_id = k.id
WHERE k.nome = 'Funil Step One'
GROUP BY kf.id, kf.ordem, kf.nome, kf.sla_dias, kf.ativo
ORDER BY kf.ordem;

-- ========================================

-- 🔟 Ver feriados próximos
SELECT 
  data,
  nome,
  CASE WHEN fixo THEN '📌 Fixo' ELSE '📅 Móvel' END as tipo,
  data - CURRENT_DATE as dias_ate
FROM public.feriados_nacionais
WHERE data >= CURRENT_DATE
ORDER BY data
LIMIT 10;

-- ========================================

-- 1️⃣1️⃣ Testar função de dias úteis
SELECT 
  '2026-04-01'::DATE as data_inicio,
  CURRENT_DATE as data_fim,
  public.calcular_dias_uteis('2026-04-01'::DATE, CURRENT_DATE) as dias_uteis,
  CURRENT_DATE - '2026-04-01'::DATE as dias_corridos;

-- ========================================

-- 1️⃣2️⃣ Ver todos os usuários (franqueados)
SELECT 
  p.id,
  p.full_name,
  p.role,
  COUNT(kc.id) as total_cards
FROM public.profiles p
LEFT JOIN public.kanban_cards kc ON p.id = kc.franqueado_id AND kc.status = 'ativo'
GROUP BY p.id, p.full_name, p.role
ORDER BY p.full_name;

-- ========================================
-- 📊 RELATÓRIOS
-- ========================================

-- 1️⃣3️⃣ Dashboard completo
WITH cards_stats AS (
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE CURRENT_DATE - created_at::date > 7) as atrasados,
    COUNT(*) FILTER (WHERE CURRENT_DATE - created_at::date BETWEEN 5 AND 7) as atencao,
    COUNT(*) FILTER (WHERE CURRENT_DATE - created_at::date < 5) as ok,
    AVG(CURRENT_DATE - created_at::date) as media_dias
  FROM public.kanban_cards kc
  JOIN public.kanbans k ON kc.kanban_id = k.id
  WHERE k.nome = 'Funil Step One' AND kc.status = 'ativo'
)
SELECT 
  '📊 DASHBOARD FUNIL STEP ONE' as secao,
  total as "Total de Cards",
  atrasados as "🔴 Atrasados",
  atencao as "🟡 Atenção",
  ok as "✅ OK",
  ROUND(media_dias, 1) as "📅 Média de Dias"
FROM cards_stats;

-- ========================================

-- 1️⃣4️⃣ Evolução nos últimos 7 dias
SELECT 
  kc.created_at::date as data,
  COUNT(*) as cards_criados,
  SUM(COUNT(*)) OVER (ORDER BY kc.created_at::date) as total_acumulado
FROM public.kanban_cards kc
JOIN public.kanbans k ON kc.kanban_id = k.id
WHERE k.nome = 'Funil Step One' 
  AND kc.created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY kc.created_at::date
ORDER BY kc.created_at::date DESC;

-- ========================================

-- 1️⃣5️⃣ Cards por responsável
SELECT 
  COALESCE(p.full_name, 'Sem responsável') as responsavel,
  COUNT(*) as total_cards,
  COUNT(*) FILTER (WHERE CURRENT_DATE - kc.created_at::date > 7) as atrasados,
  COUNT(*) FILTER (WHERE CURRENT_DATE - kc.created_at::date BETWEEN 5 AND 7) as atencao,
  ROUND(AVG(CURRENT_DATE - kc.created_at::date), 1) as media_dias
FROM public.kanban_cards kc
JOIN public.kanbans k ON kc.kanban_id = k.id
LEFT JOIN public.profiles p ON kc.franqueado_id = p.id
WHERE k.nome = 'Funil Step One' AND kc.status = 'ativo'
GROUP BY p.full_name
ORDER BY atrasados DESC, total_cards DESC;

-- ========================================
-- 💡 DICAS DE USO
-- ========================================

/*
QUERIES MAIS USADAS NO DIA A DIA:

1. Ver todos os cards → Query #1
2. Contar por status → Query #2
3. Ver atrasados → Query #4
4. Ver alertas (vence hoje/amanhã) → Query #5
5. Dashboard completo → Query #13

QUERIES PARA MANUTENÇÃO:

6. Limpar exemplos → Query #6 (descomente)
7. Arquivar antigos → Query #7 (descomente)
8. Resetar datas → Query #8 (descomente)

QUERIES PARA DIAGNÓSTICO:

9. Ver configuração → Query #9
10. Ver feriados → Query #10
11. Testar dias úteis → Query #11
12. Ver usuários → Query #12

RELATÓRIOS:

13. Dashboard → Query #13
14. Evolução → Query #14
15. Por responsável → Query #15

⚠️ ATENÇÃO:
- Queries comentadas (/* */) modificam dados!
- Sempre faça backup antes de executar DELETE ou UPDATE
- Teste em desenvolvimento primeiro
*/
