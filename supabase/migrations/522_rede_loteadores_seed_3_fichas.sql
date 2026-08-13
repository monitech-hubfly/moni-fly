-- 522: Seed de 3 cadastros de loteadores (fichas Boulevard Guarapari, Montebelluna, Vila Castela).
-- Idempotente: não altera registros existentes; só insere se o nome ainda não existir.
-- n_loteador/ordem/codigo seguem a lógica de getNextLOFromRedeLoteadores (LO sequencial).
-- Reversão: ver comentário no final.

INSERT INTO public.rede_loteadores (
  nome,
  cidade,
  estado,
  condominio_estado,
  status,
  contato_nome,
  interlocutor_nome,
  interlocutor_cargo,
  condominio_nome,
  condominio_cidade,
  condominio_data_lancamento,
  condominio_qtd_lotes,
  condominio_preco_lotes,
  condominio_metragem_lotes,
  condominio_preco_casas,
  condominio_metragem_casas,
  anexo_planta_cadastral,
  anexo_manual_obras,
  anexo_casas_concorrentes,
  carteira_lotes_disponiveis,
  carteira_lotes_vendidos_quitados,
  carteira_carteira_curta_qtd,
  carteira_curta_financiamento,
  carteira_longa_qtd,
  carteira_longa_financiamento,
  anexo_tabela_precos,
  observacoes,
  n_loteador,
  ordem,
  codigo
)
SELECT
  s.nome,
  s.cidade,
  s.estado,
  s.condominio_estado,
  s.status,
  s.contato_nome,
  s.interlocutor_nome,
  s.interlocutor_cargo,
  s.condominio_nome,
  s.condominio_cidade,
  s.condominio_data_lancamento,
  s.condominio_qtd_lotes,
  s.condominio_preco_lotes,
  s.condominio_metragem_lotes,
  s.condominio_preco_casas,
  s.condominio_metragem_casas,
  s.anexo_planta_cadastral,
  s.anexo_manual_obras,
  s.anexo_casas_concorrentes,
  s.carteira_lotes_disponiveis,
  s.carteira_lotes_vendidos_quitados,
  s.carteira_carteira_curta_qtd,
  s.carteira_curta_financiamento,
  s.carteira_longa_qtd,
  s.carteira_longa_financiamento,
  s.anexo_tabela_precos,
  s.observacoes,
  'LO' || lpad((base.max_lo + s.seq)::text, 4, '0'),
  base.max_lo + s.seq,
  'LO' || lpad((base.max_lo + s.seq)::text, 4, '0')
