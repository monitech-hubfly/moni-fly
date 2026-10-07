-- Migration 605: Venda Casas Loteadores (IMOB)
-- Cria os 3 sub-kanbans (Lotes Não Vendidos / Lotes Vendidos / Showroom),
-- cada um com as mesmas 7 fases, e adiciona colunas vc_* em kanban_cards.
-- Idempotente: usa ON CONFLICT DO NOTHING e ADD COLUMN IF NOT EXISTS.
-- NÃO cria Venda Casas Frank's (tela Em Construção sem kanban).

-- ─── 1. Kanbans ───────────────────────────────────────────────────────────

INSERT INTO public.kanbans (id, nome, ordem, ativo)
VALUES
  ('fc000002-0000-0000-0000-000000000001', 'Venda Casas Loteadores - Lotes Não Vendidos', 0, true),
  ('fc000003-0000-0000-0000-000000000001', 'Venda Casas Loteadores - Lotes Vendidos',     0, true),
  ('fc000004-0000-0000-0000-000000000001', 'Venda Casas Loteadores - Showroom',            0, true)
ON CONFLICT (id) DO NOTHING;

-- ─── 2. Fases — Lotes Não Vendidos ────────────────────────────────────────

INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, cor)
VALUES
  ('fc000010-0000-0000-0000-000000000001', 'fc000002-0000-0000-0000-000000000001', 'Leads',               'vcl_leads',              1, 'var(--moni-kanban-corretores)'),
  ('fc000010-0000-0000-0000-000000000002', 'fc000002-0000-0000-0000-000000000001', '1º Contato',          'vcl_1_contato',          2, 'var(--moni-kanban-corretores)'),
  ('fc000010-0000-0000-0000-000000000003', 'fc000002-0000-0000-0000-000000000001', 'Qualificados',        'vcl_qualificados',       3, 'var(--moni-kanban-corretores)'),
  ('fc000010-0000-0000-0000-000000000004', 'fc000002-0000-0000-0000-000000000001', 'R1 Realizada',        'vcl_r1_realizada',       4, 'var(--moni-kanban-corretores)'),
  ('fc000010-0000-0000-0000-000000000005', 'fc000002-0000-0000-0000-000000000001', 'Proposta',            'vcl_proposta',           5, 'var(--moni-kanban-corretores)'),
  ('fc000010-0000-0000-0000-000000000006', 'fc000002-0000-0000-0000-000000000001', 'Assinatura Contrato', 'vcl_assinatura_contrato',6, 'var(--moni-kanban-corretores)'),
  ('fc000010-0000-0000-0000-000000000007', 'fc000002-0000-0000-0000-000000000001', 'Contrato Assinado',   'vcl_contrato_assinado',  7, 'var(--moni-kanban-portfolio)')
ON CONFLICT (id) DO NOTHING;

-- ─── 3. Fases — Lotes Vendidos ────────────────────────────────────────────

INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, cor)
VALUES
  ('fc000020-0000-0000-0000-000000000001', 'fc000003-0000-0000-0000-000000000001', 'Leads',               'vcl_leads',              1, 'var(--moni-kanban-corretores)'),
  ('fc000020-0000-0000-0000-000000000002', 'fc000003-0000-0000-0000-000000000001', '1º Contato',          'vcl_1_contato',          2, 'var(--moni-kanban-corretores)'),
  ('fc000020-0000-0000-0000-000000000003', 'fc000003-0000-0000-0000-000000000001', 'Qualificados',        'vcl_qualificados',       3, 'var(--moni-kanban-corretores)'),
  ('fc000020-0000-0000-0000-000000000004', 'fc000003-0000-0000-0000-000000000001', 'R1 Realizada',        'vcl_r1_realizada',       4, 'var(--moni-kanban-corretores)'),
  ('fc000020-0000-0000-0000-000000000005', 'fc000003-0000-0000-0000-000000000001', 'Proposta',            'vcl_proposta',           5, 'var(--moni-kanban-corretores)'),
  ('fc000020-0000-0000-0000-000000000006', 'fc000003-0000-0000-0000-000000000001', 'Assinatura Contrato', 'vcl_assinatura_contrato',6, 'var(--moni-kanban-corretores)'),
  ('fc000020-0000-0000-0000-000000000007', 'fc000003-0000-0000-0000-000000000001', 'Contrato Assinado',   'vcl_contrato_assinado',  7, 'var(--moni-kanban-portfolio)')
