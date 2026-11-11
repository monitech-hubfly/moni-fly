-- Migration 688: adicionar coluna concluido_em_data na tabela objetivos
-- Registra a data exata em que uma meta filha foi concluída (pelo clique do usuário).
-- Usada para calcular corretamente o tier de atraso (T1/T2/T3) em metas filhas,
-- substituindo o uso incorreto de atualizado_em (que reflete a criação, não a conclusão).

-- 1. Adicionar coluna
ALTER TABLE objetivos ADD COLUMN IF NOT EXISTS concluido_em_data date;

-- 2. Backfill: preencher para metas filhas já concluídas, usando audit_log como fonte de verdade.
--    Cobre os dois tipos de conclusão: filha normal e filha de sinergia.
--    Em caso de múltiplos registros (reabriu e reconcluiu), pega o MAIS RECENTE.
UPDATE objetivos o
SET concluido_em_data = sub.data_conclusao
FROM (
  SELECT
    al.entidade_id::uuid AS objetivo_id,
    MAX(al.created_at::date) AS data_conclusao
  FROM audit_log al
  WHERE al.entidade = 'objetivos'
    AND al.operacao = 'UPDATE'
    AND al.descricao IN ('Meta filha concluída', 'Meta filha sinergia concluída')
  GROUP BY al.entidade_id
) sub
WHERE o.id = sub.objetivo_id
  AND o.objetivo_pai_id IS NOT NULL
  AND o.status = 'concluido'
  AND o.concluido_em_data IS NULL;

-- Notificar PostgREST para recarregar schema
NOTIFY pgrst, 'reload schema';
