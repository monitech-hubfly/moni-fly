-- 495: Funil Crédito Obra — tags de tranche (1ª–6ª) + coluna card filho nos vínculos Operações.

-- Tags preset no Funil Crédito Obra
INSERT INTO public.kanban_tags (kanban_id, nome, cor)
SELECT v.kanban_id, v.nome, v.cor
FROM (
  VALUES
    ('6463af1d-850d-4958-b74c-404f8d668e21'::uuid, '1ª tranche', '#0c2633'),
    ('6463af1d-850d-4958-b74c-404f8d668e21'::uuid, '2ª tranche', '#2f4a3a'),
    ('6463af1d-850d-4958-b74c-404f8d668e21'::uuid, '3ª tranche', '#4a3929'),
    ('6463af1d-850d-4958-b74c-404f8d668e21'::uuid, '4ª tranche', '#d4ad68'),
    ('6463af1d-850d-4958-b74c-404f8d668e21'::uuid, '5ª tranche', '#3e7490'),
    ('6463af1d-850d-4958-b74c-404f8d668e21'::uuid, '6ª tranche', '#365848')
) AS v(kanban_id, nome, cor)
WHERE EXISTS (SELECT 1 FROM public.kanbans k WHERE k.id = v.kanban_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_tags t
    WHERE t.kanban_id = v.kanban_id AND t.nome = v.nome
  );

UPDATE public.kanban_tags t
SET cor = v.cor
FROM (
  VALUES
    ('6463af1d-850d-4958-b74c-404f8d668e21'::uuid, '1ª tranche', '#0c2633'),
    ('6463af1d-850d-4958-b74c-404f8d668e21'::uuid, '2ª tranche', '#2f4a3a'),
    ('6463af1d-850d-4958-b74c-404f8d668e21'::uuid, '3ª tranche', '#4a3929'),
    ('6463af1d-850d-4958-b74c-404f8d668e21'::uuid, '4ª tranche', '#d4ad68'),
    ('6463af1d-850d-4958-b74c-404f8d668e21'::uuid, '5ª tranche', '#3e7490'),
    ('6463af1d-850d-4958-b74c-404f8d668e21'::uuid, '6ª tranche', '#365848')
) AS v(kanban_id, nome, cor)
WHERE t.kanban_id = v.kanban_id AND t.nome = v.nome;

-- Backfill: todos os cards existentes no Funil Crédito Obra recebem tag 1ª tranche
INSERT INTO public.kanban_card_tags (card_id, tag_id)
SELECT kc.id, t.id
FROM public.kanban_cards kc
INNER JOIN public.kanban_tags t
  ON t.kanban_id = kc.kanban_id AND t.nome = '1ª tranche'
WHERE kc.kanban_id = '6463af1d-850d-4958-b74c-404f8d668e21'::uuid
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_card_tags ct
    INNER JOIN public.kanban_tags tt ON tt.id = ct.tag_id
    WHERE ct.card_id = kc.id
      AND tt.nome IN (
        '1ª tranche', '2ª tranche', '3ª tranche',
        '4ª tranche', '5ª tranche', '6ª tranche'
      )
  );

-- Vínculos Operações: referência ao card filho criado por tranche (2ª–6ª)
ALTER TABLE public.kanban_operacoes_tranche_vinculos
  ADD COLUMN IF NOT EXISTS credito_obra_card_id uuid REFERENCES public.kanban_cards (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.kanban_operacoes_tranche_vinculos.credito_obra_card_id IS
  'Card filho criado no Funil Crédito Obra ao concluir o vínculo (2ª–6ª tranche).';

-- Índices legados 1–5 → números de tranche 2–6
UPDATE public.kanban_operacoes_tranche_vinculos
SET tranche_index = tranche_index + 1
WHERE tranche_index BETWEEN 1 AND 5;

ALTER TABLE public.kanban_operacoes_tranche_vinculos
  DROP CONSTRAINT IF EXISTS kanban_operacoes_tranche_vinculos_tranche_index_check;

ALTER TABLE public.kanban_operacoes_tranche_vinculos
  ADD CONSTRAINT kanban_operacoes_tranche_vinculos_tranche_index_check
  CHECK (tranche_index BETWEEN 2 AND 6);

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('495', 'credito_obra_tags_tranche_vinculos')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