ON CONFLICT (id) DO NOTHING;

-- ─── 4. Fases — Showroom ──────────────────────────────────────────────────

INSERT INTO public.kanban_fases (id, kanban_id, nome, slug, ordem, cor)
VALUES
  ('fc000030-0000-0000-0000-000000000001', 'fc000004-0000-0000-0000-000000000001', 'Leads',               'vcl_leads',              1, 'var(--moni-kanban-corretores)'),
  ('fc000030-0000-0000-0000-000000000002', 'fc000004-0000-0000-0000-000000000001', '1º Contato',          'vcl_1_contato',          2, 'var(--moni-kanban-corretores)'),
  ('fc000030-0000-0000-0000-000000000003', 'fc000004-0000-0000-0000-000000000001', 'Qualificados',        'vcl_qualificados',       3, 'var(--moni-kanban-corretores)'),
  ('fc000030-0000-0000-0000-000000000004', 'fc000004-0000-0000-0000-000000000001', 'R1 Realizada',        'vcl_r1_realizada',       4, 'var(--moni-kanban-corretores)'),
  ('fc000030-0000-0000-0000-000000000005', 'fc000004-0000-0000-0000-000000000001', 'Proposta',            'vcl_proposta',           5, 'var(--moni-kanban-corretores)'),
  ('fc000030-0000-0000-0000-000000000006', 'fc000004-0000-0000-0000-000000000001', 'Assinatura Contrato', 'vcl_assinatura_contrato',6, 'var(--moni-kanban-corretores)'),
  ('fc000030-0000-0000-0000-000000000007', 'fc000004-0000-0000-0000-000000000001', 'Contrato Assinado',   'vcl_contrato_assinado',  7, 'var(--moni-kanban-portfolio)')
ON CONFLICT (id) DO NOTHING;

-- ─── 5. Colunas vc_* em kanban_cards ─────────────────────────────────────

ALTER TABLE public.kanban_cards ADD COLUMN IF NOT EXISTS vc_loteador        TEXT;
ALTER TABLE public.kanban_cards ADD COLUMN IF NOT EXISTS vc_dono_terreno    TEXT;
ALTER TABLE public.kanban_cards ADD COLUMN IF NOT EXISTS vc_cpf             TEXT;
ALTER TABLE public.kanban_cards ADD COLUMN IF NOT EXISTS vc_rg              TEXT;
ALTER TABLE public.kanban_cards ADD COLUMN IF NOT EXISTS vc_lote            TEXT;
ALTER TABLE public.kanban_cards ADD COLUMN IF NOT EXISTS vc_quadra          TEXT;
ALTER TABLE public.kanban_cards ADD COLUMN IF NOT EXISTS vc_metragem        TEXT;
ALTER TABLE public.kanban_cards ADD COLUMN IF NOT EXISTS vc_frente          TEXT;
ALTER TABLE public.kanban_cards ADD COLUMN IF NOT EXISTS vc_fundo           TEXT;
ALTER TABLE public.kanban_cards ADD COLUMN IF NOT EXISTS vc_terreno_quitado BOOLEAN DEFAULT FALSE;
ALTER TABLE public.kanban_cards ADD COLUMN IF NOT EXISTS vc_valor_terreno   TEXT;
ALTER TABLE public.kanban_cards ADD COLUMN IF NOT EXISTS vc_saldo_devedor   TEXT;
ALTER TABLE public.kanban_cards ADD COLUMN IF NOT EXISTS vc_valor_parcela   TEXT;
ALTER TABLE public.kanban_cards ADD COLUMN IF NOT EXISTS vc_qtd_parcelas    TEXT;
ALTER TABLE public.kanban_cards ADD COLUMN IF NOT EXISTS vc_juros           TEXT;
ALTER TABLE public.kanban_cards ADD COLUMN IF NOT EXISTS vc_observacao      TEXT;
ALTER TABLE public.kanban_cards ADD COLUMN IF NOT EXISTS vc_email           TEXT;
ALTER TABLE public.kanban_cards ADD COLUMN IF NOT EXISTS vc_telefone        TEXT;

-- Notifica PostgREST para recarregar o schema
NOTIFY pgrst, 'reload schema';
