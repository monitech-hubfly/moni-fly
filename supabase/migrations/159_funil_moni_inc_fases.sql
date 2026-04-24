-- 159: Funil Moní INC — substituir todas as fases atuais pelas fases do fluxo Moní INC.
-- Remove qualquer cópia do Step One (slugs com sufixo _moni_inc ou legado) sem depender da lista exacta.
-- Atenção: FK em kanban_cards(fase_id) com ON DELETE CASCADE remove cards que estavam nessas fases.

DELETE FROM public.kanban_fases
WHERE kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil Moní INC' LIMIT 1);

INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo, instrucoes, materiais)
SELECT
  k.id,
  f.nome,
  f.slug,
  f.ordem,
  7,
  true,
  NULL,
  '[]'::jsonb
FROM public.kanbans k
CROSS JOIN (
  VALUES
    ('Primeiro Contato', 'primeiro_contato_moni_inc', 1),
    ('R1 Executada: "Conceito"', 'r1_conceito_moni_inc', 2),
    ('R2 Apresentar Plano Teórico', 'r2_plano_teorico_moni_inc', 3),
    ('R3 Ajustes Finais nas Propostas', 'r3_ajustes_finais_moni_inc', 4),
    ('Fechar Contrato', 'fechar_contrato_moni_inc', 5)
) AS f(nome, slug, ordem)
WHERE k.nome = 'Funil Moní INC'
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases kf
    WHERE kf.kanban_id = k.id
      AND kf.slug = f.slug
  );
