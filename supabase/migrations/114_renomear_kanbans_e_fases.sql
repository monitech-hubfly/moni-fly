-- Migration 114: Renomear kanbans, aparar fases e corrigir nomes de fases
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ============================================================
-- PARTE 1: Renomear kanbans
-- ============================================================

UPDATE public.kanbans SET nome = 'Funil Portfólio'    WHERE nome = 'Portfolio';
UPDATE public.kanbans SET nome = 'Funil Operações'    WHERE nome = 'Operações';
UPDATE public.kanbans SET nome = 'Funil Contabilidade' WHERE nome = 'Contabilidade';
UPDATE public.kanbans SET nome = 'Funil Crédito'      WHERE nome = 'Crédito';

-- ============================================================
-- PARTE 2: Funil Portfólio — remover fases a partir de Planialtimétrico
-- (manter apenas step_2 → passagem_wayser inclusive)
-- ============================================================

DELETE FROM public.kanban_fases
WHERE slug IN (
  'planialtimetrico', 'sondagem', 'projeto_legal',
  'aprovacao_condominio', 'aprovacao_prefeitura',
  'revisao_bca', 'processos_cartorarios',
  'aguardando_credito', 'em_obra', 'moni_care'
)
AND kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil Portfólio');

-- ============================================================
-- PARTE 3: Funil Operações — remover fases até Passagem Wayser
-- (manter apenas planialtimetrico → moni_care inclusive)
-- ============================================================

DELETE FROM public.kanban_fases
WHERE slug IN (
  'step_2', 'aprovacao_moni_novo_negocio', 'step_3', 'acoplamento',
  'step_4', 'step_5', 'step_6', 'step_7', 'passagem_wayser'
)
AND kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil Operações');

-- ============================================================
-- PARTE 4: Corrigir nomes de fases (nomes exatos de painelColumns.ts)
-- ============================================================

-- Funil Portfólio
UPDATE public.kanban_fases SET nome = 'Step 2: Novo Negócio'                     WHERE slug = 'step_2';
UPDATE public.kanban_fases SET nome = 'Aprovação Moní - Novo Negócio'            WHERE slug = 'aprovacao_moni_novo_negocio';
UPDATE public.kanban_fases SET nome = 'Step 3: Opção'                            WHERE slug = 'step_3';
UPDATE public.kanban_fases SET nome = 'Step 4: Check Legal + Checklist de Crédito' WHERE slug = 'step_4';
-- 'acoplamento' → 'Acoplamento' (já está correto)
UPDATE public.kanban_fases SET nome = 'Step 5: Comitê'                           WHERE slug = 'step_5';
UPDATE public.kanban_fases SET nome = 'Step 6: Diligência'                       WHERE slug = 'step_6';
UPDATE public.kanban_fases SET nome = 'Step 7: Contrato'                         WHERE slug = 'step_7';
UPDATE public.kanban_fases SET nome = 'Passagem para Wayser'                     WHERE slug = 'passagem_wayser';

-- Funil Operações
-- 'planialtimetrico' → 'Planialtimétrico' (já está correto)
UPDATE public.kanban_fases SET nome = 'Sondagem (paralelo Planialtimétrico)'     WHERE slug = 'sondagem';
-- 'projeto_legal' → 'Projeto Legal' (já está correto)
UPDATE public.kanban_fases SET nome = 'Aprovação no Condomínio'                  WHERE slug = 'aprovacao_condominio';
UPDATE public.kanban_fases SET nome = 'Aprovação na Prefeitura'                  WHERE slug = 'aprovacao_prefeitura';
UPDATE public.kanban_fases SET nome = 'Revisão do BCA'                           WHERE slug = 'revisao_bca';
-- 'processos_cartorarios' → 'Processos Cartorários' (já está correto)
-- 'aguardando_credito' → 'Aguardando Crédito' (já está correto)
-- 'em_obra' → 'Em Obra' (já está correto)
UPDATE public.kanban_fases SET nome = 'Moní Care'                                WHERE slug = 'moni_care';

-- Funil Contabilidade
UPDATE public.kanban_fases SET nome = 'Abertura da Incorporadora'                WHERE slug = 'contabilidade_incorporadora';
UPDATE public.kanban_fases SET nome = 'Abertura da SPE'                          WHERE slug = 'contabilidade_spe';
UPDATE public.kanban_fases SET nome = 'Abertura da Gestora'                      WHERE slug = 'contabilidade_gestora';

-- Funil Crédito: 'Crédito Terreno' e 'Crédito Obra' já estão corretos

-- ============================================================
-- PARTE 5: Atualizar a view para usar os novos nomes dos kanbans
-- ============================================================

CREATE OR REPLACE VIEW public.v_processo_como_kanban_cards AS
SELECT
  p.id,
  kf.kanban_id,
  kf.id          AS fase_id,
  COALESCE(
    NULLIF(TRIM(CONCAT_WS(' - ', p.numero_franquia, p.nome_condominio)), ''),
    'Sem título'
  )              AS titulo,
  p.status,
  p.created_at   AS criado_em,
  p.updated_at,
  p.user_id      AS responsavel_id,
  p.etapa_painel AS etapa_slug,
  NULL::date     AS data_prazo_sla,
  'legado'       AS origem
FROM processo_step_one p
JOIN kanban_fases kf ON kf.slug = p.etapa_painel
JOIN kanbans k       ON k.id   = kf.kanban_id
WHERE k.nome IN ('Funil Portfólio', 'Funil Operações', 'Funil Contabilidade', 'Funil Crédito')
  AND p.cancelado_em IS NULL
  AND p.removido_em  IS NULL;

GRANT SELECT ON public.v_processo_como_kanban_cards TO authenticated, anon;

-- ============================================================
-- Verificação: kanbans e contagem de fases
-- ============================================================
SELECT k.nome, COUNT(kf.id) AS total_fases
FROM public.kanbans k
LEFT JOIN public.kanban_fases kf ON kf.kanban_id = k.id
GROUP BY k.nome
ORDER BY k.nome;
