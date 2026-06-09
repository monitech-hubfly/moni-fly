-- 293: Recupera condominio_id e campos relacionados em cards de Portfólio/Acoplamento/Operações.

-- processo_step_one → kanban_cards (id ou projeto_id)
UPDATE public.kanban_cards k
SET
  condominio_id = p.condominio_id,
  nome_condominio = COALESCE(NULLIF(trim(k.nome_condominio), ''), NULLIF(trim(p.nome_condominio), '')),
  quadra = COALESCE(NULLIF(trim(k.quadra), ''), NULLIF(trim(p.quadra), '')),
  lote = COALESCE(NULLIF(trim(k.lote), ''), NULLIF(trim(p.lote), '')),
  updated_at = now()
FROM public.processo_step_one p
WHERE k.condominio_id IS NULL
  AND p.condominio_id IS NOT NULL
  AND (
    k.id = p.id
    OR (k.projeto_id IS NOT NULL AND k.projeto_id = p.id)
  );

-- nome_condominio a partir do cadastro quando só há FK
UPDATE public.kanban_cards k
SET
  nome_condominio = COALESCE(NULLIF(trim(k.nome_condominio), ''), NULLIF(trim(c.nome), '')),
  updated_at = now()
FROM public.condominios c
WHERE k.condominio_id = c.id
  AND NULLIF(trim(k.nome_condominio), '') IS NULL
  AND NULLIF(trim(c.nome), '') IS NOT NULL;

-- Herança origem_card_id (filhos Acoplamento/Operações/Crédito Obra)
DO $$
DECLARE
  i int;
BEGIN
  FOR i IN 1..32 LOOP
    UPDATE public.kanban_cards filho
    SET
      condominio_id = coalesce(filho.condominio_id, pai.condominio_id),
      nome_condominio = coalesce(NULLIF(trim(filho.nome_condominio), ''), NULLIF(trim(pai.nome_condominio), '')),
      quadra = coalesce(NULLIF(trim(filho.quadra), ''), NULLIF(trim(pai.quadra), '')),
      lote = coalesce(NULLIF(trim(filho.lote), ''), NULLIF(trim(pai.lote), '')),
      updated_at = now()
    FROM public.kanban_cards pai
    WHERE filho.origem_card_id = pai.id
      AND (
        (filho.condominio_id IS NULL AND pai.condominio_id IS NOT NULL)
        OR (NULLIF(trim(filho.nome_condominio), '') IS NULL AND NULLIF(trim(pai.nome_condominio), '') IS NOT NULL)
        OR (NULLIF(trim(filho.quadra), '') IS NULL AND NULLIF(trim(pai.quadra), '') IS NOT NULL)
        OR (NULLIF(trim(filho.lote), '') IS NULL AND NULLIF(trim(pai.lote), '') IS NOT NULL)
      );
  END LOOP;
END $$;

-- Mesmo projeto_id: propaga condominio_id entre cards paralelos
DO $$
DECLARE
  i int;
BEGIN
  FOR i IN 1..8 LOOP
    UPDATE public.kanban_cards alvo
    SET
      condominio_id = coalesce(alvo.condominio_id, fonte.condominio_id),
      nome_condominio = coalesce(NULLIF(trim(alvo.nome_condominio), ''), NULLIF(trim(fonte.nome_condominio), '')),
      quadra = coalesce(NULLIF(trim(alvo.quadra), ''), NULLIF(trim(fonte.quadra), '')),
      lote = coalesce(NULLIF(trim(alvo.lote), ''), NULLIF(trim(fonte.lote), '')),
      updated_at = now()
    FROM public.kanban_cards fonte
    WHERE alvo.projeto_id IS NOT NULL
      AND alvo.projeto_id = fonte.projeto_id
      AND alvo.id <> fonte.id
      AND (
        (alvo.condominio_id IS NULL AND fonte.condominio_id IS NOT NULL)
        OR (NULLIF(trim(alvo.nome_condominio), '') IS NULL AND NULLIF(trim(fonte.nome_condominio), '') IS NOT NULL)
        OR (NULLIF(trim(alvo.quadra), '') IS NULL AND NULLIF(trim(fonte.quadra), '') IS NOT NULL)
        OR (NULLIF(trim(alvo.lote), '') IS NULL AND NULLIF(trim(fonte.lote), '') IS NOT NULL)
      );
  END LOOP;
END $$;
