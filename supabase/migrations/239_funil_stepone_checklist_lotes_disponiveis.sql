-- 239: Funil Step One — rebuild checklist Lotes Disponíveis (atributos do lote)

DELETE FROM public.kanban_fase_checklist_itens
WHERE fase_id = 'a6afabd9-2409-49a7-ab11-d2df4d3784e7';

INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
VALUES
  ('a6afabd9-2409-49a7-ab11-d2df4d3784e7',  1, 'Identificação do lote (quadra/lote)', 'texto_curto', true,  true),
  ('a6afabd9-2409-49a7-ab11-d2df4d3784e7',  2, 'Área m²',                              'numero',      true,  true),
  ('a6afabd9-2409-49a7-ab11-d2df4d3784e7',  3, 'Valor do lote (R$)',                   'numero',      true,  true),
  ('a6afabd9-2409-49a7-ab11-d2df4d3784e7',  4, 'Situação documental',                  'texto_curto', true,  true),
  ('a6afabd9-2409-49a7-ab11-d2df4d3784e7',  5, 'Fotos do lote',                        'anexo',       true,  true),
  ('a6afabd9-2409-49a7-ab11-d2df4d3784e7',  6, 'Vista privilegiada',                   'checkbox',    false, true),
  ('a6afabd9-2409-49a7-ab11-d2df4d3784e7',  7, 'Perto de área verde',                  'checkbox',    false, true),
  ('a6afabd9-2409-49a7-ab11-d2df4d3784e7',  8, 'Muro',                                 'checkbox',    false, true),
  ('a6afabd9-2409-49a7-ab11-d2df4d3784e7',  9, 'Perto de área de convivência',         'checkbox',    false, true),
  ('a6afabd9-2409-49a7-ab11-d2df4d3784e7', 10, 'Perto de lixeira',                     'checkbox',    false, true),
  ('a6afabd9-2409-49a7-ab11-d2df4d3784e7', 11, 'Observações adicionais sobre o lote',  'texto_longo', false, true);
