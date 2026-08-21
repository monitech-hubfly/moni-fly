-- 206: Kanban Funil Loteadores + fases do fluxo de qualificação (idempotente no kanban; fases substituídas).

INSERT INTO public.kanbans (nome, descricao, ativo)
SELECT 'Funil Loteadores', 'Qualificação e encaminhamento de loteadores', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanbans WHERE nome = 'Funil Loteadores'
);

-- Legado: renomear Moní INC se ainda existir com o nome antigo.
UPDATE public.kanbans
SET
  nome = 'Funil Loteadores',
  descricao = COALESCE(NULLIF(btrim(descricao), ''), 'Qualificação e encaminhamento de loteadores')
WHERE nome = 'Funil Moní INC';

-- Remove fases anteriores (ex.: Moní INC); cards nessas fases são removidos por ON DELETE CASCADE.
DELETE FROM public.kanban_fases
WHERE kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil Loteadores' LIMIT 1);

INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo, instrucoes, materiais)
SELECT
  k.id,
  f.nome,
  f.slug,
  f.ordem,
  f.sla_dias,
  true,
  NULL,
  '[]'::jsonb
FROM public.kanbans k
CROSS JOIN (
  VALUES
    ('Cadastro do loteador', 'loteador_cadastro', 1, 2),
    ('Análise de portfólio', 'loteador_analise', 2, 5),
    ('Aguardando documentação', 'loteador_docs', 3, 10),
    ('Encaminhamento Jurídico', 'loteador_juridico', 4, 1),
    ('Concluído', 'loteador_concluido', 5, NULL::integer)
) AS f(nome, slug, ordem, sla_dias)
WHERE k.nome = 'Funil Loteadores'
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases kf
    WHERE kf.kanban_id = k.id
      AND kf.slug = f.slug
  );
