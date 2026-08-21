-- 240: Funil Step One — rebuild checklist Mapa de Competidores (atributos da casa)

DELETE FROM public.kanban_fase_checklist_itens
WHERE fase_id = 'ba79c1e4-d65a-4cef-9ee2-a8aaf0c614e0';

INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
VALUES
  ('ba79c1e4-d65a-4cef-9ee2-a8aaf0c614e0',  1, 'Endereço / identificação da casa',                    'texto_curto', true,  true),
  ('ba79c1e4-d65a-4cef-9ee2-a8aaf0c614e0',  2, 'Condomínio',                                          'texto_curto', true,  true),
  ('ba79c1e4-d65a-4cef-9ee2-a8aaf0c614e0',  3, 'Status (anunciada / vendida)',                        'texto_curto', true,  true),
  ('ba79c1e4-d65a-4cef-9ee2-a8aaf0c614e0',  4, 'Valor anunciado (R$)',                                'numero',      true,  true),
  ('ba79c1e4-d65a-4cef-9ee2-a8aaf0c614e0',  5, 'Área construída m²',                                  'numero',      true,  true),
  ('ba79c1e4-d65a-4cef-9ee2-a8aaf0c614e0',  6, 'Valor R$/m²',                                         'numero',      false, true),
  ('ba79c1e4-d65a-4cef-9ee2-a8aaf0c614e0',  7, 'Número de quartos',                                   'numero',      true,  true),
  ('ba79c1e4-d65a-4cef-9ee2-a8aaf0c614e0',  8, 'Número de banheiros/suítes',                          'numero',      false, true),
  ('ba79c1e4-d65a-4cef-9ee2-a8aaf0c614e0',  9, 'Número de vagas',                                     'numero',      false, true),
  ('ba79c1e4-d65a-4cef-9ee2-a8aaf0c614e0', 10, 'Amenidades (piscina, rooftop, ofurô, hidromassagem)', 'texto_curto', false, true),
  ('ba79c1e4-d65a-4cef-9ee2-a8aaf0c614e0', 11, 'Estilo / design da casa',                             'texto_curto', false, true),
  ('ba79c1e4-d65a-4cef-9ee2-a8aaf0c614e0', 12, 'Tempo no mercado / tempo até venda',                  'texto_curto', false, true),
  ('ba79c1e4-d65a-4cef-9ee2-a8aaf0c614e0', 13, 'Faixa de valor de venda',                             'texto_curto', true,  true),
  ('ba79c1e4-d65a-4cef-9ee2-a8aaf0c614e0', 14, 'Link do anúncio (ZAP, OLX etc.)',                     'texto_curto', false, true),
  ('ba79c1e4-d65a-4cef-9ee2-a8aaf0c614e0', 15, 'Observações',                                         'texto_longo', false, true),
  ('ba79c1e4-d65a-4cef-9ee2-a8aaf0c614e0', 16, 'Ranking inicial pelo eixo Produto',                   'texto_curto', false, true),
  ('ba79c1e4-d65a-4cef-9ee2-a8aaf0c614e0', 17, 'Casas candidatas selecionadas (até 3 modelos Moní)',  'texto_longo', false, true);
