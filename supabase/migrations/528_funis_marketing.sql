-- 528: Sessão Marketing — 3 funis (Gravação, Programação semanal, Inc. to Fly).
-- Idempotente. DEV first.

INSERT INTO public.kanbans (id, nome, descricao, ativo)
SELECT v.id, v.nome, v.descricao, true
FROM (VALUES
  (
    'e8a14c2b-7d53-4f91-a6c0-2b9e5d8f1a47'::uuid,
    'Funil Gravação de Vídeos Externos'::text,
    'Pontual. Entrada: agenda/assessoria do Murillo. Saída: material para conteúdo após decupagem.'::text
  ),
  (
    'f1b25d3c-8e64-4a02-b7d1-3c0f6e9a2b58'::uuid,
    'Funil Programação de Conteúdo Semanal',
    'Recorrente semanal — Moní Capital, Franks e Murillo. Saída: post agendado na plataforma.'
  ),
  (
    'a2c36e4d-9f75-4b13-c8e2-4d1a7f0b3c69'::uuid,
    'Funil Série Inc. to Fly',
    'Pontual por temporada. Saída: episódio em D4 pronto para publicação/aprovação.'
  )
) AS v(id, nome, descricao)
WHERE NOT EXISTS (SELECT 1 FROM public.kanbans k WHERE k.id = v.id OR k.nome = v.nome);

-- Fases
INSERT INTO public.kanban_fases (
  kanban_id, nome, slug, ordem, sla_dias, sla_tipo, fase_conversao, ativo, instrucoes, materiais
)
SELECT
  v.kanban_id, v.nome, v.slug, v.ordem, v.sla_dias, 'uteis', v.fase_conversao, true, v.instrucoes, '[]'::jsonb
