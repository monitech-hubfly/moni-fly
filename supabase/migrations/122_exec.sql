INSERT INTO public.kanban_atividades
  (card_id, titulo, descricao, tipo, status, data_vencimento, origem, time,
   criado_por, responsavel_id, responsaveis_ids)
SELECT
  kc.id                                     AS card_id,
  t.titulo,
  t.descricao,
  t.tipo,
  t.status,
  t.data_vencimento,
  'nativo'                                  AS origem,
  t.time,
  kc.franqueado_id                          AS criado_por,
  kc.franqueado_id                          AS responsavel_id,
  CASE WHEN kc.franqueado_id IS NOT NULL
    THEN ARRAY[kc.franqueado_id]
    ELSE '{}'::uuid[]
  END                                       AS responsaveis_ids
FROM (
  SELECT id, franqueado_id
  FROM   public.kanban_cards
  ORDER  BY created_at DESC
  LIMIT  5
) kc
CROSS JOIN (
  VALUES
    ('Preparar relatório fotográfico da região',
     'Fazer registros visuais dos principais pontos de interesse',
     'atividade', 'pendente',     CURRENT_DATE - INTERVAL '7 days',  'operacoes'),
    ('Agendar reunião com corretores locais',
     'Marcar encontro para entender dinâmica do mercado imobiliário',
     'duvida',    'pendente',     CURRENT_DATE + INTERVAL '1 day',   'comercial'),
    ('Solicitar certidões e documentos',
     'Reunir toda documentação legal para análise de viabilidade',
     'atividade', 'em_andamento', CURRENT_DATE + INTERVAL '5 days',  'juridico')
) AS t(titulo, descricao, tipo, status, data_vencimento, time)
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_atividades ka
  WHERE ka.card_id = kc.id
    AND ka.titulo  = t.titulo
    AND ka.origem  = 'nativo'
);

INSERT INTO public.kanban_atividades
  (card_id, titulo, descricao, tipo, status, data_vencimento, origem, time,
   criado_por, responsavel_id, responsaveis_ids, trava)
SELECT
  NULL                                           AS card_id,
  t.titulo,
  t.descricao,
  t.tipo,
  t.status,
  t.data_vencimento,
  'sirene'                                       AS origem,
  t.time,
  sc.aberto_por                                  AS criado_por,
  sc.aberto_por                                  AS responsavel_id,
  CASE WHEN sc.aberto_por IS NOT NULL
    THEN ARRAY[sc.aberto_por]
    ELSE '{}'::uuid[]
  END                                            AS responsaveis_ids,
  t.trava
FROM (
  SELECT id, aberto_por
  FROM   public.sirene_chamados
  ORDER  BY created_at DESC
  LIMIT  3
) sc
CROSS JOIN (
  VALUES
    ('Análise de impacto da ocorrência',
     'Levantar dados de recorrência e raiz do problema',
     'atividade', 'pendente',     CURRENT_DATE + INTERVAL '2 days',  'operacoes', false),
    ('Documentar resolução no sistema',
     'Registrar passos da solução para base de conhecimento',
     'atividade', 'em_andamento', CURRENT_DATE + INTERVAL '3 days',  'operacoes', false),
    ('Validar com o time jurídico',
     'Confirmar se há implicações contratuais',
     'duvida',    'pendente',     CURRENT_DATE - INTERVAL '1 day',   'juridico',  true)
) AS t(titulo, descricao, tipo, status, data_vencimento, time, trava)
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_atividades ka
  WHERE ka.criado_por = sc.aberto_por
    AND ka.titulo     = t.titulo
    AND ka.origem     = 'sirene'
);

INSERT INTO public.sirene_topicos
  (interacao_id, chamado_id, ordem, descricao, time_responsavel, status, trava,
   responsaveis_ids)
SELECT
  ka.id                       AS interacao_id,
  NULL                        AS chamado_id,
  st.ordem,
  st.descricao,
  st.time_responsavel,
  st.status,
  false                       AS trava,
  CASE WHEN ka.responsavel_id IS NOT NULL
    THEN ARRAY[ka.responsavel_id]
    ELSE '{}'::uuid[]
  END                         AS responsaveis_ids
FROM public.kanban_atividades ka
CROSS JOIN (
  VALUES
    (1, 'Coletar evidências do incidente',   'operacoes',  'nao_iniciado'),
    (2, 'Elaborar relatório de encerramento','operacoes',  'em_andamento'),
    (3, 'Apresentar à Caneta Verde',         'juridico',   'nao_iniciado')
) AS st(ordem, descricao, time_responsavel, status)
WHERE ka.origem = 'sirene'
  AND NOT EXISTS (
    SELECT 1 FROM public.sirene_topicos stt
    WHERE stt.interacao_id = ka.id
      AND stt.descricao    = st.descricao
  )
ORDER BY ka.created_at DESC
LIMIT 9;
