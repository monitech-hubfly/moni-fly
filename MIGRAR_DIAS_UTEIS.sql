-- ========================================
-- MIGRAÇÃO: Dias Úteis e Feriados
-- Copie e execute este script completo no Supabase Dashboard > SQL Editor
-- ========================================

-- 1️⃣ Criar tabela de feriados nacionais
CREATE TABLE IF NOT EXISTS public.feriados_nacionais (
  id         SERIAL PRIMARY KEY,
  data       DATE NOT NULL UNIQUE,
  nome       TEXT NOT NULL,
  fixo       BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT uk_feriados_data UNIQUE (data)
);

COMMENT ON TABLE public.feriados_nacionais IS 'Feriados nacionais brasileiros para cálculo de dias úteis no SLA.';

-- 2️⃣ Inserir feriados nacionais 2025-2027
INSERT INTO public.feriados_nacionais (data, nome, fixo) VALUES
  -- 2025
  ('2025-01-01', 'Ano Novo', true),
  ('2025-04-18', 'Paixão de Cristo', false),
  ('2025-04-21', 'Tiradentes', true),
  ('2025-05-01', 'Dia do Trabalho', true),
  ('2025-06-19', 'Corpus Christi', false),
  ('2025-09-07', 'Independência', true),
  ('2025-10-12', 'Nossa Senhora Aparecida', true),
  ('2025-11-02', 'Finados', true),
  ('2025-11-15', 'Proclamação da República', true),
  ('2025-12-25', 'Natal', true),
  
  -- 2026
  ('2026-01-01', 'Ano Novo', true),
  ('2026-02-16', 'Carnaval', false),
  ('2026-02-17', 'Carnaval', false),
  ('2026-04-03', 'Paixão de Cristo', false),
  ('2026-04-21', 'Tiradentes', true),
  ('2026-05-01', 'Dia do Trabalho', true),
  ('2026-06-04', 'Corpus Christi', false),
  ('2026-09-07', 'Independência', true),
  ('2026-10-12', 'Nossa Senhora Aparecida', true),
  ('2026-11-02', 'Finados', true),
  ('2026-11-15', 'Proclamação da República', true),
  ('2026-12-25', 'Natal', true),
  
  -- 2027
  ('2027-01-01', 'Ano Novo', true),
  ('2027-02-08', 'Carnaval', false),
  ('2027-02-09', 'Carnaval', false),
  ('2027-03-26', 'Paixão de Cristo', false),
  ('2027-04-21', 'Tiradentes', true),
  ('2027-05-01', 'Dia do Trabalho', true),
  ('2027-05-27', 'Corpus Christi', false),
  ('2027-09-07', 'Independência', true),
  ('2027-10-12', 'Nossa Senhora Aparecida', true),
  ('2027-11-02', 'Finados', true),
  ('2027-11-15', 'Proclamação da República', true),
  ('2027-12-25', 'Natal', true)
ON CONFLICT (data) DO NOTHING;

-- 3️⃣ Função: Calcular Dias Úteis
CREATE OR REPLACE FUNCTION public.calcular_dias_uteis(
  data_inicio DATE,
  data_fim DATE
)
RETURNS INT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  dias_uteis INT := 0;
  data_atual DATE := data_inicio;
  dia_semana INT;
  eh_feriado BOOLEAN;
BEGIN
  IF data_fim < data_inicio THEN
    RETURN 0;
  END IF;

  WHILE data_atual <= data_fim LOOP
    dia_semana := EXTRACT(DOW FROM data_atual);
    
    SELECT EXISTS(
      SELECT 1 FROM public.feriados_nacionais
      WHERE data = data_atual
    ) INTO eh_feriado;
    
    IF dia_semana NOT IN (0, 6) AND NOT eh_feriado THEN
      dias_uteis := dias_uteis + 1;
    END IF;
    
    data_atual := data_atual + 1;
  END LOOP;

  RETURN dias_uteis;
END;
$$;

COMMENT ON FUNCTION public.calcular_dias_uteis IS 'Calcula dias úteis entre duas datas, excluindo sábados, domingos e feriados nacionais.';

-- 4️⃣ Função: Adicionar Dias Úteis a uma Data
CREATE OR REPLACE FUNCTION public.adicionar_dias_uteis(
  data_base DATE,
  dias_uteis_add INT
)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  dias_adicionados INT := 0;
  data_atual DATE := data_base;
  dia_semana INT;
  eh_feriado BOOLEAN;
BEGIN
  IF dias_uteis_add <= 0 THEN
    RETURN data_base;
  END IF;

  WHILE dias_adicionados < dias_uteis_add LOOP
    data_atual := data_atual + 1;
    dia_semana := EXTRACT(DOW FROM data_atual);
    
    SELECT EXISTS(
      SELECT 1 FROM public.feriados_nacionais
      WHERE data = data_atual
    ) INTO eh_feriado;
    
    IF dia_semana NOT IN (0, 6) AND NOT eh_feriado THEN
      dias_adicionados := dias_adicionados + 1;
    END IF;
  END LOOP;

  RETURN data_atual;
END;
$$;

COMMENT ON FUNCTION public.adicionar_dias_uteis IS 'Adiciona N dias úteis a uma data base, pulando fins de semana e feriados.';

-- ========================================
-- ✅ TESTES DE VALIDAÇÃO
-- ========================================

-- Teste 1: Calcular dias úteis entre duas datas
SELECT 
  '2026-04-13'::DATE as inicio,
  '2026-04-22'::DATE as fim,
  public.calcular_dias_uteis('2026-04-13'::DATE, '2026-04-22'::DATE) as dias_uteis;

-- Teste 2: Adicionar 5 dias úteis a uma data
SELECT 
  '2026-04-15'::DATE as data_base,
  public.adicionar_dias_uteis('2026-04-15'::DATE, 5) as prazo_5_dias_uteis;

-- Teste 3: Contar feriados de 2026
SELECT COUNT(*) as total_feriados_2026 
FROM public.feriados_nacionais 
WHERE EXTRACT(YEAR FROM data) = 2026;

-- Teste 4: Listar próximos feriados
SELECT data, nome, 
  CASE WHEN fixo THEN 'Fixo' ELSE 'Móvel' END as tipo
FROM public.feriados_nacionais 
WHERE data >= CURRENT_DATE 
ORDER BY data 
LIMIT 10;

-- ========================================
-- 🎉 MIGRAÇÃO CONCLUÍDA!
-- Se todos os testes acima retornaram resultados,
-- a migração foi bem-sucedida.
-- ========================================