FROM (VALUES
  -- Gravação
  (
    'e8a14c2b-7d53-4f91-a6c0-2b9e5d8f1a47'::uuid,
    'Planejamento'::text, 'mkt_grav_planejamento'::text, 1, 1, false,
    E'Entrada — oportunidade vem da agenda do Murillo.\nSLA: até 1 dia útil após identificação.\nResponsável: João Paulo.\nRegistrar a oportunidade. Confirmar data, horário e local. Definir o uso final da gravação. Levantar necessidades de equipamento ou deslocamento.'::text
  ),
  (
    'e8a14c2b-7d53-4f91-a6c0-2b9e5d8f1a47'::uuid,
    'Gravação In Loco', 'mkt_grav_in_loco', 2, 1, false,
    E'SLA: 2h, 4h ou 6h — variável conforme distância e conteúdo.\nResponsável: João Paulo.\nDeslocar-se até o local. Realizar a gravação conforme o objetivo. Classificar em um dos 3 níveis.'
  ),
  (
    'e8a14c2b-7d53-4f91-a6c0-2b9e5d8f1a47'::uuid,
    'Decupagem', 'mkt_grav_decupagem', 3, 1, true,
    E'Saída — destino do material aproveitado (a confirmar).\nSLA: 30 minutos a 1 hora.\nResponsável: João Paulo.\nArmazenar os vídeos nas pastas definidas. Selecionar o material aproveitado. Apagar o que não será utilizado.'
  ),
  -- Programação
  (
    'f1b25d3c-8e64-4a02-b7d1-3c0f6e9a2b58'::uuid,
    'Planejamento Semanal', 'mkt_prog_planejamento', 1, 1, false,
    E'SLA: ≈ 30 minutos por ciclo semanal.\nResponsável: João Paulo.\nDefinir 1 pauta para Moní Capital, 1 para Franks e 1 para Murillo. Registrar tema, formato e data prevista de cada conteúdo.'
  ),
  (
    'f1b25d3c-8e64-4a02-b7d1-3c0f6e9a2b58'::uuid,
    'Edição', 'mkt_prog_edicao', 2, 1, false,
    E'SLA: ≈ 2h30min por vídeo editado.\nResponsável: João Paulo.\nEditar cada vídeo conforme a pauta. Entregar em formato final, pronto para agendamento.'
  ),
  (
    'f1b25d3c-8e64-4a02-b7d1-3c0f6e9a2b58'::uuid,
    'Agendamento', 'mkt_prog_agendamento', 3, 1, true,
    E'Saída — conteúdo sobe automaticamente na data programada.\nSLA: ≈ 15 minutos.\nResponsável: João Paulo.\nAgendar os posts. Conferir se os 3 conteúdos (Moní Capital, Franks e Murillo) foram agendados.'
  ),
  -- Inc. to Fly
  (
    'a2c36e4d-9f75-4b13-c8e2-4d1a7f0b3c69'::uuid,
    'Planejamento', 'mkt_inc_planejamento', 1, NULL::integer, false,
    E'Saída — envio do kit de comunicação ao franqueado.\nSLA: a definir.\nResponsável: João Paulo (confirmar corresponsáveis — ex.: franquias).\nIdentificar o destino. Identificar o(s) franqueado(s). Enviar o kit de comunicação.'
  ),
  (
    'a2c36e4d-9f75-4b13-c8e2-4d1a7f0b3c69'::uuid,
    'Gravação In Loco', 'mkt_inc_gravacao', 2, 3, false,
    E'SLA: ≈ 3 dias (captação de todos os episódios da temporada).\nResponsável: João Paulo.\nRealizar a captação de todos os episódios previstos. Seguir o planejamento.'
  ),
  (
    'a2c36e4d-9f75-4b13-c8e2-4d1a7f0b3c69'::uuid,
    'Decupagem do material gravado', 'mkt_inc_decupagem', 3, 1, false,
    E'SLA: ≈ 8 horas.\nResponsável: João Paulo.\nOrganizar e separar o material gravado em pastas por episódio.'
  ),
  (
    'a2c36e4d-9f75-4b13-c8e2-4d1a7f0b3c69'::uuid,
    'D1. Storyline', 'mkt_inc_d1_storyline', 4, 1, false,
    E'SLA: ≈ 8 horas.\nResponsável: João Paulo.\nMontar a linha do tempo. Marcar narração, gancho e ponte. Identificar material pendente. Validar a sequência antes de avançar.'
  ),
  (
    'a2c36e4d-9f75-4b13-c8e2-4d1a7f0b3c69'::uuid,
    'D2. Roteiro', 'mkt_inc_d2_roteiro', 5, 1, false,
    E'SLA: ≈ 8 horas.\nResponsável: João Paulo.\nRedigir as falas de narração com base no storyline validado.'
  ),
  (
    'a2c36e4d-9f75-4b13-c8e2-4d1a7f0b3c69'::uuid,
    'D2.1. Gravação extra', 'mkt_inc_d21_extra', 6, 1, false,
    E'Condicional. SLA: até 3 horas, quando necessária.\nResponsável: João Paulo.\nExecutar só se o roteiro exigir trechos extras. Gravar o necessário para completar o episódio.'
  ),
  (
    'a2c36e4d-9f75-4b13-c8e2-4d1a7f0b3c69'::uuid,
    'D3. Edição com narração', 'mkt_inc_d3_edicao', 7, 1, false,
    E'SLA: ≈ 8 horas.\nResponsável: João Paulo.\nEditar o vídeo com estrutura finalizada. Conferir imagens, dados e narração.'
  ),
  (
    'a2c36e4d-9f75-4b13-c8e2-4d1a7f0b3c69'::uuid,
    'D4. Versão final', 'mkt_inc_d4_final', 8, 1, true,
    E'Saída — episódio segue para publicação/aprovação.\nSLA: ≈ 8 horas.\nResponsável: João Paulo.\nGerar a versão final 100% editada.'
  )
) AS v(kanban_id, nome, slug, ordem, sla_dias, fase_conversao, instrucoes)
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_fases kf
  WHERE kf.kanban_id = v.kanban_id AND kf.slug = v.slug
);

UPDATE public.kanban_fases kf
SET
  nome = v.nome,
  ordem = v.ordem,
  sla_dias = v.sla_dias,
  sla_tipo = 'uteis',
  fase_conversao = v.fase_conversao,
  ativo = true,
  instrucoes = v.instrucoes
