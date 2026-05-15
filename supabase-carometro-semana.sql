-- Status por semana para cada comportamento-chave do Carômetro (monitoramento como no GANTT).
-- Rode no Supabase → SQL Editor (uma vez).
CREATE TABLE IF NOT EXISTS carometro_semana (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carometro_id uuid NOT NULL REFERENCES carometro(id) ON DELETE CASCADE,
  semana int NOT NULL CHECK (semana >= 1 AND semana <= 13),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluido')),
  criado_em timestamptz DEFAULT now(),
  UNIQUE(carometro_id, semana)
);
