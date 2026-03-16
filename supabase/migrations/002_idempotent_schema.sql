-- Use este script se o 001 deu erro "relation profiles already exists".
-- Ele cria só o que ainda não existe e ajusta políticas e trigger.

-- Tabelas (só cria se não existir)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'frank' CHECK (role IN ('frank', 'consultor', 'admin')),
  full_name TEXT,
  email TEXT,
  consultor_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.processo_step_one (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cidade TEXT NOT NULL,
  estado TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'em_andamento', 'concluido')),
  etapa_atual INT NOT NULL DEFAULT 1 CHECK (etapa_atual >= 1 AND etapa_atual <= 11),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.etapa_progresso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  etapa_id INT NOT NULL CHECK (etapa_id >= 1 AND etapa_id <= 11),
  status TEXT NOT NULL DEFAULT 'nao_iniciada' CHECK (status IN ('nao_iniciada', 'em_andamento', 'concluida', 'refeita')),
  iniciada_em TIMESTAMPTZ,
  concluida_em TIMESTAMPTZ,
  tentativas INT NOT NULL DEFAULT 0,
  dados_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(processo_id, etapa_id)
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  acao TEXT NOT NULL,
  recurso TEXT,
  recurso_id TEXT,
  ip INET,
  snapshot_antes JSONB,
  snapshot_depois JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pdf_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  hipotese TEXT,
  modelo_escolhido TEXT,
  file_size INT,
  file_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.apify_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  processo_id UUID REFERENCES public.processo_step_one(id),
  condominio TEXT,
  resultados INT,
  custo_usd NUMERIC(10,4),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  mensagem TEXT,
  lido BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rede_contatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  processo_id UUID REFERENCES public.processo_step_one(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('condominio', 'corretor', 'imobiliaria')),
  nome TEXT NOT NULL,
  contato TEXT,
  dados_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices (só cria se não existir)
CREATE INDEX IF NOT EXISTS idx_etapa_progresso_user ON public.etapa_progresso(user_id);
CREATE INDEX IF NOT EXISTS idx_etapa_progresso_processo ON public.etapa_progresso(processo_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_pdf_exports_user ON public.pdf_exports(user_id);
CREATE INDEX IF NOT EXISTS idx_apify_usage_user ON public.apify_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_processo_user ON public.processo_step_one(user_id);

-- Função para evitar recursão nas policies de profiles (lê role sem passar pelo RLS)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- RLS: perfis (remove políticas antigas se existirem, depois cria; usa get_my_role() para evitar recursão)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Consultor can read Franks in portfolio" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin can read all profiles" ON public.profiles FOR SELECT USING (public.get_my_role() = 'admin');
CREATE POLICY "Consultor can read Franks in portfolio" ON public.profiles FOR SELECT USING (
  public.get_my_role() = 'consultor' AND consultor_id = auth.uid()
);

-- RLS: processo_step_one
ALTER TABLE public.processo_step_one ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Frank sees own processes" ON public.processo_step_one;
DROP POLICY IF EXISTS "Consultor sees portfolio processes" ON public.processo_step_one;
DROP POLICY IF EXISTS "Admin sees all processes" ON public.processo_step_one;
CREATE POLICY "Frank sees own processes" ON public.processo_step_one FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Consultor sees portfolio processes" ON public.processo_step_one FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.consultor_id = auth.uid())
);
CREATE POLICY "Admin sees all processes" ON public.processo_step_one FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- RLS: etapa_progresso
ALTER TABLE public.etapa_progresso ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Frank owns etapa_progresso" ON public.etapa_progresso;
DROP POLICY IF EXISTS "Consultor reads portfolio etapa_progresso" ON public.etapa_progresso;
DROP POLICY IF EXISTS "Admin all etapa_progresso" ON public.etapa_progresso;
CREATE POLICY "Frank owns etapa_progresso" ON public.etapa_progresso FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Consultor reads portfolio etapa_progresso" ON public.etapa_progresso FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.consultor_id = auth.uid())
);
CREATE POLICY "Admin all etapa_progresso" ON public.etapa_progresso FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- RLS: audit_log
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin reads audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "Service role inserts audit_log" ON public.audit_log;
CREATE POLICY "Admin reads audit_log" ON public.audit_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "Service role inserts audit_log" ON public.audit_log FOR INSERT WITH CHECK (true);

-- RLS: pdf_exports
ALTER TABLE public.pdf_exports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Frank own pdf_exports" ON public.pdf_exports;
DROP POLICY IF EXISTS "Consultor reads portfolio pdf_exports" ON public.pdf_exports;
DROP POLICY IF EXISTS "Admin all pdf_exports" ON public.pdf_exports;
CREATE POLICY "Frank own pdf_exports" ON public.pdf_exports FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Consultor reads portfolio pdf_exports" ON public.pdf_exports FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.consultor_id = auth.uid())
);
CREATE POLICY "Admin all pdf_exports" ON public.pdf_exports FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- RLS: apify_usage
ALTER TABLE public.apify_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Frank own apify_usage" ON public.apify_usage;
DROP POLICY IF EXISTS "Consultor reads portfolio apify_usage" ON public.apify_usage;
DROP POLICY IF EXISTS "Admin all apify_usage" ON public.apify_usage;
CREATE POLICY "Frank own apify_usage" ON public.apify_usage FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Consultor reads portfolio apify_usage" ON public.apify_usage FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.consultor_id = auth.uid())
);
CREATE POLICY "Admin all apify_usage" ON public.apify_usage FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- RLS: alertas
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User own alertas" ON public.alertas;
CREATE POLICY "User own alertas" ON public.alertas FOR ALL USING (user_id = auth.uid());

-- RLS: rede_contatos
ALTER TABLE public.rede_contatos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Frank own rede_contatos" ON public.rede_contatos;
DROP POLICY IF EXISTS "Consultor reads portfolio rede" ON public.rede_contatos;
DROP POLICY IF EXISTS "Admin all rede_contatos" ON public.rede_contatos;
CREATE POLICY "Frank own rede_contatos" ON public.rede_contatos FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Consultor reads portfolio rede" ON public.rede_contatos FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.consultor_id = auth.uid())
);
CREATE POLICY "Admin all rede_contatos" ON public.rede_contatos FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Função e trigger: criar perfil quando novo usuário se cadastra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name, email)
  VALUES (NEW.id, 'frank', NEW.raw_user_meta_data->>'full_name', NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