FROM (VALUES
  ('mkt_grav_planejamento'::text, 'Planejamento'::text, 1, 1, false, E'Entrada — oportunidade vem da agenda do Murillo.\nSLA: até 1 dia útil após identificação.\nResponsável: João Paulo.\nRegistrar a oportunidade. Confirmar data, horário e local. Definir o uso final da gravação. Levantar necessidades de equipamento ou deslocamento.'::text),
  ('mkt_grav_in_loco', 'Gravação In Loco', 2, 1, false, E'SLA: 2h, 4h ou 6h — variável conforme distância e conteúdo.\nResponsável: João Paulo.\nDeslocar-se até o local. Realizar a gravação conforme o objetivo. Classificar em um dos 3 níveis.'),
  ('mkt_grav_decupagem', 'Decupagem', 3, 1, true, E'Saída — destino do material aproveitado (a confirmar).\nSLA: 30 minutos a 1 hora.\nResponsável: João Paulo.\nArmazenar os vídeos nas pastas definidas. Selecionar o material aproveitado. Apagar o que não será utilizado.'),
  ('mkt_prog_planejamento', 'Planejamento Semanal', 1, 1, false, E'SLA: ≈ 30 minutos por ciclo semanal.\nResponsável: João Paulo.\nDefinir 1 pauta para Moní Capital, 1 para Franks e 1 para Murillo. Registrar tema, formato e data prevista de cada conteúdo.'),
  ('mkt_prog_edicao', 'Edição', 2, 1, false, E'SLA: ≈ 2h30min por vídeo editado.\nResponsável: João Paulo.\nEditar cada vídeo conforme a pauta. Entregar em formato final, pronto para agendamento.'),
  ('mkt_prog_agendamento', 'Agendamento', 3, 1, true, E'Saída — conteúdo sobe automaticamente na data programada.\nSLA: ≈ 15 minutos.\nResponsável: João Paulo.\nAgendar os posts. Conferir se os 3 conteúdos (Moní Capital, Franks e Murillo) foram agendados.'),
  ('mkt_inc_planejamento', 'Planejamento', 1, NULL::integer, false, E'Saída — envio do kit de comunicação ao franqueado.\nSLA: a definir.\nResponsável: João Paulo (confirmar corresponsáveis — ex.: franquias).\nIdentificar o destino. Identificar o(s) franqueado(s). Enviar o kit de comunicação.'),
  ('mkt_inc_gravacao', 'Gravação In Loco', 2, 3, false, E'SLA: ≈ 3 dias (captação de todos os episódios da temporada).\nResponsável: João Paulo.\nRealizar a captação de todos os episódios previstos. Seguir o planejamento.'),
  ('mkt_inc_decupagem', 'Decupagem do material gravado', 3, 1, false, E'SLA: ≈ 8 horas.\nResponsável: João Paulo.\nOrganizar e separar o material gravado em pastas por episódio.'),
  ('mkt_inc_d1_storyline', 'D1. Storyline', 4, 1, false, E'SLA: ≈ 8 horas.\nResponsável: João Paulo.\nMontar a linha do tempo. Marcar narração, gancho e ponte. Identificar material pendente. Validar a sequência antes de avançar.'),
  ('mkt_inc_d2_roteiro', 'D2. Roteiro', 5, 1, false, E'SLA: ≈ 8 horas.\nResponsável: João Paulo.\nRedigir as falas de narração com base no storyline validado.'),
  ('mkt_inc_d21_extra', 'D2.1. Gravação extra', 6, 1, false, E'Condicional. SLA: até 3 horas, quando necessária.\nResponsável: João Paulo.\nExecutar só se o roteiro exigir trechos extras. Gravar o necessário para completar o episódio.'),
  ('mkt_inc_d3_edicao', 'D3. Edição com narração', 7, 1, false, E'SLA: ≈ 8 horas.\nResponsável: João Paulo.\nEditar o vídeo com estrutura finalizada. Conferir imagens, dados e narração.'),
  ('mkt_inc_d4_final', 'D4. Versão final', 8, 1, true, E'Saída — episódio segue para publicação/aprovação.\nSLA: ≈ 8 horas.\nResponsável: João Paulo.\nGerar a versão final 100% editada.')
) AS v(slug, nome, ordem, sla_dias, fase_conversao, instrucoes)
WHERE kf.slug = v.slug
  AND kf.kanban_id IN (
    'e8a14c2b-7d53-4f91-a6c0-2b9e5d8f1a47'::uuid,
    'f1b25d3c-8e64-4a02-b7d1-3c0f6e9a2b58'::uuid,
    'a2c36e4d-9f75-4b13-c8e2-4d1a7f0b3c69'::uuid
  );

