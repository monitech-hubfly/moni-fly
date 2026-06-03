-- 241: Funil Step One — rebuild checklist BCA + Batalha de Casas

DELETE FROM public.kanban_fase_checklist_itens
WHERE fase_id = '8fda525c-720d-4db7-821d-52625867a000';

INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
VALUES
  ('8fda525c-720d-4db7-821d-52625867a000',  1, 'Casa candidata 1 (modelo Moní escolhido)',      'texto_curto', true,  true),
  ('8fda525c-720d-4db7-821d-52625867a000',  2, 'Casa candidata 2 (modelo Moní escolhido)',      'texto_curto', false, true),
  ('8fda525c-720d-4db7-821d-52625867a000',  3, 'Casa candidata 3 (modelo Moní escolhido)',      'texto_curto', false, true),
  ('8fda525c-720d-4db7-821d-52625867a000',  4, 'PDF do Configurador — Casa 1',                  'anexo',       true,  true),
  ('8fda525c-720d-4db7-821d-52625867a000',  5, 'PDF do Configurador — Casa 2',                  'anexo',       false, true),
  ('8fda525c-720d-4db7-821d-52625867a000',  6, 'PDF do Configurador — Casa 3',                  'anexo',       false, true),
  ('8fda525c-720d-4db7-821d-52625867a000',  7, 'BCA elaborado para a casa escolhida',           'checkbox',    true,  true),
  ('8fda525c-720d-4db7-821d-52625867a000',  8, 'Link do BCA',                                   'texto_curto', true,  true),
  ('8fda525c-720d-4db7-821d-52625867a000',  9, 'VGV projetado (R$)',                            'numero',      true,  true),
  ('8fda525c-720d-4db7-821d-52625867a000', 10, 'Retorno esperado (%)',                          'numero',      true,  true),
  ('8fda525c-720d-4db7-821d-52625867a000', 11, 'Batalha de Casas aplicada (3 eixos)',           'checkbox',    true,  true),
  ('8fda525c-720d-4db7-821d-52625867a000', 12, 'Posição no ranking da batalha',                 'numero',      true,  true),
  ('8fda525c-720d-4db7-821d-52625867a000', 13, 'Giro da faixa de valor',                        'numero',      true,  true),
  ('8fda525c-720d-4db7-821d-52625867a000', 14, 'Resultado: posição ≤ giro?',                    'checkbox',    true,  true),
  ('8fda525c-720d-4db7-821d-52625867a000', 15, 'Casa escolhida final',                          'texto_curto', true,  true),
  ('8fda525c-720d-4db7-821d-52625867a000', 16, 'Por que esta casa (justificativa)',             'texto_longo', true,  true),
  ('8fda525c-720d-4db7-821d-52625867a000', 17, 'Vantagens identificadas na batalha',            'texto_longo', true,  true),
  ('8fda525c-720d-4db7-821d-52625867a000', 18, 'Desvantagens identificadas na batalha',         'texto_longo', true,  true),
  ('8fda525c-720d-4db7-821d-52625867a000', 19, 'Discurso para amenizar desvantagens',           'texto_longo', true,  true),
  ('8fda525c-720d-4db7-821d-52625867a000', 20, 'Aprovado pelo comitê',                          'checkbox',    true,  true);
