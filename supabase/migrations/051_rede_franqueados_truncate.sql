-- Apagar todos os registros da tabela rede_franqueados.
-- Desvincula referências em processo_step_one para permitir o TRUNCATE; depois esvazia a tabela.

UPDATE public.processo_step_one
SET origem_rede_franqueados_id = NULL
WHERE origem_rede_franqueados_id IS NOT NULL;

TRUNCATE TABLE public.rede_franqueados RESTART IDENTITY;
