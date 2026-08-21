-- Preenche n_franquia a partir de ordem quando o número só estava na coluna ordem (legado / import duplicado).
-- Rode uma vez no Supabase SQL Editor se a tabela mostrar FK fora de ordem.

UPDATE public.rede_franqueados
SET n_franquia = 'FK' || lpad(ordem::text, 4, '0')
WHERE (n_franquia IS NULL OR btrim(n_franquia) = '')
  AND ordem >= 0
  AND ordem <= 9999;
