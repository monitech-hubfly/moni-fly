-- 260: Repara títulos curtos em cards filhos (esteiras paralelas / bastões).
-- Padrão: FK0001 - Nome Condomínio - Quadra - Lote (montarTituloCardSync).

DO $$
DECLARE
  i int;
BEGIN
  FOR i IN 1..32 LOOP
    UPDATE kanban_cards filho
    SET
      titulo = CASE
        WHEN length(trim(coalesce(pai.titulo, ''))) > length(trim(coalesce(filho.titulo, '')))
          THEN pai.titulo
        ELSE filho.titulo
      END,
      nome_condominio = coalesce(filho.nome_condominio, pai.nome_condominio),
      quadra = coalesce(filho.quadra, pai.quadra),
      lote = coalesce(filho.lote, pai.lote),
      rede_franqueado_id = coalesce(filho.rede_franqueado_id, pai.rede_franqueado_id),
      condominio_id = coalesce(filho.condominio_id, pai.condominio_id)
    FROM kanban_cards pai
    WHERE filho.origem_card_id = pai.id
      AND (
        length(trim(coalesce(pai.titulo, ''))) > length(trim(coalesce(filho.titulo, '')))
        OR (filho.nome_condominio IS NULL AND pai.nome_condominio IS NOT NULL)
        OR (filho.quadra IS NULL AND pai.quadra IS NOT NULL)
        OR (filho.lote IS NULL AND pai.lote IS NOT NULL)
      );
  END LOOP;
END $$;

UPDATE kanban_cards k
SET titulo = calc.titulo_novo
FROM (
  SELECT
    kc.id,
    nullif(
      trim(
        concat_ws(
          ' - ',
          rf.n_franquia,
          kc.nome_condominio,
          kc.quadra,
          kc.lote
        )
      ),
      ''
    ) AS titulo_novo
  FROM kanban_cards kc
  LEFT JOIN rede_franqueados rf ON rf.id = kc.rede_franqueado_id
  WHERE kc.rede_franqueado_id IS NOT NULL
    AND (
      kc.nome_condominio IS NOT NULL
      OR kc.quadra IS NOT NULL
      OR kc.lote IS NOT NULL
    )
) calc
WHERE k.id = calc.id
  AND calc.titulo_novo IS NOT NULL
  AND (
    k.titulo IS NULL
    OR length(trim(calc.titulo_novo)) > length(trim(coalesce(k.titulo, '')))
  );

-- Mesmo projeto: propaga o título mais completo entre cards paralelos.
DO $$
DECLARE
  i int;
BEGIN
  FOR i IN 1..8 LOOP
    UPDATE kanban_cards alvo
    SET titulo = fonte.titulo
    FROM kanban_cards fonte
    WHERE alvo.projeto_id IS NOT NULL
      AND alvo.projeto_id = fonte.projeto_id
      AND alvo.id <> fonte.id
      AND length(trim(coalesce(fonte.titulo, ''))) > length(trim(coalesce(alvo.titulo, '')));
  END LOOP;
END $$;
