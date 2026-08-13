-- 523: Cards no Funil Loteadores para os 3 cadastros seed (522).
-- Não altera rede_loteadores. Idempotente. Primeira fase = Primeiro Contato.
-- Garante FK rede_loteador_id (migration 332) caso ainda não aplicada.

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS rede_loteador_id UUID REFERENCES public.rede_loteadores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kanban_cards_rede_loteador_id
  ON public.kanban_cards (rede_loteador_id);

INSERT INTO public.kanban_cards (
  kanban_id,
  fase_id,
  franqueado_id,
  titulo,
  status,
  arquivado,
  concluido,
  nome_condominio,
  rede_loteador_id
)
SELECT
  k.id,
  f.id,
  owner.id,
  ('LO' || lpad(
    COALESCE(NULLIF(regexp_replace(upper(btrim(rl.n_loteador)), '^LO', ''), '')::int, 0)::text,
    4, '0'
  ) || ' - ' || COALESCE(NULLIF(btrim(rl.condominio_nome), ''), btrim(rl.nome))),
  'ativo',
  false,
  false,
  COALESCE(NULLIF(btrim(rl.condominio_nome), ''), btrim(rl.nome)),
  rl.id
FROM public.rede_loteadores rl
CROSS JOIN (
  SELECT id
  FROM public.kanbans
  WHERE id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
  LIMIT 1
) k
CROSS JOIN LATERAL (
  SELECT COALESCE(
    (
      SELECT u.id
      FROM auth.users u
      JOIN public.profiles p ON p.id = u.id
      WHERE p.role IN ('admin', 'team')
      ORDER BY
        CASE
          WHEN lower(u.email) = 'helenna.luz@moni.casa' THEN 0
          WHEN lower(u.email) LIKE 'ingrid%' THEN 1
          ELSE 2
        END
      LIMIT 1
    ),
    (
      SELECT c.franqueado_id
      FROM public.kanban_cards c
      WHERE c.kanban_id = k.id
        AND c.franqueado_id IS NOT NULL
      LIMIT 1
    )
  ) AS id
) owner
CROSS JOIN LATERAL (
  SELECT id
  FROM public.kanban_fases
  WHERE kanban_id = k.id
    AND (
      slug = 'primeiro_contato_moni_inc'
      OR slug = 'loteador_cadastro'
      OR lower(btrim(nome)) = 'primeiro contato'
    )
  ORDER BY
    CASE WHEN slug = 'primeiro_contato_moni_inc' THEN 0
         WHEN slug = 'loteador_cadastro' THEN 1
         ELSE 2 END,
    ordem
  LIMIT 1
) f
WHERE lower(btrim(rl.nome)) IN (
  'boulevard guarapari',
  'montebelluna',
  'vila castela'
)
AND NOT EXISTS (
  SELECT 1
  FROM public.kanban_cards c
  WHERE c.kanban_id = k.id
    AND c.rede_loteador_id = rl.id
);

-- Garante a coluna inicial visível no board (DEV tinha Primeiro Contato inativo).
UPDATE public.kanban_fases
SET ativo = true
WHERE kanban_id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
  AND slug IN ('loteador_cadastro', 'primeiro_contato_moni_inc')
  AND COALESCE(ativo, true) = false;

NOTIFY pgrst, 'reload schema';

-- Reversão:
-- DELETE FROM public.kanban_cards
-- WHERE kanban_id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'
--   AND rede_loteador_id IN (
--     SELECT id FROM public.rede_loteadores
--     WHERE lower(btrim(nome)) IN ('boulevard guarapari','montebelluna','vila castela')
--   );