FROM (
  SELECT COALESCE(
    (
      SELECT NULLIF(regexp_replace(upper(btrim(n_loteador)), '^LO', ''), '')::int
      FROM public.rede_loteadores
      WHERE n_loteador ~* '^LO[0-9]+$'
      ORDER BY ordem DESC NULLS LAST
      LIMIT 1
    ),
    -1
  ) AS max_lo
) AS base
CROSS JOIN (
  SELECT * FROM (VALUES
    (
      1,
      'Boulevard Guarapari'::text,
      'Guarapari'::text,
      'ES'::text,
      'ES'::text,
      'em_analise'::text,
      NULL::text,
      NULL::text,
      NULL::text,
      'Boulevard Guarapari'::text,
      'Guarapari'::text,
      '2025-05-01'::date,
      453,
      'Conforme tabela de vendas (Tabela de Vendas – Guarapari.xlsx)'::text,
      '422 m²'::text,
      'R$ 1,4 milhão a R$ 2 milhões'::text,
      '120 m² e 170 m²'::text,
      'Disponível — 1. Projeto Urbano Executivo.R01-Assinado.pdf'::text,
      'Disponível — ANEXO I - Memorial Descritivo das Edificações - BPG -rev00.docx'::text,
      'Não identificadas'::text,
      185,
      NULL::int,
      NULL::int,
      'à vista ou até 12x sem juros'::text,
      NULL::int,
      NULL::text,
      'Tabela de Vendas – Guarapari.xlsx (arquivo anexo)'::text,
      $obs1$Condição de pagamento (carteira curta): à vista ou até 12x sem juros.
Planta cadastral e manual de obras disponíveis como anexos no documento original.$obs1$
    ),
    (
      2,
      'Montebelluna',
      'Tambaú',
      'SP',
      'SP',
      'em_analise',
      NULL,
      NULL,
      NULL,
      'Montebelluna',
      'Tambaú',
      '2019-01-01'::date,
      139,
      'R$ 120.000 a R$ 140.000 (varia conforme localização e proprietário)',
      '360 m²',
      'R$ 350 mil a R$ 750 mil (mercado local); referência: 150 m² ≈ R$ 640 mil sem piscina',
      'Modelos 114–130 m²: 1 suíte + 1 dorm. (opções 1–3) / 1 suíte + 2 dorm. (opção 4); área de lazer ~50 m²; fachadas: Clássico, Contemporâneo e Moderno',
      NULL,
      'Área mínima construída: 100 m²',
      'Estudo elaborado na plataforma Instacasa com modelos de expansão modular (anexo)',
      90,
      42,
      0,
      'entrada 10%, saldo em até 48 meses',
      3,
      'entrada 5–10%, saldo em até 120 meses',
      NULL,
      $obs2$Qtd. de lotes: 139 (2 condomínios fechados). Lotes disponíveis: ~90 (sendo ~25 da família Walter).
Carteira curta: entrada 10%, saldo em até 48 meses.
Carteira longa: entrada 5–10%, saldo em até 120 meses.
Situação: todos os lotes possuem matrícula individual e liberados para construção.
Casas à venda atualmente: nenhuma.
Concorrentes na cidade: Montebelluna e Portal dos Ipês (únicos loteamentos fechados).
Estoque da família Walter: ~25 lotes disponíveis para venda.$obs2$
    ),
    (
      3,
      'Vila Castela',
      NULL,
      NULL,
      NULL,
      'em_analise',
      'Lucas Barcelos',
      'Lucas Barcelos',
      'Grupo LBX — proprietário de lote / parceiro estratégico',
      'Vila Castela',
      NULL,
      NULL,
      NULL,
      'R$ 1 milhão a R$ 1,7 milhão',
      NULL,
      'Faixas de maior potencial: R$ 4,5 mi / R$ 7 mi / R$ 10 mi',
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      108,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      $obs3$Lotes vendidos quitados: ~108 lotes vendidos sem casas construídas.
Modelo de negócio: proprietário aporta o lote, Moní desenvolve e vende para terceiro.
Entrada via franqueado Fernando (permuta de lote de Lucas Barcelos).
Lucas atua via Associação de Moradores do Vila Castela — parceiro estratégico para prospecção.
ATENÇÃO: lote disponibilizado para estudo tem queda de 24 m — verificar viabilidade construtiva.
Envio de NDA recomendado antes de compartilhar estudos com o parceiro.$obs3$
    )
  ) AS v(
    seq,
    nome,
    cidade,
    estado,
    condominio_estado,
    status,
    contato_nome,
    interlocutor_nome,
    interlocutor_cargo,
    condominio_nome,
    condominio_cidade,
    condominio_data_lancamento,
    condominio_qtd_lotes,
    condominio_preco_lotes,
    condominio_metragem_lotes,
    condominio_preco_casas,
    condominio_metragem_casas,
    anexo_planta_cadastral,
    anexo_manual_obras,
    anexo_casas_concorrentes,
    carteira_lotes_disponiveis,
    carteira_lotes_vendidos_quitados,
    carteira_carteira_curta_qtd,
    carteira_curta_financiamento,
    carteira_longa_qtd,
    carteira_longa_financiamento,
    anexo_tabela_precos,
    observacoes
  )
) AS s
WHERE NOT EXISTS (
  SELECT 1
  FROM public.rede_loteadores e
  WHERE lower(btrim(e.nome)) = lower(btrim(s.nome))
     OR (
       e.condominio_nome IS NOT NULL
       AND lower(btrim(e.condominio_nome)) = lower(btrim(s.condominio_nome))
     )
);

NOTIFY pgrst, 'reload schema';

-- Reversão (não executar no UP):
-- DELETE FROM public.rede_loteadores rl
-- WHERE rl.nome IN ('Boulevard Guarapari', 'Montebelluna', 'Vila Castela')
--   AND NOT EXISTS (
--     SELECT 1 FROM public.kanban_cards c
--     WHERE c.rede_loteador_id = rl.id
--   );
