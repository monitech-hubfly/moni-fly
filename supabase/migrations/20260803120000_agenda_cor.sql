-- Esquema de cores na Agenda (TO DO & Planning)
-- gantt_planejamento.cor: override de cor por entrada (definido pelo usuário no modal)
-- objetivos.cor: cor padrão da meta (para uso futuro na gestão de objetivos)

ALTER TABLE gantt_planejamento ADD COLUMN IF NOT EXISTS cor text;
ALTER TABLE objetivos          ADD COLUMN IF NOT EXISTS cor text;

NOTIFY pgrst, 'reload schema';
