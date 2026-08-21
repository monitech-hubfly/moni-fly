-- 289: Normaliza títulos de kanban_cards — FK (+ condomínio/quadra/lote), sem nome do franqueado.

-- 1) Cards vinculados à rede: título canônico a partir de n_franquia.
UPDATE public.kanban_cards kc
SET titulo = sub.novo_titulo,
    updated_at = now()
FROM (
  SELECT
    kc2.id,
    NULLIF(
      TRIM(
        CONCAT_WS(
          ' - ',
          NULLIF(TRIM(rf.n_franquia), ''),
          NULLIF(TRIM(kc2.nome_condominio), ''),
          NULLIF(TRIM(kc2.quadra), ''),
          NULLIF(TRIM(kc2.lote), '')
        )
      ),
      ''
    ) AS novo_titulo
  FROM public.kanban_cards kc2
  INNER JOIN public.rede_franqueados rf ON rf.id = kc2.rede_franqueado_id
  WHERE NULLIF(TRIM(rf.n_franquia), '') IS NOT NULL
) sub
WHERE kc.id = sub.id
  AND sub.novo_titulo IS NOT NULL
  AND COALESCE(TRIM(kc.titulo), '') IS DISTINCT FROM sub.novo_titulo;

-- 2) Títulos legados `FK - Nome do franqueado - …` (remove o segmento do nome).
UPDATE public.kanban_cards kc
SET titulo = sub.novo_titulo,
    updated_at = now()
FROM (
  SELECT
    kc2.id,
    CASE
      WHEN kc2.titulo ~* '^FK[0-9]+ - .+ - .+' THEN
        regexp_replace(kc2.titulo, '^((FK[0-9]+)) - [^-]+ - ', '\1 - ', 'i')
      WHEN kc2.titulo ~* '^FK[0-9]+ - .+$' THEN
        regexp_replace(kc2.titulo, '^((FK[0-9]+)) - .+$', '\1', 'i')
      ELSE kc2.titulo
    END AS novo_titulo
  FROM public.kanban_cards kc2
  WHERE kc2.titulo IS NOT NULL
    AND kc2.titulo ~* '^FK[0-9]+ - .+$'
) sub
WHERE kc.id = sub.id
  AND sub.novo_titulo IS NOT NULL
  AND COALESCE(TRIM(kc.titulo), '') IS DISTINCT FROM sub.novo_titulo;