-- Checklists
DO $$
DECLARE
  v_fase_id UUID;
  v_item_id UUID;
  r RECORD;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- gravacao planejamento
      ('mkt_grav_planejamento'::text, 1, 'Data do evento'::text, 'data'::text, 'mkt_data_evento'::text, '{}'::jsonb),
      ('mkt_grav_planejamento', 2, 'Horário do evento', 'hora', 'mkt_horario_evento', '{}'::jsonb),
      ('mkt_grav_planejamento', 3, 'Local / endereço', 'texto_curto', 'mkt_local_endereco', '{}'::jsonb),
      ('mkt_grav_planejamento', 4, 'Uso final da gravação', 'select', 'mkt_uso_final',
        '{"opcoes":["institucional","redes sociais","arquivo","outro"]}'::jsonb),
      ('mkt_grav_planejamento', 5, 'Observações / briefing', 'texto_longo', 'mkt_obs_briefing', '{}'::jsonb),
      -- gravacao in loco
      ('mkt_grav_in_loco', 1, 'Nível de duração', 'select', 'mkt_nivel_duracao',
        '{"opcoes":["2h","4h","6h"]}'::jsonb),
      ('mkt_grav_in_loco', 2, 'Local da gravação', 'texto_curto', 'mkt_local_gravacao', '{}'::jsonb),
      ('mkt_grav_in_loco', 3, 'Equipamento utilizado', 'texto_curto', 'mkt_equipamento', '{}'::jsonb),
      ('mkt_grav_in_loco', 4, 'Observações da captação', 'texto_longo', 'mkt_obs_captacao', '{}'::jsonb),
      -- decupagem
      ('mkt_grav_decupagem', 1, 'Pasta de destino do material', 'url', 'mkt_pasta_destino', '{}'::jsonb),
      ('mkt_grav_decupagem', 2, 'Vídeos aproveitados', 'numero', 'mkt_videos_aproveitados', '{}'::jsonb),
      ('mkt_grav_decupagem', 3, 'Vídeos descartados', 'numero', 'mkt_videos_descartados', '{}'::jsonb),
      -- programacao planejamento
      ('mkt_prog_planejamento', 1, 'Pauta — Moní Capital', 'texto_longo', 'mkt_pauta_capital', '{}'::jsonb),
      ('mkt_prog_planejamento', 2, 'Pauta — Franks', 'texto_longo', 'mkt_pauta_franks', '{}'::jsonb),
      ('mkt_prog_planejamento', 3, 'Pauta — Murillo', 'texto_longo', 'mkt_pauta_murillo', '{}'::jsonb),
      ('mkt_prog_planejamento', 4, 'Data prevista Moní Capital', 'data', 'mkt_data_pub_capital', '{}'::jsonb),
      ('mkt_prog_planejamento', 5, 'Data prevista Franks', 'data', 'mkt_data_pub_franks', '{}'::jsonb),
      ('mkt_prog_planejamento', 6, 'Data prevista Murillo', 'data', 'mkt_data_pub_murillo', '{}'::jsonb),
      -- edicao
      ('mkt_prog_edicao', 1, 'Vídeo bruto', 'url', 'mkt_video_bruto', '{}'::jsonb),
      ('mkt_prog_edicao', 2, 'Vídeo editado', 'url', 'mkt_video_editado', '{}'::jsonb),
      ('mkt_prog_edicao', 3, 'Perfil de destino', 'select', 'mkt_perfil_destino',
        '{"opcoes":["Moní Capital","Franks","Murillo"]}'::jsonb),
      -- agendamento
      ('mkt_prog_agendamento', 1, 'Data e hora de publicação', 'data', 'mkt_data_publicacao', '{}'::jsonb),
      ('mkt_prog_agendamento', 2, 'Plataforma', 'select', 'mkt_plataforma',
        '{"opcoes":["Instagram","YouTube","TikTok","LinkedIn","Outra"]}'::jsonb),
      ('mkt_prog_agendamento', 3, 'Link do post agendado', 'url', 'mkt_link_post', '{}'::jsonb),
      -- inc planejamento
      ('mkt_inc_planejamento', 1, 'Destino', 'texto_curto', 'mkt_inc_destino', '{}'::jsonb),
      ('mkt_inc_planejamento', 2, 'Franqueado(s) participante(s)', 'texto_curto', 'mkt_inc_franqueados', '{}'::jsonb),
      ('mkt_inc_planejamento', 3, 'Kit de comunicação enviado', 'checkbox', 'mkt_inc_kit_enviado', '{}'::jsonb),
      ('mkt_inc_planejamento', 4, 'Data de envio do kit', 'data', 'mkt_inc_kit_data', '{}'::jsonb),
      -- inc gravacao
      ('mkt_inc_gravacao', 1, 'Datas de gravação', 'data', 'mkt_inc_datas_gravacao', '{}'::jsonb),
      ('mkt_inc_gravacao', 2, 'Franqueado(s) visitado(s)', 'texto_curto', 'mkt_inc_visitados', '{}'::jsonb),
      ('mkt_inc_gravacao', 3, 'Quantidade de episódios captados', 'numero', 'mkt_inc_qtd_episodios', '{}'::jsonb),
      -- inc decupagem
      ('mkt_inc_decupagem', 1, 'Pasta por episódio', 'url', 'mkt_inc_pasta_episodio', '{}'::jsonb),
      ('mkt_inc_decupagem', 2, 'Material selecionado', 'checkbox', 'mkt_inc_material_selecionado', '{}'::jsonb),
      -- d1
      ('mkt_inc_d1_storyline', 1, 'Linha do tempo montada', 'url', 'mkt_inc_timeline', '{}'::jsonb),
      ('mkt_inc_d1_storyline', 2, 'Marcações de narração / gancho / ponte', 'texto_longo', 'mkt_inc_marcacoes', '{}'::jsonb),
      ('mkt_inc_d1_storyline', 3, 'Material pendente a gerar ou localizar', 'texto_longo', 'mkt_inc_material_pendente', '{}'::jsonb),
      ('mkt_inc_d1_storyline', 4, 'Sequência validada', 'checkbox', 'mkt_inc_sequencia_validada', '{}'::jsonb),
      -- d2
      ('mkt_inc_d2_roteiro', 1, 'Roteiro / falas de narração', 'texto_longo', 'mkt_inc_roteiro', '{}'::jsonb),
      -- d2.1
      ('mkt_inc_d21_extra', 1, 'Necessidade de gravação extra identificada', 'checkbox', 'mkt_inc_extra_necessaria', '{}'::jsonb),
      ('mkt_inc_d21_extra', 2, 'Trechos extras gravados', 'url', 'mkt_inc_extra_trechos', '{}'::jsonb),
      -- d3
      ('mkt_inc_d3_edicao', 1, 'Vídeo com estrutura finalizada', 'url', 'mkt_inc_video_estrutura', '{}'::jsonb),
      -- d4
      ('mkt_inc_d4_final', 1, 'Vídeo final 100% editado', 'url', 'mkt_inc_video_final', '{}'::jsonb),
      ('mkt_inc_d4_final', 2, 'Aprovação final', 'checkbox', 'mkt_inc_aprovacao_final', '{}'::jsonb)
    ) AS t(fase_slug, ordem, label, tipo, campo_slug, config_json)
  LOOP
    SELECT id INTO v_fase_id
    FROM public.kanban_fases
    WHERE slug = r.fase_slug
      AND kanban_id IN (
        'e8a14c2b-7d53-4f91-a6c0-2b9e5d8f1a47'::uuid,
        'f1b25d3c-8e64-4a02-b7d1-3c0f6e9a2b58'::uuid,
        'a2c36e4d-9f75-4b13-c8e2-4d1a7f0b3c69'::uuid
      )
    LIMIT 1;
    IF v_fase_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT id INTO v_item_id
    FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_id AND campo_slug = r.campo_slug
    LIMIT 1;

    IF v_item_id IS NOT NULL THEN
      UPDATE public.kanban_fase_checklist_itens
      SET ordem = r.ordem, label = r.label, tipo = r.tipo,
          visivel_candidato = true, config_json = r.config_json
      WHERE id = v_item_id;
    ELSE
      INSERT INTO public.kanban_fase_checklist_itens (
        fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json
      ) VALUES (
        v_fase_id, r.ordem, r.label, r.tipo, false, true, r.campo_slug, r.config_json
      );
    END IF;
  END LOOP;
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('528', 'funis_marketing')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
