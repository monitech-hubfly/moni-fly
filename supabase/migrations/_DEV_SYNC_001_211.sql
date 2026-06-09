-- Perfis: Frank, Consultor, Admin (vinculado ao auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'frank' CHECK (role IN ('frank', 'consultor', 'admin')),
  full_name TEXT,
  email TEXT,
  consultor_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Processo Step One (um por Frank/cidade)
CREATE TABLE public.processo_step_one (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cidade TEXT NOT NULL,
  estado TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'em_andamento', 'concluido')),
  etapa_atual INT NOT NULL DEFAULT 1 CHECK (etapa_atual >= 1 AND etapa_atual <= 11),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Progresso por etapa (Frank x processo x etapa)
CREATE TABLE public.etapa_progresso (
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

-- Log de auditoria (imutÃ¡vel: sÃ³ INSERT)
CREATE TABLE public.audit_log (
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

-- PDFs exportados
CREATE TABLE public.pdf_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  hipotese TEXT,
  modelo_escolhido TEXT,
  file_size INT,
  file_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Uso Apify (custo por Frank)
CREATE TABLE public.apify_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  processo_id UUID REFERENCES public.processo_step_one(id),
  condominio TEXT,
  resultados INT,
  custo_usd NUMERIC(10,4),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Alertas (triggers: inatividade, PDF nÃ£o enviado, limite Apify...)
CREATE TABLE public.alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  mensagem TEXT,
  lido BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Rede: condomÃ­nios, corretores, imobiliÃ¡rias
CREATE TABLE public.rede_contatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  processo_id UUID REFERENCES public.processo_step_one(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('condominio', 'corretor', 'imobiliaria')),
  nome TEXT NOT NULL,
  contato TEXT,
  dados_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ãndices
CREATE INDEX idx_etapa_progresso_user ON public.etapa_progresso(user_id);
CREATE INDEX idx_etapa_progresso_processo ON public.etapa_progresso(processo_id);
CREATE INDEX idx_audit_log_user ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_created ON public.audit_log(created_at);
CREATE INDEX idx_pdf_exports_user ON public.pdf_exports(user_id);
CREATE INDEX idx_apify_usage_user ON public.apify_usage(user_id);
CREATE INDEX idx_processo_user ON public.processo_step_one(user_id);

-- RLS: perfis
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin can read all profiles" ON public.profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "Consultor can read Franks in portfolio" ON public.profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'consultor' AND (p.id = consultor_id OR p.consultor_id = auth.uid()))
);

-- RLS: processo_step_one â€” Frank sÃ³ vÃª os seus; consultor vÃª dos Franks da carteira; admin vÃª todos
ALTER TABLE public.processo_step_one ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Frank sees own processes" ON public.processo_step_one FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Consultor sees portfolio processes" ON public.processo_step_one FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.consultor_id = auth.uid())
);
CREATE POLICY "Admin sees all processes" ON public.processo_step_one FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- RLS: etapa_progresso (mesma lÃ³gica por user_id)
ALTER TABLE public.etapa_progresso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Frank owns etapa_progresso" ON public.etapa_progresso FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Consultor reads portfolio etapa_progresso" ON public.etapa_progresso FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.consultor_id = auth.uid())
);
CREATE POLICY "Admin all etapa_progresso" ON public.etapa_progresso FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- RLS: audit_log, pdf_exports, apify_usage, alertas, rede_contatos (Frank prÃ³prio; consultor/admin conforme perfil)
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin reads audit_log" ON public.audit_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "Service role inserts audit_log" ON public.audit_log FOR INSERT WITH CHECK (true);

ALTER TABLE public.pdf_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Frank own pdf_exports" ON public.pdf_exports FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Consultor reads portfolio pdf_exports" ON public.pdf_exports FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.consultor_id = auth.uid())
);
CREATE POLICY "Admin all pdf_exports" ON public.pdf_exports FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

ALTER TABLE public.apify_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Frank own apify_usage" ON public.apify_usage FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Consultor reads portfolio apify_usage" ON public.apify_usage FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.consultor_id = auth.uid())
);
CREATE POLICY "Admin all apify_usage" ON public.apify_usage FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User own alertas" ON public.alertas FOR ALL USING (user_id = auth.uid());

ALTER TABLE public.rede_contatos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Frank own rede_contatos" ON public.rede_contatos FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Consultor reads portfolio rede" ON public.rede_contatos FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.consultor_id = auth.uid())
);
CREATE POLICY "Admin all rede_contatos" ON public.rede_contatos FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Trigger: criar profile ao signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name, email)
  VALUES (NEW.id, 'frank', NEW.raw_user_meta_data->>'full_name', NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
-- Use este script se o 001 deu erro "relation profiles already exists".
-- Ele cria sÃ³ o que ainda nÃ£o existe e ajusta polÃ­ticas e trigger.

-- Tabelas (sÃ³ cria se nÃ£o existir)
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

-- Ãndices (sÃ³ cria se nÃ£o existir)
CREATE INDEX IF NOT EXISTS idx_etapa_progresso_user ON public.etapa_progresso(user_id);
CREATE INDEX IF NOT EXISTS idx_etapa_progresso_processo ON public.etapa_progresso(processo_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_pdf_exports_user ON public.pdf_exports(user_id);
CREATE INDEX IF NOT EXISTS idx_apify_usage_user ON public.apify_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_processo_user ON public.processo_step_one(user_id);

-- FunÃ§Ã£o para evitar recursÃ£o nas policies de profiles (lÃª role sem passar pelo RLS)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- RLS: perfis (remove polÃ­ticas antigas se existirem, depois cria; usa get_my_role() para evitar recursÃ£o)
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

-- FunÃ§Ã£o e trigger: criar perfil quando novo usuÃ¡rio se cadastra
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
-- Corrige "infinite recursion detected in policy for relation 'profiles'".
-- As polÃ­ticas em profiles que faziam SELECT em profiles sÃ£o reescritas
-- usando uma funÃ§Ã£o SECURITY DEFINER que lÃª o role sem passar pelo RLS.

-- FunÃ§Ã£o que retorna o role do usuÃ¡rio atual (nÃ£o dispara RLS na leitura)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Remover polÃ­ticas que causam recursÃ£o e recriar usando get_my_role()
DROP POLICY IF EXISTS "Admin can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Consultor can read Franks in portfolio" ON public.profiles;

CREATE POLICY "Admin can read all profiles" ON public.profiles
  FOR SELECT USING (public.get_my_role() = 'admin');

CREATE POLICY "Consultor can read Franks in portfolio" ON public.profiles
  FOR SELECT USING (
    public.get_my_role() = 'consultor' AND consultor_id = auth.uid()
  );
-- Sprint 4: tabelas para Etapas 4 (casas Ã  venda), 5 (lotes Ã  venda), 6 (catÃ¡logo MonÃ­), 7 (lote escolhido)

-- Casas Ã  venda (Etapa 4) â€” por processo
CREATE TABLE IF NOT EXISTS public.listings_casas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  condominio TEXT,
  recuos_permitidos TEXT,
  localizacao_condominio TEXT,
  corretor TEXT,
  area_lote_m2 NUMERIC(10,2),
  area_casa_m2 NUMERIC(10,2),
  topografia TEXT CHECK (topografia IS NULL OR topografia IN ('aclive', 'declive', 'plano')),
  medidas_frente_fundo TEXT,
  quartos INT,
  suites INT,
  banheiros INT,
  vagas INT,
  piscina BOOLEAN DEFAULT false,
  marcenaria BOOLEAN DEFAULT false,
  preco NUMERIC(14,2),
  preco_m2 NUMERIC(14,2),
  link TEXT,
  foto_url TEXT,
  data_publicacao DATE,
  data_coleta DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Lotes Ã  venda (Etapa 5) â€” por processo
CREATE TABLE IF NOT EXISTS public.listings_lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  condominio TEXT,
  area_lote_m2 NUMERIC(10,2),
  preco NUMERIC(14,2),
  preco_m2 NUMERIC(14,2),
  link TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- CatÃ¡logo MonÃ­ (Etapa 6) â€” modelos de casa (global, nÃ£o por processo)
CREATE TABLE IF NOT EXISTS public.catalogo_casas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  largura_m NUMERIC(6,2),
  profundidade_m NUMERIC(6,2),
  area_m2 NUMERIC(10,2),
  topografia TEXT CHECK (topografia IS NULL OR topografia IN ('aclive', 'declive', 'plano')),
  quartos INT,
  suites INT,
  banheiros INT,
  vagas INT,
  preco_custo NUMERIC(14,2),
  preco_venda NUMERIC(14,2),
  preco_custo_m2 NUMERIC(14,2),
  preco_venda_m2 NUMERIC(14,2),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Lote escolhido pelo franqueado (Etapa 7) â€” um por processo
CREATE TABLE IF NOT EXISTS public.lote_escolhido (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE UNIQUE,
  cidade TEXT,
  condominio TEXT,
  recuos_permitidos TEXT,
  localizacao_condominio TEXT,
  area_lote_m2 NUMERIC(10,2),
  topografia TEXT CHECK (topografia IS NULL OR topografia IN ('aclive', 'declive', 'plano')),
  frente_m NUMERIC(6,2),
  fundo_m NUMERIC(6,2),
  preco NUMERIC(14,2),
  preco_m2 NUMERIC(14,2),
  foto_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: listings_casas e listings_lotes â€” Frank sÃ³ do prÃ³prio processo (DROP IF EXISTS para poder reexecutar o script)
ALTER TABLE public.listings_casas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings_lotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Frank listings_casas" ON public.listings_casas;
CREATE POLICY "Frank listings_casas" ON public.listings_casas FOR ALL
  USING (EXISTS (SELECT 1 FROM public.processo_step_one p WHERE p.id = processo_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "Frank listings_lotes" ON public.listings_lotes;
CREATE POLICY "Frank listings_lotes" ON public.listings_lotes FOR ALL
  USING (EXISTS (SELECT 1 FROM public.processo_step_one p WHERE p.id = processo_id AND p.user_id = auth.uid()));

-- RLS: catalogo_casas â€” todos leem (Frank, consultor, admin)
ALTER TABLE public.catalogo_casas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Todos leem catalogo_casas" ON public.catalogo_casas;
CREATE POLICY "Todos leem catalogo_casas" ON public.catalogo_casas FOR SELECT USING (true);

-- RLS: lote_escolhido â€” Frank sÃ³ do prÃ³prio processo
ALTER TABLE public.lote_escolhido ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Frank lote_escolhido" ON public.lote_escolhido;
CREATE POLICY "Frank lote_escolhido" ON public.lote_escolhido FOR ALL
  USING (EXISTS (SELECT 1 FROM public.processo_step_one p WHERE p.id = processo_id AND p.user_id = auth.uid()));

-- Ãndices
CREATE INDEX IF NOT EXISTS idx_listings_casas_processo ON public.listings_casas(processo_id);
CREATE INDEX IF NOT EXISTS idx_listings_lotes_processo ON public.listings_lotes(processo_id);
CREATE INDEX IF NOT EXISTS idx_lote_escolhido_processo ON public.lote_escolhido(processo_id);

-- Seed: 2 modelos exemplo no catÃ¡logo MonÃ­ (sÃ³ insere se ainda nÃ£o existir)
INSERT INTO public.catalogo_casas (nome, largura_m, profundidade_m, area_m2, topografia, quartos, suites, banheiros, vagas, preco_venda, preco_venda_m2, ativo)
SELECT 'Modelo A', 12, 18, 180, 'plano', 3, 1, 3, 2, 1200000, 6666.67, true
WHERE NOT EXISTS (SELECT 1 FROM public.catalogo_casas WHERE nome = 'Modelo A' LIMIT 1);
INSERT INTO public.catalogo_casas (nome, largura_m, profundidade_m, area_m2, topografia, quartos, suites, banheiros, vagas, preco_venda, preco_venda_m2, ativo)
SELECT 'Modelo B', 15, 20, 220, 'plano', 4, 2, 4, 2, 1500000, 6818.18, true
WHERE NOT EXISTS (SELECT 1 FROM public.catalogo_casas WHERE nome = 'Modelo B' LIMIT 1);
-- Etapa 8: Batalhas (preÃ§o, produto, localizaÃ§Ã£o) â€” uma linha por par (casa ZAP, casa catÃ¡logo)
CREATE TABLE IF NOT EXISTS public.batalhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  listing_casa_id UUID NOT NULL REFERENCES public.listings_casas(id) ON DELETE CASCADE,
  catalogo_casa_id UUID NOT NULL REFERENCES public.catalogo_casas(id) ON DELETE CASCADE,
  nota_preco SMALLINT CHECK (nota_preco >= -2 AND nota_preco <= 2),
  nota_produto SMALLINT CHECK (nota_produto >= -2 AND nota_produto <= 2),
  nota_localizacao SMALLINT CHECK (nota_localizacao >= -2 AND nota_localizacao <= 2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(processo_id, listing_casa_id, catalogo_casa_id)
);

ALTER TABLE public.batalhas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Frank batalhas" ON public.batalhas;
CREATE POLICY "Frank batalhas" ON public.batalhas FOR ALL
  USING (EXISTS (SELECT 1 FROM public.processo_step_one p WHERE p.id = processo_id AND p.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_batalhas_processo ON public.batalhas(processo_id);
CREATE INDEX IF NOT EXISTS idx_batalhas_listing ON public.batalhas(listing_casa_id);
CREATE INDEX IF NOT EXISTS idx_batalhas_catalogo ON public.batalhas(catalogo_casa_id);
-- Escolher 3 casas (da Etapa 4) para usar nas Batalhas e no BCA â€” exatamente 3 por processo
CREATE TABLE IF NOT EXISTS public.casas_escolhidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  listing_casa_id UUID NOT NULL REFERENCES public.listings_casas(id) ON DELETE CASCADE,
  ordem SMALLINT NOT NULL CHECK (ordem >= 1 AND ordem <= 3),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(processo_id, ordem),
  UNIQUE(processo_id, listing_casa_id)
);

ALTER TABLE public.casas_escolhidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Frank casas_escolhidas" ON public.casas_escolhidas FOR ALL
  USING (EXISTS (SELECT 1 FROM public.processo_step_one p WHERE p.id = processo_id AND p.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_casas_escolhidas_processo ON public.casas_escolhidas(processo_id);
-- Troca: as "3 casas escolhidas" passam a ser 3 MODELOS DO CATÃLOGO MonÃ­ (nÃ£o 3 casas ZAP).
-- Batalhas: todas as casas listadas na ZAP Ã— os 3 modelos do catÃ¡logo escolhidos.

-- Remove a tabela antiga (escolha era de 3 casas ZAP)
DROP TABLE IF EXISTS public.casas_escolhidas;

-- Escolher 3 modelos do catÃ¡logo MonÃ­ para batalhar com as casas da ZAP (e para o BCA)
CREATE TABLE IF NOT EXISTS public.catalogo_escolhidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  catalogo_casa_id UUID NOT NULL REFERENCES public.catalogo_casas(id) ON DELETE CASCADE,
  ordem SMALLINT NOT NULL CHECK (ordem >= 1 AND ordem <= 3),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(processo_id, ordem),
  UNIQUE(processo_id, catalogo_casa_id)
);

ALTER TABLE public.catalogo_escolhidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Frank catalogo_escolhidos" ON public.catalogo_escolhidos;
CREATE POLICY "Frank catalogo_escolhidos" ON public.catalogo_escolhidos FOR ALL
  USING (EXISTS (SELECT 1 FROM public.processo_step_one p WHERE p.id = processo_id AND p.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_catalogo_escolhidos_processo ON public.catalogo_escolhidos(processo_id);
-- Etapa 2: condomÃ­nios do processo (venda casa >5MM) + checklist 16 itens

CREATE TABLE IF NOT EXISTS public.processo_condominios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ordem INT NOT NULL DEFAULT 1,
  checklist_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processo_condominios_processo ON public.processo_condominios(processo_id);

-- RLS: Frank sÃ³ acessa condomÃ­nios dos prÃ³prios processos
ALTER TABLE public.processo_condominios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Frank processo_condominios" ON public.processo_condominios;
CREATE POLICY "Frank processo_condominios" ON public.processo_condominios FOR ALL
  USING (EXISTS (SELECT 1 FROM public.processo_step_one p WHERE p.id = processo_id AND p.user_id = auth.uid()));
-- MÃ³dulo jurÃ­dico: canal de dÃºvidas, comentÃ¡rios internos, anexos e documentos templates

-- Tickets de dÃºvidas jurÃ­dicas
CREATE TABLE IF NOT EXISTS public.juridico_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nova_duvida' CHECK (
    status IN ('nova_duvida', 'em_analise', 'paralisado', 'finalizado')
  ),
  resposta_publica TEXT,
  resposta_publica_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_juridico_tickets_user ON public.juridico_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_juridico_tickets_status ON public.juridico_tickets(status);

-- ComentÃ¡rios internos do time MonÃ­ (nÃ£o visÃ­veis para Frank)
CREATE TABLE IF NOT EXISTS public.juridico_ticket_comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.juridico_tickets(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_juridico_ticket_comentarios_ticket ON public.juridico_ticket_comentarios(ticket_id);

-- Anexos de tickets (Frank e MonÃ­)
CREATE TABLE IF NOT EXISTS public.juridico_ticket_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.juridico_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lado TEXT NOT NULL CHECK (lado IN ('frank', 'moni')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_juridico_ticket_anexos_ticket ON public.juridico_ticket_anexos(ticket_id);

-- Documentos / contratos templates disponÃ­veis para o franqueado
CREATE TABLE IF NOT EXISTS public.juridico_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT,
  file_url TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_juridico_documentos_ativo ON public.juridico_documentos(ativo);

-- RLS: tickets
ALTER TABLE public.juridico_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Frank own juridico_tickets" ON public.juridico_tickets;
DROP POLICY IF EXISTS "Moni manage juridico_tickets" ON public.juridico_tickets;

-- Frank enxerga e gerencia apenas os prÃ³prios tickets
CREATE POLICY "Frank own juridico_tickets"
  ON public.juridico_tickets
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Consultor/Admin enxergam e podem gerenciar todos os tickets
CREATE POLICY "Moni manage juridico_tickets"
  ON public.juridico_tickets
  FOR ALL
  USING (public.get_my_role() IN ('consultor', 'admin'));

-- RLS: comentÃ¡rios internos (apenas MonÃ­ / admin)
ALTER TABLE public.juridico_ticket_comentarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Moni read juridico_comentarios" ON public.juridico_ticket_comentarios;
DROP POLICY IF EXISTS "Moni write juridico_comentarios" ON public.juridico_ticket_comentarios;

CREATE POLICY "Moni read juridico_comentarios"
  ON public.juridico_ticket_comentarios
  FOR SELECT
  USING (public.get_my_role() IN ('consultor', 'admin'));

CREATE POLICY "Moni write juridico_comentarios"
  ON public.juridico_ticket_comentarios
  FOR ALL
  USING (public.get_my_role() IN ('consultor', 'admin'))
  WITH CHECK (public.get_my_role() IN ('consultor', 'admin'));

-- RLS: anexos de tickets
ALTER TABLE public.juridico_ticket_anexos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Frank own juridico_anexos" ON public.juridico_ticket_anexos;
DROP POLICY IF EXISTS "Moni all juridico_anexos" ON public.juridico_ticket_anexos;

-- Frank enxerga anexos ligados a tickets dele (tanto enviados por ele quanto pela MonÃ­)
CREATE POLICY "Frank own juridico_anexos"
  ON public.juridico_ticket_anexos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.juridico_tickets t
      WHERE t.id = ticket_id
        AND t.user_id = auth.uid()
    )
  );

-- Frank sÃ³ pode inserir anexos prÃ³prios
CREATE POLICY "Frank insert juridico_anexos"
  ON public.juridico_ticket_anexos
  FOR INSERT
  WITH CHECK (user_id = auth.uid() AND lado = 'frank');

-- MonÃ­ enxerga e gerencia todos os anexos
CREATE POLICY "Moni all juridico_anexos"
  ON public.juridico_ticket_anexos
  FOR ALL
  USING (public.get_my_role() IN ('consultor', 'admin'))
  WITH CHECK (public.get_my_role() IN ('consultor', 'admin'));

-- RLS: documentos jurÃ­dicos (templates)
ALTER TABLE public.juridico_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "All read juridico_documentos" ON public.juridico_documentos;
DROP POLICY IF EXISTS "Moni manage juridico_documentos" ON public.juridico_documentos;

-- Qualquer usuÃ¡rio autenticado pode ler documentos ativos
CREATE POLICY "All read juridico_documentos"
  ON public.juridico_documentos
  FOR SELECT
  USING (ativo = true);

-- Apenas consultor/admin podem criar/alterar documentos
CREATE POLICY "Moni manage juridico_documentos"
  ON public.juridico_documentos
  FOR ALL
  USING (public.get_my_role() IN ('consultor', 'admin'))
  WITH CHECK (public.get_my_role() IN ('consultor', 'admin'));

-- Bucket para anexos do canal jurÃ­dico.
-- PolÃ­ticas: Frank acessa apenas arquivos dos prÃ³prios tickets; MonÃ­ (consultor/admin) acessa tudo.
-- Path no bucket: {ticket_id}/frank/{filename} ou {ticket_id}/moni/{filename}

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'juridico-anexos',
  'juridico-anexos',
  false,
  52428800,
  ARRAY['application/pdf','image/jpeg','image/png','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- FunÃ§Ã£o: o usuÃ¡rio atual pode acessar (ler) um arquivo pelo path?
CREATE OR REPLACE FUNCTION public.juridico_can_access_path(object_path text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  first_seg text;
  ticket_uuid uuid;
BEGIN
  IF public.get_my_role() IN ('consultor', 'admin') THEN
    RETURN true;
  END IF;
  first_seg := split_part(object_path, '/', 1);
  IF first_seg IS NULL OR first_seg = '' THEN
    RETURN false;
  END IF;
  BEGIN
    ticket_uuid := first_seg::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
  RETURN EXISTS (
    SELECT 1 FROM public.juridico_tickets t
    WHERE t.id = ticket_uuid AND t.user_id = auth.uid()
  );
END;
$$;

-- Frank pode inserir apenas em path ticket_id/frank/... onde o ticket Ã© dele
CREATE OR REPLACE FUNCTION public.juridico_can_insert_path(object_path text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  first_seg text;
  second_seg text;
  ticket_uuid uuid;
BEGIN
  IF public.get_my_role() IN ('consultor', 'admin') THEN
    RETURN true;
  END IF;
  first_seg := split_part(object_path, '/', 1);
  second_seg := split_part(object_path, '/', 2);
  IF first_seg IS NULL OR first_seg = '' OR second_seg <> 'frank' THEN
    RETURN false;
  END IF;
  BEGIN
    ticket_uuid := first_seg::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
  RETURN EXISTS (
    SELECT 1 FROM public.juridico_tickets t
    WHERE t.id = ticket_uuid AND t.user_id = auth.uid()
  );
END;
$$;

-- PolÃ­ticas em storage.objects: no Supabase hospedado a tabela storage.objects
-- pertence a outro role; criar/alterar policies por aqui gera "must be owner of table objects".
-- Crie as polÃ­ticas pelo Dashboard: Storage â†’ juridico-anexos â†’ Policies.
-- Ver docs/STORAGE_JURIDICO_POLICIES.md para os nomes e expressÃµes.
-- Campos preenchidos pelo Frank ao abrir o ticket: nome (obrigatÃ³rio), condomÃ­nio e lote (opcionais)
-- VisÃ­veis para o consultor/admin MonÃ­

ALTER TABLE public.juridico_tickets
  ADD COLUMN IF NOT EXISTS nome_frank TEXT,
  ADD COLUMN IF NOT EXISTS nome_condominio TEXT,
  ADD COLUMN IF NOT EXISTS lote TEXT;

COMMENT ON COLUMN public.juridico_tickets.nome_frank IS 'Nome do franqueado (obrigatÃ³rio ao abrir)';
COMMENT ON COLUMN public.juridico_tickets.nome_condominio IS 'Nome do condomÃ­nio (opcional)';
COMMENT ON COLUMN public.juridico_tickets.lote IS 'Lote (opcional)';
-- E-mail do franqueado no ticket para envio de alertas por e-mail quando o status mudar

ALTER TABLE public.juridico_tickets
  ADD COLUMN IF NOT EXISTS email_frank TEXT;

COMMENT ON COLUMN public.juridico_tickets.email_frank IS 'E-mail do franqueado (preenchido na criaÃ§Ã£o) para envio de notificaÃ§Ãµes de mudanÃ§a de status';
-- Campos para integraÃ§Ã£o ZAP (Etapa 4): cidade, estado, status (a venda/despublicado), compatibilidade MonÃ­

ALTER TABLE public.listings_casas
  ADD COLUMN IF NOT EXISTS cidade TEXT,
  ADD COLUMN IF NOT EXISTS estado TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'a_venda' CHECK (status IS NULL OR status IN ('a_venda', 'despublicado')),
  ADD COLUMN IF NOT EXISTS compatibilidade_moni TEXT;

COMMENT ON COLUMN public.listings_casas.cidade IS 'Cidade do anÃºncio (ex.: SÃ£o Paulo)';
COMMENT ON COLUMN public.listings_casas.estado IS 'UF (ex.: SP)';
COMMENT ON COLUMN public.listings_casas.status IS 'a_venda = ativo na ZAP; despublicado = saiu do ar (mantido na tabela)';
COMMENT ON COLUMN public.listings_casas.compatibilidade_moni IS 'Preenchido caso a caso (compatibilidade estilo MonÃ­)';

CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_casas_processo_link ON public.listings_casas(processo_id, link) WHERE link IS NOT NULL;
-- Casas adicionadas manualmente: flag e validaÃ§Ã£o mensal de status

ALTER TABLE public.listings_casas
  ADD COLUMN IF NOT EXISTS manual BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.listings_casas.manual IS 'true = cadastrada manualmente pelo franqueado; false = vinda da varredura ZAP';

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS ultima_validacao_casas_manuais_em DATE;

COMMENT ON COLUMN public.processo_step_one.ultima_validacao_casas_manuais_em IS 'Ãšltima data em que o franqueado validou o status das casas manuais (alerta mensal)';
-- Etapa 5 (lotes): $ condomÃ­nio, IPTU e caracterÃ­sticas do condomÃ­nio

ALTER TABLE public.listings_lotes
  ADD COLUMN IF NOT EXISTS valor_condominio NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS iptu NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS caracteristicas_condominio TEXT;

COMMENT ON COLUMN public.listings_lotes.valor_condominio IS 'Valor do condomÃ­nio (R$/mÃªs)';
COMMENT ON COLUMN public.listings_lotes.iptu IS 'IPTU (R$)';
COMMENT ON COLUMN public.listings_lotes.caracteristicas_condominio IS 'CaracterÃ­sticas do condomÃ­nio (ex.: SalÃ£o de festas, Piscina, Academia)';
-- Lotes adicionados manualmente: flag e validaÃ§Ã£o mensal (espelha 014 para casas)

ALTER TABLE public.listings_lotes
  ADD COLUMN IF NOT EXISTS manual BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.listings_lotes.manual IS 'true = cadastrado manualmente pelo franqueado; false = vindo da varredura ZAP';

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS ultima_validacao_lotes_manuais_em DATE;

COMMENT ON COLUMN public.processo_step_one.ultima_validacao_lotes_manuais_em IS 'Ãšltima data em que o franqueado validou o status dos lotes manuais (alerta mensal)';
-- CaracterÃ­sticas do condomÃ­nio vindas da glue-api (listing.amenities)

ALTER TABLE public.listings_lotes
  ADD COLUMN IF NOT EXISTS caracteristicas TEXT;

COMMENT ON COLUMN public.listings_lotes.caracteristicas IS 'CaracterÃ­sticas/amenidades do condomÃ­nio (ex.: Piscina, Academia) - preenchido pela ZAP (amenities)';
-- Batalha de casas (Etapa 5) â€” escolha de atÃ© 3 casas e notas por anÃºncio

CREATE TABLE IF NOT EXISTS public.casas_escolhidas_etapa5 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings_casas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT casas_escolhidas_etapa5_unq UNIQUE (processo_id, listing_id)
);

COMMENT ON TABLE public.casas_escolhidas_etapa5 IS 'Casas do nosso catÃ¡logo (via listings_casas) escolhidas pelo franqueado para a batalha da Etapa 5.';

CREATE TABLE IF NOT EXISTS public.batalha_casas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  casa_escolhida_id UUID NOT NULL REFERENCES public.casas_escolhidas_etapa5(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings_casas(id) ON DELETE CASCADE,
  nota_preco NUMERIC(4,2),
  nota_produto NUMERIC(4,2),
  nota_localizacao NUMERIC(4,2),
  nota_final NUMERIC(4,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT batalha_casas_unq UNIQUE (processo_id, casa_escolhida_id, listing_id)
);

COMMENT ON TABLE public.batalha_casas IS 'Notas da batalha de casas na Etapa 5 (preÃ§o, produto, localizaÃ§Ã£o e nota final ponderada).';

CREATE INDEX IF NOT EXISTS idx_casas_escolhidas_etapa5_processo ON public.casas_escolhidas_etapa5(processo_id);
CREATE INDEX IF NOT EXISTS idx_batalha_casas_processo ON public.batalha_casas(processo_id);

-- As 3 casas da batalha vÃªm do catÃ¡logo MonÃ­ (catalogo_casas), nÃ£o da listagem

ALTER TABLE public.casas_escolhidas_etapa5
  DROP CONSTRAINT IF EXISTS casas_escolhidas_etapa5_unq,
  DROP COLUMN IF EXISTS listing_id;

ALTER TABLE public.casas_escolhidas_etapa5
  ADD COLUMN IF NOT EXISTS catalogo_casa_id UUID REFERENCES public.catalogo_casas(id) ON DELETE CASCADE;

ALTER TABLE public.casas_escolhidas_etapa5
  ADD CONSTRAINT casas_escolhidas_etapa5_unq UNIQUE (processo_id, catalogo_casa_id);

COMMENT ON COLUMN public.casas_escolhidas_etapa5.catalogo_casa_id IS 'Modelo do catÃ¡logo MonÃ­ escolhido para a batalha (atÃ© 3 por processo).';
-- Etapa 4: permitir escolher 1 lote da listagem; referÃªncia em lote_escolhido
ALTER TABLE public.lote_escolhido
  ADD COLUMN IF NOT EXISTS listing_lote_id UUID REFERENCES public.listings_lotes(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.lote_escolhido.listing_lote_id IS 'Lote escolhido na Etapa 4 (listagem de lotes).';
-- Data em que o anÃºncio foi marcado como despublicado (quando nÃ£o aparece mais na ZAP).
-- Usado para calcular duraÃ§Ã£o do anÃºncio para itens despublicados.
ALTER TABLE public.listings_casas
  ADD COLUMN IF NOT EXISTS data_despublicado DATE;

COMMENT ON COLUMN public.listings_casas.data_despublicado IS 'Data em que o anÃºncio deixou de aparecer na ZAP (status despublicado). Para duraÃ§Ã£o: despublicado = data_despublicado - data_publicacao.';
-- Bucket para PDFs Score & Batalha (Etapa 7).
-- Path: {processo_id}/score-batalha.pdf
-- UsuÃ¡rios autenticados podem fazer upload, ler, atualizar e deletar.
--
-- Se CREATE POLICY falhar (ex.: "must be owner of table objects"),
-- crie as 4 polÃ­ticas pelo Dashboard: Storage â†’ processo-docs â†’ Policies.
-- Ver: docs/STORAGE_PROCESSO_DOCS_POLICIES.md

-- Criar bucket se nÃ£o existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('processo-docs', 'processo-docs', false)
ON CONFLICT (id) DO NOTHING;

-- PolÃ­tica de upload para usuÃ¡rios autenticados
CREATE POLICY "UsuÃ¡rios autenticados podem fazer upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'processo-docs');

-- PolÃ­tica de leitura para usuÃ¡rios autenticados
CREATE POLICY "UsuÃ¡rios autenticados podem ler"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'processo-docs');

-- PolÃ­tica de update (para sobrescrever o PDF ao gerar novamente)
CREATE POLICY "UsuÃ¡rios autenticados podem atualizar"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'processo-docs');

-- PolÃ­tica de delete para usuÃ¡rios autenticados
CREATE POLICY "UsuÃ¡rios autenticados podem deletar"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'processo-docs');
-- Etapa 1 â€” AnÃ¡lise da praÃ§a: observaÃ§Ãµes do Frank e cÃ³digo IBGE do municÃ­pio
ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS observacoes_praca TEXT,
  ADD COLUMN IF NOT EXISTS cidade_ibge_cod TEXT;

COMMENT ON COLUMN public.processo_step_one.observacoes_praca IS 'ObservaÃ§Ãµes livres do Frank sobre a praÃ§a (Etapa 1)';
COMMENT ON COLUMN public.processo_step_one.cidade_ibge_cod IS 'CÃ³digo do municÃ­pio no IBGE (id do localidades)';
-- Etapa 1 â€” Anexos (imagens) e URL do PDF de prospecÃ§Ã£o cidade
ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS anexos_etapa1 JSONB,
  ADD COLUMN IF NOT EXISTS pdf_url_etapa1 TEXT;

COMMENT ON COLUMN public.processo_step_one.anexos_etapa1 IS 'Lista de anexos (url, nome) da Etapa 1 para o PDF de prospecÃ§Ã£o';
COMMENT ON COLUMN public.processo_step_one.pdf_url_etapa1 IS 'URL do PDF de prospecÃ§Ã£o cidade gerado na Etapa 1';
-- Cancelamento de processo (a partir do Step 2) e step_atual para Kanban
ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS cancelado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS step_atual INT NOT NULL DEFAULT 1 CHECK (step_atual >= 1 AND step_atual <= 5);

ALTER TABLE public.processo_step_one
  DROP CONSTRAINT IF EXISTS processo_step_one_status_check;

ALTER TABLE public.processo_step_one
  ADD CONSTRAINT processo_step_one_status_check
  CHECK (status IN ('rascunho', 'em_andamento', 'concluido', 'cancelado'));

COMMENT ON COLUMN public.processo_step_one.cancelado_em IS 'Preenchido quando o franqueado cancela o processo (a partir do Step 2)';
COMMENT ON COLUMN public.processo_step_one.step_atual IS '1=Step 1 RegiÃ£o, 2=Step 2 Novo negÃ³cio, 3=OpÃ§Ãµes, 4=Check Legal, 5=ComitÃª; usado no Kanban';
-- Tabela Rede de Franqueados (dados exibidos dentro da ferramenta em /rede-franqueados e COMUNIDADE)
CREATE TABLE public.rede_franqueados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem INT NOT NULL DEFAULT 0,
  nome TEXT,
  unidade TEXT,
  cidade TEXT,
  estado TEXT,
  email TEXT,
  telefone TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rede_franqueados_ordem ON public.rede_franqueados (ordem);

ALTER TABLE public.rede_franqueados ENABLE ROW LEVEL SECURITY;

-- Leitores autenticados podem ver (admin na /rede-franqueados e franqueados na COMUNIDADE)
CREATE POLICY "rede_franqueados_select_authenticated"
  ON public.rede_franqueados FOR SELECT
  TO authenticated
  USING (true);

-- Apenas admin pode inserir/atualizar/remover
CREATE POLICY "rede_franqueados_insert_admin"
  ON public.rede_franqueados FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "rede_franqueados_update_admin"
  ON public.rede_franqueados FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "rede_franqueados_delete_admin"
  ON public.rede_franqueados FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

COMMENT ON TABLE public.rede_franqueados IS 'Rede de franqueados exibida na ferramenta (fonte de dados Ã© esta tabela, nÃ£o planilha externa)';
-- Novos campos na tabela Rede de Franqueados (cabeÃ§alho conforme especificado)
ALTER TABLE public.rede_franqueados
  ADD COLUMN IF NOT EXISTS n_franquia TEXT,
  ADD COLUMN IF NOT EXISTS nome_completo TEXT,
  ADD COLUMN IF NOT EXISTS status_franquia TEXT,
  ADD COLUMN IF NOT EXISTS classificacao_franqueado TEXT,
  ADD COLUMN IF NOT EXISTS data_ass_cof DATE,
  ADD COLUMN IF NOT EXISTS data_ass_contrato DATE,
  ADD COLUMN IF NOT EXISTS data_expiracao_franquia DATE,
  ADD COLUMN IF NOT EXISTS regional TEXT,
  ADD COLUMN IF NOT EXISTS area_atuacao TEXT,
  ADD COLUMN IF NOT EXISTS email_frank TEXT,
  ADD COLUMN IF NOT EXISTS telefone_frank TEXT,
  ADD COLUMN IF NOT EXISTS cpf_frank TEXT,
  ADD COLUMN IF NOT EXISTS data_nasc_frank DATE,
  ADD COLUMN IF NOT EXISTS endereco_casa_frank TEXT,
  ADD COLUMN IF NOT EXISTS cep_casa_frank TEXT,
  ADD COLUMN IF NOT EXISTS estado_casa_frank TEXT,
  ADD COLUMN IF NOT EXISTS cidade_casa_frank TEXT,
  ADD COLUMN IF NOT EXISTS tamanho_camisa_frank TEXT,
  ADD COLUMN IF NOT EXISTS socios TEXT;

-- Remover colunas antigas (se existirem)
ALTER TABLE public.rede_franqueados DROP COLUMN IF EXISTS nome;
ALTER TABLE public.rede_franqueados DROP COLUMN IF EXISTS unidade;
ALTER TABLE public.rede_franqueados DROP COLUMN IF EXISTS cidade;
ALTER TABLE public.rede_franqueados DROP COLUMN IF EXISTS estado;
ALTER TABLE public.rede_franqueados DROP COLUMN IF EXISTS email;
ALTER TABLE public.rede_franqueados DROP COLUMN IF EXISTS telefone;
ALTER TABLE public.rede_franqueados DROP COLUMN IF EXISTS observacoes;

COMMENT ON COLUMN public.rede_franqueados.socios IS 'SÃ³cios: Nome, Nascimento, Telefone, E-mail, CPF, EndereÃ§o Completo, Tamanho da camisa';
-- Data de Recebimento do Kit de Boas Vindas (presente no CSV da planilha)
ALTER TABLE public.rede_franqueados
  ADD COLUMN IF NOT EXISTS data_recebimento_kit_boas_vindas DATE;
-- Incluir role 'supervisor' em profiles (MonÃ­ admin e supervisor acessam Processo seletivo candidatos)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('frank', 'consultor', 'admin', 'supervisor'));
-- Etapa 2: condomÃ­nios encontrados via ZAP (casas >5MM) e checklist detalhado por condomÃ­nio

CREATE TABLE public.condominios_etapa2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  nome TEXT,
  qtd_casas INTEGER,
  preco_medio NUMERIC,
  m2_medio NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_condominios_etapa2_processo ON public.condominios_etapa2(processo_id);

CREATE TABLE public.checklist_condominios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  condominio_id UUID REFERENCES public.condominios_etapa2(id) ON DELETE CASCADE,
  lotes_total INTEGER,
  lotes_disponiveis INTEGER,
  lotes_tamanho_medio NUMERIC,
  lotes_preco_m2 NUMERIC,
  lotes_area_valorizada TEXT,
  casas_prontas INTEGER,
  casas_construindo INTEGER,
  casas_construindo_venda INTEGER,
  casas_construindo_cliente INTEGER,
  casas_para_venda INTEGER,
  casas_preco_m2 NUMERIC,
  casas_tempo_medio_venda NUMERIC,
  casas_vendidas_12m INTEGER,
  casas_remanescentes_motivo TEXT,
  casas_impacto_negativo TEXT,
  casas_erros_projeto TEXT,
  casas_caracteristicas_elogiadas TEXT,
  casas_caracteristicas_buscadas TEXT,
  locacao_exemplos TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklist_condominios_processo ON public.checklist_condominios(processo_id);
CREATE INDEX IF NOT EXISTS idx_checklist_condominios_condominio ON public.checklist_condominios(condominio_id);

-- RLS: Frank sÃ³ acessa dados dos prÃ³prios processos
ALTER TABLE public.condominios_etapa2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_condominios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Frank condominios_etapa2" ON public.condominios_etapa2;
CREATE POLICY "Frank condominios_etapa2" ON public.condominios_etapa2 FOR ALL
  USING (EXISTS (SELECT 1 FROM public.processo_step_one p WHERE p.id = processo_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "Frank checklist_condominios" ON public.checklist_condominios;
CREATE POLICY "Frank checklist_condominios" ON public.checklist_condominios FOR ALL
  USING (EXISTS (SELECT 1 FROM public.processo_step_one p WHERE p.id = processo_id AND p.user_id = auth.uid()));

-- Campos extras para regras consolidadas da Batalha de Casas (Atributos do Lote, PreÃ§o 4 sub-itens, Produto 5 sub-itens)

ALTER TABLE public.batalha_casas
  ADD COLUMN IF NOT EXISTS atributos_lote_json JSONB,
  ADD COLUMN IF NOT EXISTS preco_dados_json JSONB,
  ADD COLUMN IF NOT EXISTS produto_dados_json JSONB;

COMMENT ON COLUMN public.batalha_casas.atributos_lote_json IS 'Respostas SIM/NÃƒO dos atributos do lote (vista, Ã¡rea verde, muro, Ã¡rea convivÃªncia, lixeira). Nota = soma dos scores dos marcados.';
COMMENT ON COLUMN public.batalha_casas.preco_dados_json IS 'Checklist 8 categorias de reforma + 4 sub-itens (DistÃ¢ncia, EsforÃ§o, Incerteza, PreÃ§o Nominal) e nota preÃ§o.';
COMMENT ON COLUMN public.batalha_casas.produto_dados_json IS '5 sub-itens Produto (tamanho, amenidades, quartos, design, idade) e nota produto.';
-- Templates e instÃ¢ncias de documentos (Step 3 / Step 7, Autentique, revisÃ£o).
-- Substitui arquivo corrompido que continha apenas "image.png".

CREATE TABLE IF NOT EXISTS public.document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area TEXT NOT NULL,
  step INTEGER NOT NULL,
  versao INTEGER NOT NULL DEFAULT 1,
  ativo BOOLEAN NOT NULL DEFAULT true,
  arquivo_path TEXT,
  metadados JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_templates_area_step_ativo
  ON public.document_templates (area, step, ativo, versao DESC);

CREATE TABLE IF NOT EXISTS public.document_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one (id) ON DELETE CASCADE,
  step INTEGER NOT NULL,
  template_id UUID REFERENCES public.document_templates (id) ON DELETE SET NULL,
  versao INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'aguardando_revisao',
  arquivo_preenchido_path TEXT,
  arquivo_assinado_path TEXT,
  diff_json JSONB,
  motivo_reprovacao TEXT,
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  analisado_por UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  analisado_em TIMESTAMPTZ,
  autentique_document_id TEXT,
  assinatura_status TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_instances_processo_step
  ON public.document_instances (processo_id, step);

CREATE INDEX IF NOT EXISTS idx_document_instances_autentique_doc
  ON public.document_instances (autentique_document_id)
  WHERE autentique_document_id IS NOT NULL;

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_templates_select_authenticated" ON public.document_templates;
CREATE POLICY "document_templates_select_authenticated"
  ON public.document_templates FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "document_templates_manage_consultor_admin" ON public.document_templates;
CREATE POLICY "document_templates_manage_consultor_admin"
  ON public.document_templates FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'consultor', 'supervisor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'consultor', 'supervisor')
    )
  );

DROP POLICY IF EXISTS "document_instances_authenticated_all" ON public.document_instances;
CREATE POLICY "document_instances_authenticated_all"
  ON public.document_instances FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.document_templates TO postgres, service_role;
GRANT ALL ON public.document_instances TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_instances TO authenticated;
-- BCA (Business Case Analysis) - inputs por processo
-- vgv_planta e obra_mes8 sÃ£o calculados no cliente; nÃ£o existem no banco.

CREATE TABLE IF NOT EXISTS public.bca_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  -- IdentificaÃ§Ã£o
  nome_condominio TEXT DEFAULT '',
  nome_casa TEXT DEFAULT '',
  area_vendas_m2 NUMERIC DEFAULT 627,
  -- Terreno
  custo_terreno NUMERIC DEFAULT -1000000,
  itbi_percentual NUMERIC DEFAULT 0.04,
  -- Casa e obra
  custo_casa NUMERIC DEFAULT -2510000,
  mes_inicio_obra INTEGER DEFAULT 3,
  -- Fluxo de obra (mÃªs 8 = 1 - SUM(mes1..mes7); NÃƒO salvar obra_mes8)
  obra_mes1 NUMERIC DEFAULT 0.15,
  obra_mes2 NUMERIC DEFAULT 0.25,
  obra_mes3 NUMERIC DEFAULT 0.18,
  obra_mes4 NUMERIC DEFAULT 0.10,
  obra_mes5 NUMERIC DEFAULT 0.10,
  obra_mes6 NUMERIC DEFAULT 0.01,
  obra_mes7 NUMERIC DEFAULT 0.01,
  obra_mes9 NUMERIC DEFAULT 0.08,
  obra_mes10 NUMERIC DEFAULT 0.08,
  -- Taxas e despesas (valores negativos)
  comissao_vendas NUMERIC DEFAULT -0.08,
  impostos NUMERIC DEFAULT 0.06,
  taxa_plataforma NUMERIC DEFAULT -0.07,
  taxa_gestao_frank NUMERIC DEFAULT -0.08,
  projetos_taxa_obra NUMERIC DEFAULT -50000,
  capital_giro_inicial NUMERIC DEFAULT -25000,
  -- CenÃ¡rios VGV (vgv_planta NÃƒO salvar = (vgv_target+vgv_liquidacao)/2)
  vgv_target NUMERIC DEFAULT 6000000,
  vgv_liquidacao NUMERIC DEFAULT 5400000,
  vgv_recompra NUMERIC DEFAULT 5300000,
  -- % Permuta por cenÃ¡rio
  permuta_planta NUMERIC DEFAULT 0.25,
  permuta_target NUMERIC DEFAULT 0.25,
  permuta_liquidacao NUMERIC DEFAULT 0.25,
  permuta_recompra NUMERIC DEFAULT 0.36,
  -- Funding
  percentual_funding NUMERIC DEFAULT 1.0,
  cdi_an NUMERIC DEFAULT 0.15,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(processo_id)
);

CREATE INDEX IF NOT EXISTS idx_bca_inputs_processo ON public.bca_inputs(processo_id);

ALTER TABLE public.bca_inputs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios podem ver bca_inputs do proprio processo" ON public.bca_inputs;
CREATE POLICY "Usuarios podem ver bca_inputs do proprio processo"
  ON public.bca_inputs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.processo_step_one p WHERE p.id = processo_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "Usuarios podem inserir bca_inputs" ON public.bca_inputs;
CREATE POLICY "Usuarios podem inserir bca_inputs"
  ON public.bca_inputs FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.processo_step_one p WHERE p.id = processo_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "Usuarios podem atualizar bca_inputs" ON public.bca_inputs;
CREATE POLICY "Usuarios podem atualizar bca_inputs"
  ON public.bca_inputs FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.processo_step_one p WHERE p.id = processo_id AND p.user_id = auth.uid()));
-- Sirene - Central de Chamados (evoluÃ§Ã£o do R.I.P.)
-- PapÃ©is: Bombeiro, Times, Caneta Verde, Criador do chamado.
-- Estender role em profiles para incluir bombeiro e caneta_verde (opcional, via tabela de papeis).

-- Tabela de papeis Sirene (quem Ã© bombeiro / caneta verde)
CREATE TABLE IF NOT EXISTS public.sirene_papeis (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  papel TEXT NOT NULL CHECK (papel IN ('bombeiro', 'caneta_verde')),
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.sirene_papeis IS 'AtribuiÃ§Ã£o de papÃ©is Sirene: bombeiro ou caneta_verde. Quem nÃ£o estÃ¡ aqui Ã© time ou criador conforme contexto.';

-- Sequence para nÃºmero do chamado
CREATE SEQUENCE IF NOT EXISTS public.sirene_numero_seq START WITH 1;

-- 4.1 Tabela principal: sirene_chamados
CREATE TABLE IF NOT EXISTS public.sirene_chamados (
  id BIGSERIAL PRIMARY KEY,
  numero INTEGER UNIQUE NOT NULL DEFAULT nextval('public.sirene_numero_seq'),
  data_abertura TIMESTAMPTZ DEFAULT now(),
  time_abertura TEXT,
  frank_id TEXT,
  frank_nome TEXT,
  aberto_por UUID REFERENCES auth.users(id),
  aberto_por_nome TEXT,
  trava BOOLEAN DEFAULT false,
  incendio TEXT NOT NULL,
  prioridade TEXT DEFAULT 'MÃ©dia',
  status TEXT DEFAULT 'nao_iniciado' CHECK (status IN ('nao_iniciado', 'em_andamento', 'concluido')),
  resolucao_pontual TEXT,
  data_inicio_atendimento TIMESTAMPTZ,
  data_conclusao TIMESTAMPTZ,
  tema TEXT,
  mapeamento_pericia TEXT,
  parecer_final TEXT,
  resolucao_suficiente BOOLEAN,
  motivo_insuficiente TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4.2 Tabela: sirene_topicos
CREATE TABLE IF NOT EXISTS public.sirene_topicos (
  id BIGSERIAL PRIMARY KEY,
  chamado_id BIGINT NOT NULL REFERENCES public.sirene_chamados(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL,
  descricao TEXT NOT NULL,
  time_responsavel TEXT NOT NULL,
  responsavel_id UUID REFERENCES auth.users(id),
  responsavel_nome TEXT,
  data_inicio DATE,
  data_fim DATE,
  status TEXT DEFAULT 'nao_iniciado' CHECK (status IN ('nao_iniciado', 'em_andamento', 'concluido', 'aprovado')),
  resolucao_time TEXT,
  aprovado_bombeiro BOOLEAN,
  motivo_reprovacao TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sirene_topicos_chamado ON public.sirene_topicos(chamado_id);

-- 4.3 Tabela: sirene_anexos (topico_id NULL se anexo do chamado)
CREATE TABLE IF NOT EXISTS public.sirene_anexos (
  id BIGSERIAL PRIMARY KEY,
  chamado_id BIGINT NOT NULL REFERENCES public.sirene_chamados(id) ON DELETE CASCADE,
  topico_id BIGINT REFERENCES public.sirene_topicos(id) ON DELETE CASCADE,
  uploader_id UUID REFERENCES auth.users(id),
  uploader_nome TEXT,
  storage_path TEXT NOT NULL,
  nome_original TEXT,
  tipo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sirene_anexos_chamado ON public.sirene_anexos(chamado_id);

-- 4.4 Tabela: sirene_mensagens (canal interno por chamado; suporta @menÃ§Ãµes)
CREATE TABLE IF NOT EXISTS public.sirene_mensagens (
  id BIGSERIAL PRIMARY KEY,
  chamado_id BIGINT NOT NULL REFERENCES public.sirene_chamados(id) ON DELETE CASCADE,
  autor_id UUID REFERENCES auth.users(id),
  autor_nome TEXT,
  autor_time TEXT,
  texto TEXT NOT NULL,
  mencoes UUID[],
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sirene_mensagens_chamado ON public.sirene_mensagens(chamado_id);

-- 4.5 Tabela: sirene_pericias (Caneta Verde)
CREATE TABLE IF NOT EXISTS public.sirene_pericias (
  id BIGSERIAL PRIMARY KEY,
  nome_pericia TEXT NOT NULL,
  time_responsavel TEXT,
  responsavel_id UUID REFERENCES auth.users(id),
  responsavel_nome TEXT,
  data_inicio DATE,
  status TEXT DEFAULT 'nao_iniciado',
  prioridade TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4.6 Tabela N:N sirene_pericia_chamados
CREATE TABLE IF NOT EXISTS public.sirene_pericia_chamados (
  pericia_id BIGINT NOT NULL REFERENCES public.sirene_pericias(id) ON DELETE CASCADE,
  chamado_id BIGINT NOT NULL REFERENCES public.sirene_chamados(id) ON DELETE CASCADE,
  PRIMARY KEY (pericia_id, chamado_id)
);

-- 4.7 Tabela: sirene_notificacoes
CREATE TABLE IF NOT EXISTS public.sirene_notificacoes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chamado_id BIGINT REFERENCES public.sirene_chamados(id) ON DELETE CASCADE,
  tipo TEXT,
  lida BOOLEAN DEFAULT false,
  texto TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sirene_notificacoes_user ON public.sirene_notificacoes(user_id);
CREATE INDEX IF NOT EXISTS idx_sirene_notificacoes_chamado ON public.sirene_notificacoes(chamado_id);

-- RLS
ALTER TABLE public.sirene_papeis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sirene_chamados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sirene_topicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sirene_anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sirene_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sirene_pericias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sirene_pericia_chamados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sirene_notificacoes ENABLE ROW LEVEL SECURITY;

-- FunÃ§Ã£o: usuÃ¡rio Ã© bombeiro ou caneta_verde
CREATE OR REPLACE FUNCTION public.get_my_sirene_papel()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT papel FROM public.sirene_papeis WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Franqueado: sÃ³ seus chamados (aberto_por = auth.uid())
-- Time: chamados onde time_abertura = seu time OU tem tÃ³pico atribuÃ­do ao seu time/responsÃ¡vel
-- Bombeiro/Caneta Verde: acesso total
CREATE POLICY "sirene_chamados_select"
  ON public.sirene_chamados FOR SELECT
  USING (
    aberto_por = auth.uid()
    OR public.get_my_sirene_papel() IN ('bombeiro', 'caneta_verde')
    OR EXISTS (
      SELECT 1 FROM public.sirene_topicos t
      WHERE t.chamado_id = sirene_chamados.id
      AND (t.responsavel_id = auth.uid() OR t.time_responsavel = (SELECT p.full_name FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1))
    )
  );

CREATE POLICY "sirene_chamados_insert"
  ON public.sirene_chamados FOR INSERT
  WITH CHECK (true);

CREATE POLICY "sirene_chamados_update"
  ON public.sirene_chamados FOR UPDATE
  USING (
    aberto_por = auth.uid()
    OR public.get_my_sirene_papel() IN ('bombeiro', 'caneta_verde')
    OR EXISTS (SELECT 1 FROM public.sirene_topicos t WHERE t.chamado_id = sirene_chamados.id AND t.responsavel_id = auth.uid())
  );

-- TÃ³picos: quem vÃª o chamado vÃª os tÃ³picos
CREATE POLICY "sirene_topicos_all"
  ON public.sirene_topicos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.sirene_chamados c WHERE c.id = sirene_topicos.chamado_id
      AND (
        c.aberto_por = auth.uid()
        OR public.get_my_sirene_papel() IN ('bombeiro', 'caneta_verde')
        OR EXISTS (SELECT 1 FROM public.sirene_topicos t WHERE t.chamado_id = c.id AND t.responsavel_id = auth.uid())
      )
    )
  );

-- Anexos: quem vÃª o chamado vÃª os anexos
CREATE POLICY "sirene_anexos_all"
  ON public.sirene_anexos FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.sirene_chamados c WHERE c.id = sirene_anexos.chamado_id AND (
      c.aberto_por = auth.uid()
      OR public.get_my_sirene_papel() IN ('bombeiro', 'caneta_verde')
      OR EXISTS (SELECT 1 FROM public.sirene_topicos t WHERE t.chamado_id = c.id AND t.responsavel_id = auth.uid())
    ))
  );

-- Mensagens: participantes do chamado
CREATE POLICY "sirene_mensagens_select"
  ON public.sirene_mensagens FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.sirene_chamados c WHERE c.id = sirene_mensagens.chamado_id AND (
      c.aberto_por = auth.uid()
      OR public.get_my_sirene_papel() IN ('bombeiro', 'caneta_verde')
      OR EXISTS (SELECT 1 FROM public.sirene_topicos t WHERE t.chamado_id = c.id AND t.responsavel_id = auth.uid())
    ))
  );

CREATE POLICY "sirene_mensagens_insert"
  ON public.sirene_mensagens FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- PerÃ­cias: bombeiro e caneta_verde
CREATE POLICY "sirene_pericias_all"
  ON public.sirene_pericias FOR ALL
  USING (public.get_my_sirene_papel() IN ('bombeiro', 'caneta_verde'));

CREATE POLICY "sirene_pericia_chamados_all"
  ON public.sirene_pericia_chamados FOR ALL
  USING (public.get_my_sirene_papel() IN ('bombeiro', 'caneta_verde'));

-- NotificaÃ§Ãµes: cada um vÃª as suas
CREATE POLICY "sirene_notificacoes_own"
  ON public.sirene_notificacoes FOR ALL
  USING (user_id = auth.uid());

-- Papeis: sÃ³ admin gerencia (opcional)
CREATE POLICY "sirene_papeis_admin"
  ON public.sirene_papeis FOR ALL
  USING (public.get_my_role() = 'admin');

-- Bucket para anexos dos chamados (path: chamado_{id}/ ou chamado_{id}/topico_{id}/)
INSERT INTO storage.buckets (id, name, public)
VALUES ('sirene-attachments', 'sirene-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "sirene_attachments_authenticated"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'sirene-attachments')
  WITH CHECK (bucket_id = 'sirene-attachments');
-- ExceÃ§Ã£o HDM: chamados podem ser tipo 'padrao' ou 'hdm'.
-- HDM = direcionado a um dos 3 times: HomologaÃ§Ãµes, Produto, Modelo Virtual.
-- Time HDM atua como Bombeiro no chamado (resoluÃ§Ã£o pontual, aprovar tÃ³picos, fechar).
-- Tema e mapeamento de perÃ­cia sÃ£o SEMPRE preenchidos apenas pelo Bombeiro.

-- Coluna "time" em profiles: time interno do usuÃ¡rio (ex.: HomologaÃ§Ãµes, Produto) para RLS e canActAsBombeiro
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS time TEXT;

-- Colunas HDM em sirene_chamados
ALTER TABLE public.sirene_chamados ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'padrao';
ALTER TABLE public.sirene_chamados ADD COLUMN IF NOT EXISTS hdm_responsavel TEXT;
ALTER TABLE public.sirene_chamados ADD COLUMN IF NOT EXISTS hdm_redirecionado_por UUID REFERENCES auth.users(id);
ALTER TABLE public.sirene_chamados ADD COLUMN IF NOT EXISTS hdm_redirecionado_em TIMESTAMPTZ;

-- Constraint: padrÃ£o sem HDM; HDM exige um dos 3 times
ALTER TABLE public.sirene_chamados DROP CONSTRAINT IF EXISTS sirene_chamados_hdm_responsavel_check;
ALTER TABLE public.sirene_chamados ADD CONSTRAINT sirene_chamados_hdm_responsavel_check
  CHECK (
    (tipo = 'padrao' AND hdm_responsavel IS NULL) OR
    (tipo = 'hdm' AND hdm_responsavel IN ('HomologaÃ§Ãµes', 'Produto', 'Modelo Virtual'))
  );

CREATE INDEX IF NOT EXISTS idx_sirene_chamados_hdm ON public.sirene_chamados(tipo, hdm_responsavel)
  WHERE tipo = 'hdm';

-- RLS: time HDM vÃª e pode atualizar chamados HDM atribuÃ­dos ao seu time (nÃ£o INSERT; criador/Bombeiro insere)
DROP POLICY IF EXISTS "sirene_chamados_hdm_team_select" ON public.sirene_chamados;
DROP POLICY IF EXISTS "sirene_chamados_hdm_team_update" ON public.sirene_chamados;
CREATE POLICY "sirene_chamados_hdm_team_select"
  ON public.sirene_chamados FOR SELECT
  USING (
    tipo = 'hdm'
    AND hdm_responsavel = (SELECT time FROM public.profiles WHERE id = auth.uid() LIMIT 1)
  );
CREATE POLICY "sirene_chamados_hdm_team_update"
  ON public.sirene_chamados FOR UPDATE
  USING (
    tipo = 'hdm'
    AND hdm_responsavel = (SELECT time FROM public.profiles WHERE id = auth.uid() LIMIT 1)
  );
-- ResponsÃ¡vel HDM opcional: chamado pode ser tipo 'hdm' sem time definido.
-- Nesse caso sÃ³ Bombeiro/criador tÃªm acesso (RLS existente jÃ¡ cobre).

ALTER TABLE public.sirene_chamados DROP CONSTRAINT IF EXISTS sirene_chamados_hdm_responsavel_check;
ALTER TABLE public.sirene_chamados ADD CONSTRAINT sirene_chamados_hdm_responsavel_check
  CHECK (
    (tipo = 'padrao' AND hdm_responsavel IS NULL) OR
    (tipo = 'hdm' AND (
      hdm_responsavel IS NULL OR
      hdm_responsavel IN ('HomologaÃ§Ãµes', 'Produto', 'Modelo Virtual')
    ))
  );
-- Corrige recursÃ£o infinita nas polÃ­ticas RLS: sirene_chamados e sirene_topicos
-- referenciam um ao outro. Usamos uma funÃ§Ã£o SECURITY DEFINER que consulta
-- sirene_topicos sem passar por RLS, quebrando o ciclo.

CREATE OR REPLACE FUNCTION public.user_has_topic_on_chamado(p_chamado_id bigint, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sirene_topicos t
    LEFT JOIN public.profiles p ON p.id = p_user_id
    WHERE t.chamado_id = p_chamado_id
      AND (t.responsavel_id = p_user_id OR t.time_responsavel = p.full_name)
  );
$$;

-- Recria polÃ­ticas de sirene_chamados usando a funÃ§Ã£o (sem SELECT em sirene_topicos)
DROP POLICY IF EXISTS "sirene_chamados_select" ON public.sirene_chamados;
CREATE POLICY "sirene_chamados_select"
  ON public.sirene_chamados FOR SELECT
  USING (
    aberto_por = auth.uid()
    OR public.get_my_sirene_papel() IN ('bombeiro', 'caneta_verde')
    OR public.user_has_topic_on_chamado(sirene_chamados.id, auth.uid())
  );

DROP POLICY IF EXISTS "sirene_chamados_update" ON public.sirene_chamados;
CREATE POLICY "sirene_chamados_update"
  ON public.sirene_chamados FOR UPDATE
  USING (
    aberto_por = auth.uid()
    OR public.get_my_sirene_papel() IN ('bombeiro', 'caneta_verde')
    OR public.user_has_topic_on_chamado(sirene_chamados.id, auth.uid())
  );

-- Recria polÃ­tica de sirene_topicos: sÃ³ consulta sirene_chamados (que nÃ£o consulta sirene_topicos nas polÃ­ticas)
DROP POLICY IF EXISTS "sirene_topicos_all" ON public.sirene_topicos;
CREATE POLICY "sirene_topicos_all"
  ON public.sirene_topicos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.sirene_chamados c
      WHERE c.id = sirene_topicos.chamado_id
        AND (
          c.aberto_por = auth.uid()
          OR public.get_my_sirene_papel() IN ('bombeiro', 'caneta_verde')
          OR public.user_has_topic_on_chamado(c.id, auth.uid())
        )
    )
  );

-- Anexos e mensagens: mesma lÃ³gica, sem EXISTS em sirene_topicos
DROP POLICY IF EXISTS "sirene_anexos_all" ON public.sirene_anexos;
CREATE POLICY "sirene_anexos_all"
  ON public.sirene_anexos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.sirene_chamados c
      WHERE c.id = sirene_anexos.chamado_id
        AND (
          c.aberto_por = auth.uid()
          OR public.get_my_sirene_papel() IN ('bombeiro', 'caneta_verde')
          OR public.user_has_topic_on_chamado(c.id, auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "sirene_mensagens_select" ON public.sirene_mensagens;
CREATE POLICY "sirene_mensagens_select"
  ON public.sirene_mensagens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sirene_chamados c
      WHERE c.id = sirene_mensagens.chamado_id
        AND (
          c.aberto_por = auth.uid()
          OR public.get_my_sirene_papel() IN ('bombeiro', 'caneta_verde')
          OR public.user_has_topic_on_chamado(c.id, auth.uid())
        )
    )
  );
-- Campo "Esse incÃªndio te trata?" para priorizaÃ§Ã£o de chamados
ALTER TABLE public.sirene_chamados
  ADD COLUMN IF NOT EXISTS te_trata BOOLEAN;

COMMENT ON COLUMN public.sirene_chamados.te_trata IS 'Resposta Ã  pergunta "Esse incÃªndio te trata?" (sim/nÃ£o). Usado para priorizar chamados.';
-- Trava por tÃ³pico (alÃ©m da trava do chamado)
ALTER TABLE public.sirene_topicos
  ADD COLUMN IF NOT EXISTS trava BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.sirene_topicos.trava IS 'Se este tÃ³pico tem trava (bloqueia avanÃ§o atÃ© ser resolvido).';
-- Status para fluxo: quando Bombeiro preenche fechamento, chamado aguarda aprovaÃ§Ã£o do criador.
ALTER TABLE public.sirene_chamados
  DROP CONSTRAINT IF EXISTS sirene_chamados_status_check;
ALTER TABLE public.sirene_chamados
  ADD CONSTRAINT sirene_chamados_status_check
  CHECK (status IN ('nao_iniciado', 'em_andamento', 'concluido', 'aguardando_aprovacao_criador'));

-- Origem do anexo: criador (abertura), time (tÃ³pico) ou bombeiro (fechamento).
ALTER TABLE public.sirene_anexos
  ADD COLUMN IF NOT EXISTS origem TEXT;

UPDATE public.sirene_anexos
SET origem = CASE
  WHEN topico_id IS NOT NULL THEN 'topico'
  ELSE 'criador'
END
WHERE origem IS NULL;

ALTER TABLE public.sirene_anexos
  DROP CONSTRAINT IF EXISTS sirene_anexos_origem_check;
ALTER TABLE public.sirene_anexos
  ADD CONSTRAINT sirene_anexos_origem_check
  CHECK (origem IS NULL OR origem IN ('criador', 'topico', 'fechamento_bombeiro'));

COMMENT ON COLUMN public.sirene_anexos.origem IS 'criador = anexo na abertura; topico = anexo da resoluÃ§Ã£o do time; fechamento_bombeiro = anexo ao concluir chamado.';
-- Chave API do Autentique por usuÃ¡rio: documento enviado para assinatura usa o login de quem estÃ¡ logado na ferramenta.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS autentique_api_key TEXT;

COMMENT ON COLUMN public.profiles.autentique_api_key IS 'Chave API do Autentique (painel) do usuÃ¡rio. Ao enviar documento para assinatura, usa esta chave; se vazia, usa AUTENTIQUE_API_KEY do ambiente.';
-- NotificaÃ§Ãµes Sirene: opcionalmente vinculadas a um tÃ³pico (ex.: atraso 2d, TOP 10)
ALTER TABLE public.sirene_notificacoes
  ADD COLUMN IF NOT EXISTS topico_id BIGINT REFERENCES public.sirene_topicos(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.sirene_notificacoes.topico_id IS 'TÃ³pico relacionado (ex.: notificaÃ§Ã£o de atraso ou TOP 10).';

CREATE INDEX IF NOT EXISTS idx_sirene_notificacoes_topico ON public.sirene_notificacoes(topico_id)
  WHERE topico_id IS NOT NULL;
-- Painel Novos NegÃ³cios: etapa no board (Kanban+Miro) e flag travado no card
ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS etapa_painel TEXT NOT NULL DEFAULT 'step_1',
  ADD COLUMN IF NOT EXISTS trava_painel BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.processo_step_one.etapa_painel IS 'Etapa atual no Painel Novos NegÃ³cios: step_1, step_2, step_3, step_4, acoplamento, step_5, step_6, step_7, contabilidade, passagem_wayser, planialtimetrico, sondagem, projeto_legal, aprovacao_condominio, aprovacao_prefeitura, credito_terreno, credito_obra';
COMMENT ON COLUMN public.processo_step_one.trava_painel IS 'Card marcado como travado no Painel (bloqueado/destacado).';

-- Backfill: processos existentes mantÃªm posiÃ§Ã£o pelo step_atual (1-5)
UPDATE public.processo_step_one
SET etapa_painel = CASE
  WHEN step_atual = 1 THEN 'step_1'
  WHEN step_atual = 2 THEN 'step_2'
  WHEN step_atual = 3 THEN 'step_3'
  WHEN step_atual = 4 THEN 'step_4'
  WHEN step_atual = 5 THEN 'step_5'
  ELSE 'step_1'
END
WHERE etapa_painel = 'step_1' AND step_atual BETWEEN 1 AND 5;
-- Tipo de aquisiÃ§Ã£o do terreno: se = 'Permuta', a etapa CrÃ©dito Terreno Ã© desconsiderada no Painel
ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS tipo_aquisicao_terreno TEXT;

COMMENT ON COLUMN public.processo_step_one.tipo_aquisicao_terreno IS 'Ex.: Compra, Permuta. Se Permuta, a esteira CrÃ©dito Terreno nÃ£o se aplica.';
-- Painel Novos NegÃ³cios: comentÃ¡rios no card com @menÃ§Ãµes, checklist por etapa, tÃ³picos por etapa

-- ComentÃ¡rios no card (processo)
CREATE TABLE IF NOT EXISTS public.processo_card_comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  autor_nome TEXT,
  texto TEXT NOT NULL,
  mencoes UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processo_card_comentarios_processo ON public.processo_card_comentarios(processo_id);

COMMENT ON TABLE public.processo_card_comentarios IS 'ComentÃ¡rios nos cards do Painel; suporta @usuÃ¡rios (mencoes) para notificaÃ§Ãµes.';

-- Checklist por card e etapa (itens editÃ¡veis)
CREATE TABLE IF NOT EXISTS public.processo_card_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  etapa_painel TEXT NOT NULL,
  titulo TEXT NOT NULL,
  concluido BOOLEAN NOT NULL DEFAULT false,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processo_card_checklist_processo ON public.processo_card_checklist(processo_id);
CREATE INDEX IF NOT EXISTS idx_processo_card_checklist_etapa ON public.processo_card_checklist(processo_id, etapa_painel);

COMMENT ON TABLE public.processo_card_checklist IS 'Itens de checklist dentro de cada card, por etapa do Painel.';

-- TÃ³picos por etapa (tarefas: prioridade, responsÃ¡vel, data, status, resposta/anexo)
CREATE TABLE IF NOT EXISTS public.processo_etapa_topicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  etapa_painel TEXT NOT NULL,
  titulo TEXT NOT NULL,
  prioridade TEXT DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta')),
  responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  responsavel_nome TEXT,
  data_entrega DATE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluido')),
  resposta TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processo_etapa_topicos_processo ON public.processo_etapa_topicos(processo_id);
CREATE INDEX IF NOT EXISTS idx_processo_etapa_topicos_responsavel ON public.processo_etapa_topicos(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_processo_etapa_topicos_etapa ON public.processo_etapa_topicos(processo_id, etapa_painel);

COMMENT ON TABLE public.processo_etapa_topicos IS 'TÃ³picos/tarefas por etapa do Painel; responsÃ¡vel altera status e adiciona resposta/anexo.';

-- Anexos dos tÃ³picos
CREATE TABLE IF NOT EXISTS public.processo_etapa_topicos_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topico_id UUID NOT NULL REFERENCES public.processo_etapa_topicos(id) ON DELETE CASCADE,
  uploader_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  nome_original TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processo_etapa_topicos_anexos_topico ON public.processo_etapa_topicos_anexos(topico_id);

-- RLS: mesmo critÃ©rio de processo_step_one (dono, consultor da carteira, admin)
ALTER TABLE public.processo_card_comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processo_card_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processo_etapa_topicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processo_etapa_topicos_anexos ENABLE ROW LEVEL SECURITY;

-- PolÃ­ticas: quem vÃª o processo vÃª/edita comentÃ¡rios, checklist e tÃ³picos
CREATE POLICY "processo_card_comentarios_all"
  ON public.processo_card_comentarios FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = processo_card_comentarios.processo_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = auth.uid() AND pf.role = 'admin')
        OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
      )
    )
  );

CREATE POLICY "processo_card_checklist_all"
  ON public.processo_card_checklist FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = processo_card_checklist.processo_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = auth.uid() AND pf.role = 'admin')
        OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
      )
    )
  );

CREATE POLICY "processo_etapa_topicos_all"
  ON public.processo_etapa_topicos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = processo_etapa_topicos.processo_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = auth.uid() AND pf.role = 'admin')
        OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
      )
    )
  );

CREATE POLICY "processo_etapa_topicos_anexos_all"
  ON public.processo_etapa_topicos_anexos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.processo_etapa_topicos t
      JOIN public.processo_step_one p ON p.id = t.processo_id
      WHERE t.id = processo_etapa_topicos_anexos.topico_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = auth.uid() AND pf.role = 'admin')
        OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
      )
    )
  );
-- ObservaÃ§Ãµes do formulÃ¡rio inicial (abertura do processo/card no Painel)
ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS observacoes TEXT;

COMMENT ON COLUMN public.processo_step_one.observacoes IS 'ObservaÃ§Ãµes preenchidas no formulÃ¡rio de abertura do processo (Novo card / Novo Step 1).';
-- Campos do formulÃ¡rio Novo Card (Nova Casa MonÃ­ Estudo)
ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS nome_franqueado TEXT,
  ADD COLUMN IF NOT EXISTS email_franqueado TEXT,
  ADD COLUMN IF NOT EXISTS nome_condominio TEXT,
  ADD COLUMN IF NOT EXISTS quadra_lote TEXT,
  ADD COLUMN IF NOT EXISTS valor_terreno TEXT,
  ADD COLUMN IF NOT EXISTS vgv_pretendido TEXT,
  ADD COLUMN IF NOT EXISTS produto_modelo_casa TEXT,
  ADD COLUMN IF NOT EXISTS link_pasta_drive TEXT;

COMMENT ON COLUMN public.processo_step_one.nome_franqueado IS 'Nome completo do franqueado (formulÃ¡rio Novo Card).';
COMMENT ON COLUMN public.processo_step_one.email_franqueado IS 'E-mail do franqueado (formulÃ¡rio Novo Card).';
COMMENT ON COLUMN public.processo_step_one.nome_condominio IS 'Nome do condomÃ­nio (formulÃ¡rio Novo Card).';
COMMENT ON COLUMN public.processo_step_one.quadra_lote IS 'Quadra e lote, se definido (formulÃ¡rio Novo Card).';
COMMENT ON COLUMN public.processo_step_one.valor_terreno IS 'Valor do terreno (formulÃ¡rio Novo Card).';
COMMENT ON COLUMN public.processo_step_one.vgv_pretendido IS 'VGV pretendido (formulÃ¡rio Novo Card).';
COMMENT ON COLUMN public.processo_step_one.produto_modelo_casa IS 'Produto/Modelo da casa: Lis, Cissa, Gal, Ivy, Eva, Mia, Sol (formulÃ¡rio Novo Card).';
COMMENT ON COLUMN public.processo_step_one.link_pasta_drive IS 'Link da pasta no drive compartilhado (formulÃ¡rio Novo Card).';
-- Campos do formulÃ¡rio Novo Step 1 (imagens: franquia, modalidade, responsÃ¡vel, sÃ³cios, etc.)
ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS numero_franquia TEXT,
  ADD COLUMN IF NOT EXISTS modalidade TEXT,
  ADD COLUMN IF NOT EXISTS status_franquia TEXT,
  ADD COLUMN IF NOT EXISTS classificacao_franqueado TEXT,
  ADD COLUMN IF NOT EXISTS area_atuacao_franquia TEXT,
  ADD COLUMN IF NOT EXISTS responsavel_comercial TEXT,
  ADD COLUMN IF NOT EXISTS tamanho_camiseta_frank TEXT,
  ADD COLUMN IF NOT EXISTS socios TEXT;

COMMENT ON COLUMN public.processo_step_one.numero_franquia IS 'NÂº de franquia (formulÃ¡rio Novo Step 1).';
COMMENT ON COLUMN public.processo_step_one.modalidade IS 'Modalidade (formulÃ¡rio Novo Step 1).';
COMMENT ON COLUMN public.processo_step_one.status_franquia IS 'Status da Franquia (formulÃ¡rio Novo Step 1).';
COMMENT ON COLUMN public.processo_step_one.classificacao_franqueado IS 'ClassificaÃ§Ã£o do Franqueado (formulÃ¡rio Novo Step 1).';
COMMENT ON COLUMN public.processo_step_one.area_atuacao_franquia IS 'Ãrea de AtuaÃ§Ã£o da Franquia (formulÃ¡rio Novo Step 1).';
COMMENT ON COLUMN public.processo_step_one.responsavel_comercial IS 'ResponsÃ¡vel Comercial (formulÃ¡rio Novo Step 1).';
COMMENT ON COLUMN public.processo_step_one.tamanho_camiseta_frank IS 'Tamanho da Camiseta do Frank (formulÃ¡rio Novo Step 1).';
COMMENT ON COLUMN public.processo_step_one.socios IS 'SÃ³cios: Nome, Nascimento, Telefone, E-mail, CPF, EndereÃ§o Completo, Tamanho etc. (formulÃ¡rio Novo Step 1).';
-- Ao criar um processo pelo formulÃ¡rio Novo Step 1, criar tambÃ©m uma linha na rede de franqueados.
-- FunÃ§Ã£o executada como definer para poder inserir mesmo com RLS (apenas admin podia inserir).

CREATE OR REPLACE FUNCTION public.inserir_rede_franqueados_ao_criar_step1()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proxima_ordem INT;
BEGIN
  -- SÃ³ prosseguir se for processo criado na etapa Step 1 e tiver dados do formulÃ¡rio Step 1
  IF NEW.etapa_painel IS DISTINCT FROM 'step_1' THEN
    RETURN NEW;
  END IF;
  IF NEW.numero_franquia IS NULL AND NEW.nome_franqueado IS NULL AND NEW.email_franqueado IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(ordem), 0) + 1 INTO proxima_ordem FROM public.rede_franqueados;

  INSERT INTO public.rede_franqueados (
    ordem,
    n_franquia,
    nome_completo,
    status_franquia,
    classificacao_franqueado,
    area_atuacao,
    email_frank,
    tamanho_camisa_frank,
    socios
  ) VALUES (
    proxima_ordem,
    NULLIF(TRIM(NEW.numero_franquia), ''),
    NULLIF(TRIM(NEW.nome_franqueado), ''),
    NULLIF(TRIM(NEW.status_franquia), ''),
    NULLIF(TRIM(NEW.classificacao_franqueado), ''),
    NULLIF(TRIM(NEW.area_atuacao_franquia), ''),
    NULLIF(TRIM(NEW.email_franqueado), ''),
    NULLIF(TRIM(NEW.tamanho_camiseta_frank), ''),
    NULLIF(TRIM(NEW.socios), '')
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_processo_step_one_inserir_rede ON public.processo_step_one;
CREATE TRIGGER trg_processo_step_one_inserir_rede
  AFTER INSERT ON public.processo_step_one
  FOR EACH ROW
  EXECUTE PROCEDURE public.inserir_rede_franqueados_ao_criar_step1();

COMMENT ON FUNCTION public.inserir_rede_franqueados_ao_criar_step1() IS 'Ao inserir processo com etapa_painel=step_1 e dados do formulÃ¡rio, cria linha na rede_franqueados.';
-- Vincular rede_franqueados ao card (processo) criado no Painel.
-- Quando um processo Ã© criado A PARTIR de uma linha da rede, nÃ£o duplicar a linha (trigger nÃ£o insere).

-- 1) Coluna na rede: qual processo/card foi criado para esta linha
ALTER TABLE public.rede_franqueados
  ADD COLUMN IF NOT EXISTS processo_id UUID REFERENCES public.processo_step_one(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.rede_franqueados.processo_id IS 'Processo (card) criado no Painel Novos NegÃ³cios a partir desta linha. Preenchido ao rodar "Criar cards a partir da tabela".';

-- 2) Coluna no processo: indica que o card veio de uma linha da rede (trigger nÃ£o cria nova linha)
ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS origem_rede_franqueados_id UUID REFERENCES public.rede_franqueados(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.processo_step_one.origem_rede_franqueados_id IS 'Se preenchido, o processo foi criado a partir desta linha da rede; o trigger nÃ£o deve criar nova linha em rede_franqueados.';

-- 3) Trigger: nÃ£o inserir em rede_franqueados quando o processo jÃ¡ veio da rede
CREATE OR REPLACE FUNCTION public.inserir_rede_franqueados_ao_criar_step1()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proxima_ordem INT;
BEGIN
  -- NÃ£o criar linha se o processo foi criado a partir de uma linha da rede
  IF NEW.origem_rede_franqueados_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  -- SÃ³ prosseguir se for processo criado na etapa Step 1 e tiver dados do formulÃ¡rio Step 1
  IF NEW.etapa_painel IS DISTINCT FROM 'step_1' THEN
    RETURN NEW;
  END IF;
  IF NEW.numero_franquia IS NULL AND NEW.nome_franqueado IS NULL AND NEW.email_franqueado IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(ordem), 0) + 1 INTO proxima_ordem FROM public.rede_franqueados;

  INSERT INTO public.rede_franqueados (
    ordem,
    n_franquia,
    nome_completo,
    status_franquia,
    classificacao_franqueado,
    area_atuacao,
    email_frank,
    tamanho_camisa_frank,
    socios
  ) VALUES (
    proxima_ordem,
    NULLIF(TRIM(NEW.numero_franquia), ''),
    NULLIF(TRIM(NEW.nome_franqueado), ''),
    NULLIF(TRIM(NEW.status_franquia), ''),
    NULLIF(TRIM(NEW.classificacao_franqueado), ''),
    NULLIF(TRIM(NEW.area_atuacao_franquia), ''),
    NULLIF(TRIM(NEW.email_franqueado), ''),
    NULLIF(TRIM(NEW.tamanho_camiseta_frank), ''),
    NULLIF(TRIM(NEW.socios), '')
  );

  RETURN NEW;
END;
$$;
-- Esvaziar rede_franqueados (ex.: dados de seed).
-- Evita TRUNCATE, que falha quando hÃ¡ FKs ativas.
-- Primeiro zera as colunas FK que apontam para public.rede_franqueados, depois faz DELETE.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conrelid::regclass AS tbl, a.attname AS col
    FROM pg_constraint c
    JOIN LATERAL unnest(c.conkey) AS u(attnum) ON true
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.attnum AND NOT a.attisdropped
    WHERE c.confrelid = 'public.rede_franqueados'::regclass
      AND c.contype = 'f'
  LOOP
    EXECUTE format('UPDATE %s SET %I = NULL WHERE %I IS NOT NULL', r.tbl, r.col, r.col);
  END LOOP;
END $$;

DELETE FROM public.rede_franqueados;
-- EndereÃ§o da casa do franqueado (formulÃ¡rio Novo Step 1) e cÃ³pia para rede_franqueados.
ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS endereco_casa_frank TEXT,
  ADD COLUMN IF NOT EXISTS cep_casa_frank TEXT,
  ADD COLUMN IF NOT EXISTS estado_casa_frank TEXT,
  ADD COLUMN IF NOT EXISTS cidade_casa_frank TEXT;

COMMENT ON COLUMN public.processo_step_one.endereco_casa_frank IS 'EndereÃ§o completo da casa do franqueado (Rua, nÃºmero, complemento).';
COMMENT ON COLUMN public.processo_step_one.cep_casa_frank IS 'CEP da casa do franqueado.';
COMMENT ON COLUMN public.processo_step_one.estado_casa_frank IS 'UF do endereÃ§o da casa do franqueado.';
COMMENT ON COLUMN public.processo_step_one.cidade_casa_frank IS 'Cidade do endereÃ§o da casa do franqueado.';

-- Atualizar trigger para copiar endereÃ§o para rede_franqueados
CREATE OR REPLACE FUNCTION public.inserir_rede_franqueados_ao_criar_step1()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proxima_ordem INT;
BEGIN
  IF NEW.origem_rede_franqueados_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.etapa_painel IS DISTINCT FROM 'step_1' THEN
    RETURN NEW;
  END IF;
  IF NEW.numero_franquia IS NULL AND NEW.nome_franqueado IS NULL AND NEW.email_franqueado IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(ordem), 0) + 1 INTO proxima_ordem FROM public.rede_franqueados;

  INSERT INTO public.rede_franqueados (
    ordem,
    n_franquia,
    nome_completo,
    status_franquia,
    classificacao_franqueado,
    area_atuacao,
    email_frank,
    tamanho_camisa_frank,
    socios,
    endereco_casa_frank,
    cep_casa_frank,
    estado_casa_frank,
    cidade_casa_frank
  ) VALUES (
    proxima_ordem,
    NULLIF(TRIM(NEW.numero_franquia), ''),
    NULLIF(TRIM(NEW.nome_franqueado), ''),
    NULLIF(TRIM(NEW.status_franquia), ''),
    NULLIF(TRIM(NEW.classificacao_franqueado), ''),
    NULLIF(TRIM(NEW.area_atuacao_franquia), ''),
    NULLIF(TRIM(NEW.email_franqueado), ''),
    NULLIF(TRIM(NEW.tamanho_camiseta_frank), ''),
    NULLIF(TRIM(NEW.socios), ''),
    NULLIF(TRIM(NEW.endereco_casa_frank), ''),
    NULLIF(TRIM(NEW.cep_casa_frank), ''),
    NULLIF(TRIM(NEW.estado_casa_frank), ''),
    NULLIF(TRIM(NEW.cidade_casa_frank), '')
  );

  RETURN NEW;
END;
$$;
-- Campos adicionais do formulÃ¡rio Novo Step 1: datas (COF, contrato, expiraÃ§Ã£o), telefone, CPF, data nasc. do franqueado.
ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS data_ass_cof DATE,
  ADD COLUMN IF NOT EXISTS data_ass_contrato DATE,
  ADD COLUMN IF NOT EXISTS data_expiracao_franquia DATE,
  ADD COLUMN IF NOT EXISTS telefone_frank TEXT,
  ADD COLUMN IF NOT EXISTS cpf_frank TEXT,
  ADD COLUMN IF NOT EXISTS data_nasc_frank DATE;

COMMENT ON COLUMN public.processo_step_one.data_ass_cof IS 'Data de Assinatura COF (formulÃ¡rio Novo Step 1).';
COMMENT ON COLUMN public.processo_step_one.data_ass_contrato IS 'Data de Assinatura do Contrato (formulÃ¡rio Novo Step 1).';
COMMENT ON COLUMN public.processo_step_one.data_expiracao_franquia IS 'Data de ExpiraÃ§Ã£o da Franquia (geralmente Data Ass. Contrato + 5 anos).';
COMMENT ON COLUMN public.processo_step_one.telefone_frank IS 'Telefone do franqueado (formulÃ¡rio Novo Step 1).';
COMMENT ON COLUMN public.processo_step_one.cpf_frank IS 'CPF do franqueado (formulÃ¡rio Novo Step 1).';
COMMENT ON COLUMN public.processo_step_one.data_nasc_frank IS 'Data de nascimento do franqueado (formulÃ¡rio Novo Step 1).';

-- Atualizar trigger para copiar para rede_franqueados
CREATE OR REPLACE FUNCTION public.inserir_rede_franqueados_ao_criar_step1()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proxima_ordem INT;
BEGIN
  IF NEW.origem_rede_franqueados_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.etapa_painel IS DISTINCT FROM 'step_1' THEN
    RETURN NEW;
  END IF;
  IF NEW.numero_franquia IS NULL AND NEW.nome_franqueado IS NULL AND NEW.email_franqueado IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(ordem), 0) + 1 INTO proxima_ordem FROM public.rede_franqueados;

  INSERT INTO public.rede_franqueados (
    ordem,
    n_franquia,
    nome_completo,
    status_franquia,
    classificacao_franqueado,
    area_atuacao,
    email_frank,
    telefone_frank,
    cpf_frank,
    data_nasc_frank,
    data_ass_cof,
    data_ass_contrato,
    data_expiracao_franquia,
    tamanho_camisa_frank,
    socios,
    endereco_casa_frank,
    cep_casa_frank,
    estado_casa_frank,
    cidade_casa_frank
  ) VALUES (
    proxima_ordem,
    NULLIF(TRIM(NEW.numero_franquia), ''),
    NULLIF(TRIM(NEW.nome_franqueado), ''),
    NULLIF(TRIM(NEW.status_franquia), ''),
    NULLIF(TRIM(NEW.classificacao_franqueado), ''),
    NULLIF(TRIM(NEW.area_atuacao_franquia), ''),
    NULLIF(TRIM(NEW.email_franqueado), ''),
    NULLIF(TRIM(NEW.telefone_frank), ''),
    NULLIF(TRIM(NEW.cpf_frank), ''),
    NEW.data_nasc_frank,
    NEW.data_ass_cof,
    NEW.data_ass_contrato,
    NEW.data_expiracao_franquia,
    NULLIF(TRIM(NEW.tamanho_camiseta_frank), ''),
    NULLIF(TRIM(NEW.socios), ''),
    NULLIF(TRIM(NEW.endereco_casa_frank), ''),
    NULLIF(TRIM(NEW.cep_casa_frank), ''),
    NULLIF(TRIM(NEW.estado_casa_frank), ''),
    NULLIF(TRIM(NEW.cidade_casa_frank), '')
  );

  RETURN NEW;
END;
$$;
-- Separar NÃºmero e Complemento no endereÃ§o da casa do franqueado
-- (formulÃ¡rio Novo Step 1) e refletir na rede_franqueados.

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS endereco_casa_frank_numero TEXT,
  ADD COLUMN IF NOT EXISTS endereco_casa_frank_complemento TEXT;

COMMENT ON COLUMN public.processo_step_one.endereco_casa_frank_numero IS 'NÃºmero do endereÃ§o da casa do franqueado.';
COMMENT ON COLUMN public.processo_step_one.endereco_casa_frank_complemento IS 'Complemento do endereÃ§o da casa do franqueado.';

ALTER TABLE public.rede_franqueados
  ADD COLUMN IF NOT EXISTS endereco_casa_frank_numero TEXT,
  ADD COLUMN IF NOT EXISTS endereco_casa_frank_complemento TEXT;

COMMENT ON COLUMN public.rede_franqueados.endereco_casa_frank_numero IS 'NÃºmero do endereÃ§o da casa do franqueado (importado/gerado do Step 1).';
COMMENT ON COLUMN public.rede_franqueados.endereco_casa_frank_complemento IS 'Complemento do endereÃ§o da casa do franqueado (importado/gerado do Step 1).';

-- Atualizar trigger para copiar tambÃ©m nÃºmero e complemento para rede_franqueados
CREATE OR REPLACE FUNCTION public.inserir_rede_franqueados_ao_criar_step1()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proxima_ordem INT;
BEGIN
  IF NEW.origem_rede_franqueados_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.etapa_painel IS DISTINCT FROM 'step_1' THEN
    RETURN NEW;
  END IF;
  IF NEW.numero_franquia IS NULL AND NEW.nome_franqueado IS NULL AND NEW.email_franqueado IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(ordem), 0) + 1 INTO proxima_ordem FROM public.rede_franqueados;

  INSERT INTO public.rede_franqueados (
    ordem,
    n_franquia,
    nome_completo,
    status_franquia,
    classificacao_franqueado,
    area_atuacao,
    email_frank,
    telefone_frank,
    cpf_frank,
    data_nasc_frank,
    data_ass_cof,
    data_ass_contrato,
    data_expiracao_franquia,
    tamanho_camisa_frank,
    socios,
    endereco_casa_frank,
    endereco_casa_frank_numero,
    endereco_casa_frank_complemento,
    cep_casa_frank,
    estado_casa_frank,
    cidade_casa_frank
  ) VALUES (
    proxima_ordem,
    NULLIF(TRIM(NEW.numero_franquia), ''),
    NULLIF(TRIM(NEW.nome_franqueado), ''),
    NULLIF(TRIM(NEW.status_franquia), ''),
    NULLIF(TRIM(NEW.classificacao_franqueado), ''),
    NULLIF(TRIM(NEW.area_atuacao_franquia), ''),
    NULLIF(TRIM(NEW.email_franqueado), ''),
    NULLIF(TRIM(NEW.telefone_frank), ''),
    NULLIF(TRIM(NEW.cpf_frank), ''),
    NEW.data_nasc_frank,
    NEW.data_ass_cof,
    NEW.data_ass_contrato,
    NEW.data_expiracao_franquia,
    NULLIF(TRIM(NEW.tamanho_camiseta_frank), ''),
    NULLIF(TRIM(NEW.socios), ''),
    NULLIF(TRIM(NEW.endereco_casa_frank), ''),
    NULLIF(TRIM(NEW.endereco_casa_frank_numero), ''),
    NULLIF(TRIM(NEW.endereco_casa_frank_complemento), ''),
    NULLIF(TRIM(NEW.cep_casa_frank), ''),
    NULLIF(TRIM(NEW.estado_casa_frank), ''),
    NULLIF(TRIM(NEW.cidade_casa_frank), '')
  );

  RETURN NEW;
END;
$$;

-- RemoÃ§Ã£o e cancelamento com motivo (Kanban)
-- "Remover": usado quando o card foi criado errado (nÃ£o deve aparecer no board, mas mantÃ©m histÃ³rico).
-- "Cancelar": usado quando o franqueado desistiu.

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS cancelado_motivo TEXT,
  ADD COLUMN IF NOT EXISTS removido_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS removido_motivo TEXT;

COMMENT ON COLUMN public.processo_step_one.cancelado_motivo IS 'Motivo do cancelamento do processo (Kanban).';
COMMENT ON COLUMN public.processo_step_one.removido_em IS 'Preenchido quando o card Ã© removido (criado errado).';
COMMENT ON COLUMN public.processo_step_one.removido_motivo IS 'Motivo da remoÃ§Ã£o do card (criado errado).';

-- Permitir status 'removido' no check constraint existente
ALTER TABLE public.processo_step_one
  DROP CONSTRAINT IF EXISTS processo_step_one_status_check;

ALTER TABLE public.processo_step_one
  ADD CONSTRAINT processo_step_one_status_check
  CHECK (status IN ('rascunho', 'em_andamento', 'concluido', 'cancelado', 'removido'));

-- Campos do Novo Step 1 que precisam existir tambÃ©m na Rede de Franqueados
ALTER TABLE public.rede_franqueados
  ADD COLUMN IF NOT EXISTS modalidade TEXT,
  ADD COLUMN IF NOT EXISTS responsavel_comercial TEXT;

COMMENT ON COLUMN public.rede_franqueados.modalidade IS 'Modalidade (formulÃ¡rio Novo Step 1).';
COMMENT ON COLUMN public.rede_franqueados.responsavel_comercial IS 'ResponsÃ¡vel Comercial (formulÃ¡rio Novo Step 1).';

-- Atualizar trigger para copiar modalidade e responsÃ¡vel comercial
CREATE OR REPLACE FUNCTION public.inserir_rede_franqueados_ao_criar_step1()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proxima_ordem INT;
BEGIN
  IF NEW.origem_rede_franqueados_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.etapa_painel IS DISTINCT FROM 'step_1' THEN
    RETURN NEW;
  END IF;
  IF NEW.numero_franquia IS NULL AND NEW.nome_franqueado IS NULL AND NEW.email_franqueado IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(ordem), 0) + 1 INTO proxima_ordem FROM public.rede_franqueados;

  INSERT INTO public.rede_franqueados (
    ordem,
    n_franquia,
    modalidade,
    nome_completo,
    status_franquia,
    classificacao_franqueado,
    area_atuacao,
    email_frank,
    telefone_frank,
    cpf_frank,
    data_nasc_frank,
    data_ass_cof,
    data_ass_contrato,
    data_expiracao_franquia,
    responsavel_comercial,
    tamanho_camisa_frank,
    socios,
    endereco_casa_frank,
    endereco_casa_frank_numero,
    endereco_casa_frank_complemento,
    cep_casa_frank,
    estado_casa_frank,
    cidade_casa_frank
  ) VALUES (
    proxima_ordem,
    NULLIF(TRIM(NEW.numero_franquia), ''),
    NULLIF(TRIM(NEW.modalidade), ''),
    NULLIF(TRIM(NEW.nome_franqueado), ''),
    NULLIF(TRIM(NEW.status_franquia), ''),
    NULLIF(TRIM(NEW.classificacao_franqueado), ''),
    NULLIF(TRIM(NEW.area_atuacao_franquia), ''),
    NULLIF(TRIM(NEW.email_franqueado), ''),
    NULLIF(TRIM(NEW.telefone_frank), ''),
    NULLIF(TRIM(NEW.cpf_frank), ''),
    NEW.data_nasc_frank,
    NEW.data_ass_cof,
    NEW.data_ass_contrato,
    NEW.data_expiracao_franquia,
    NULLIF(TRIM(NEW.responsavel_comercial), ''),
    NULLIF(TRIM(NEW.tamanho_camiseta_frank), ''),
    NULLIF(TRIM(NEW.socios), ''),
    NULLIF(TRIM(NEW.endereco_casa_frank), ''),
    NULLIF(TRIM(NEW.endereco_casa_frank_numero), ''),
    NULLIF(TRIM(NEW.endereco_casa_frank_complemento), ''),
    NULLIF(TRIM(NEW.cep_casa_frank), ''),
    NULLIF(TRIM(NEW.estado_casa_frank), ''),
    NULLIF(TRIM(NEW.cidade_casa_frank), '')
  );

  RETURN NEW;
END;
$$;

-- Community Timeline (Sino Virtual + interaÃ§Ãµes)

create table if not exists community_posts (
  id uuid primary key default gen_random_uuid(),
  author_type text default 'moni',
  tipo text,
  titulo text,
  conteudo text,
  sino_html text,
  -- No projeto atual a tabela se chama rede_franqueados (nÃ£o "franqueados")
  franqueado_id uuid references rede_franqueados(id),
  created_at timestamptz default now()
);

create table if not exists community_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references community_posts(id) on delete cascade,
  user_id uuid references auth.users(id),
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

create table if not exists community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references community_posts(id) on delete cascade,
  user_id uuid references auth.users(id),
  texto text check (texto = 'Bem-vindo'),
  created_at timestamptz default now()
);

-- RLS
alter table community_posts enable row level security;
create policy "Leitura publica autenticada" on community_posts
  for select using (auth.role() = 'authenticated');
create policy "Insert apenas service role" on community_posts
  for insert with check (auth.role() = 'service_role');

alter table community_likes enable row level security;
create policy "Leitura autenticada" on community_likes
  for select using (auth.role() = 'authenticated');
create policy "Like pelo proprio usuario" on community_likes
  for insert with check (auth.uid() = user_id);
create policy "Unlike pelo proprio usuario" on community_likes
  for delete using (auth.uid() = user_id);

alter table community_comments enable row level security;
create policy "Leitura autenticada" on community_comments
  for select using (auth.role() = 'authenticated');
create policy "Comentario apenas Bem-vindo" on community_comments
  for insert with check (auth.uid() = user_id and texto = 'Bem-vindo');

-- Painel Novos NegÃ³cios: checklist por card com prazo e responsÃ¡vel

ALTER TABLE public.processo_card_checklist
  ADD COLUMN IF NOT EXISTS prazo TEXT;

ALTER TABLE public.processo_card_checklist
  ADD COLUMN IF NOT EXISTS responsavel_nome TEXT;

-- Fix: ao excluir linhas de public.rede_franqueados, impedir bloqueio por FK em community_posts.
-- O projeto guarda posts ligados ao franqueado via `community_posts.franqueado_id`.
-- Sem aÃ§Ã£o ON DELETE, o Postgres impede a exclusÃ£o.

DO $$
BEGIN
  -- Drop das constraints antigas (nomes variam conforme typo/existÃªncia)
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'community_posts'
      AND constraint_name = 'community_posts_franchiseado_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE public.community_posts DROP CONSTRAINT community_posts_franchiseado_id_fkey';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'community_posts'
      AND constraint_name = 'community_posts_franqueado_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE public.community_posts DROP CONSTRAINT community_posts_franqueado_id_fkey';
  END IF;

  -- Recria as constraints com ON DELETE SET NULL (a coluna Ã© nullable).
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'community_posts'
      AND column_name = 'franqueado_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.community_posts
      ADD CONSTRAINT community_posts_franqueado_id_fkey
      FOREIGN KEY (franqueado_id) REFERENCES public.rede_franqueados(id) ON DELETE SET NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'community_posts'
      AND column_name = 'franchiseado_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.community_posts
      ADD CONSTRAINT community_posts_franchiseado_id_fkey
      FOREIGN KEY (franchiseado_id) REFERENCES public.rede_franqueados(id) ON DELETE SET NULL';
  END IF;
END $$;

-- RLS: precisa permitir UPDATE/DELETE em community_posts para que a aÃ§Ã£o do FK funcione.
-- Sem polÃ­tica, a mudanÃ§a para SET NULL pode ser bloqueada.
DROP POLICY IF EXISTS "Update comunidade por admin" ON public.community_posts;
DROP POLICY IF EXISTS "Delete comunidade por admin" ON public.community_posts;

CREATE POLICY "Update comunidade por admin"
  ON public.community_posts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles pf
      WHERE pf.id = auth.uid() AND pf.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles pf
      WHERE pf.id = auth.uid() AND pf.role = 'admin'
    )
  );

CREATE POLICY "Delete comunidade por admin"
  ON public.community_posts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles pf
      WHERE pf.id = auth.uid() AND pf.role = 'admin'
    )
  );

-- Documentos por card (Painel Novos NegÃ³cios)

CREATE TABLE IF NOT EXISTS public.processo_card_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  etapa_painel TEXT NOT NULL,
  titulo TEXT NOT NULL,
  storage_path TEXT,
  nome_original TEXT,
  link_url TEXT,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processo_card_documentos_processo ON public.processo_card_documentos(processo_id);
CREATE INDEX IF NOT EXISTS idx_processo_card_documentos_etapa ON public.processo_card_documentos(processo_id, etapa_painel);

ALTER TABLE public.processo_card_documentos ENABLE ROW LEVEL SECURITY;

-- Permitir editar documentos do card conforme donos/consultor da carteira (mesma regra de processo_card_checklist)
CREATE POLICY "processo_card_documentos_all"
  ON public.processo_card_documentos
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = processo_card_documentos.processo_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = auth.uid() AND pf.role = 'admin')
        OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
      )
    )
  );

-- Permitir comentÃ¡rios com qualquer texto (antes era restrito a "Bem-vindo").

DROP POLICY IF EXISTS "Comentario apenas Bem-vindo" ON public.community_comments;

CREATE POLICY "Comentario autenticado" 
  ON public.community_comments
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND texto IS NOT NULL
    AND length(trim(texto)) > 0
  );

-- Remover constraint que limitava texto a apenas "Bem-vindo".
-- Isso Ã© necessÃ¡rio para permitir comentÃ¡rios com qualquer texto (senÃ£o o INSERT falha no nÃ­vel de CHECK).

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      conname
    FROM pg_constraint
    WHERE conrelid = 'public.community_comments'::regclass
      AND pg_get_constraintdef(oid) ILIKE '%Bem-vindo%'
  LOOP
    EXECUTE format('ALTER TABLE public.community_comments DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- Checklist do Painel Novos NegÃ³cios: status (nÃ£o iniciada / em andamento / concluÃ­da)

ALTER TABLE public.processo_card_checklist
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'nao_iniciada';

-- garantir domÃ­nio de valores (mantÃ©m compatibilidade com Postgres existentes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'processo_card_checklist_status_check'
  ) THEN
    ALTER TABLE public.processo_card_checklist
      ADD CONSTRAINT processo_card_checklist_status_check
      CHECK (status IN ('nao_iniciada', 'em_andamento', 'concluido'));
  END IF;
END $$;

-- Backfill: derive do campo antigo "concluido"
UPDATE public.processo_card_checklist
SET status = CASE
  WHEN concluido IS TRUE THEN 'concluido'
  ELSE 'nao_iniciada'
END
WHERE status IS NULL OR status = 'nao_iniciada';

ALTER TABLE public.processo_card_checklist
  ADD COLUMN IF NOT EXISTS time_nome TEXT;

CREATE TABLE IF NOT EXISTS public.processo_step1_area_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  area_nome TEXT NOT NULL,
  area_ordem INT NOT NULL DEFAULT 0,
  etapa_nome TEXT NOT NULL,
  concluido BOOLEAN NOT NULL DEFAULT FALSE,
  link_url TEXT,
  storage_path TEXT,
  nome_original TEXT,
  ativo_na_rede BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT processo_step1_area_checklist_unique UNIQUE (processo_id, area_nome, etapa_nome)
);

CREATE INDEX IF NOT EXISTS idx_step1_area_checklist_processo
  ON public.processo_step1_area_checklist (processo_id);

CREATE INDEX IF NOT EXISTS idx_step1_area_checklist_processo_area
  ON public.processo_step1_area_checklist (processo_id, area_nome, area_ordem);

ALTER TABLE public.processo_step1_area_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "processo_step1_area_checklist_all"
  ON public.processo_step1_area_checklist
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = processo_step1_area_checklist.processo_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = auth.uid() AND pf.role = 'admin')
          OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
        )
    )
  );

-- HistÃ³rico de aÃ§Ãµes do card (checklists/anexos + movimentaÃ§Ãµes), para render no CardDetalheModal

CREATE TABLE IF NOT EXISTS public.processo_card_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  autor_nome TEXT,
  etapa_painel TEXT,
  tipo TEXT NOT NULL,
  descricao TEXT,
  detalhes JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processo_card_eventos_processo ON public.processo_card_eventos(processo_id);
CREATE INDEX IF NOT EXISTS idx_processo_card_eventos_created ON public.processo_card_eventos(created_at);

ALTER TABLE public.processo_card_eventos ENABLE ROW LEVEL SECURITY;

-- SELECT/INSERT: mesma regra de acesso do painel (dono, consultor da carteira, admin)
CREATE POLICY "processo_card_eventos_select" ON public.processo_card_eventos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = processo_card_eventos.processo_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = auth.uid() AND pf.role = 'admin')
          OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
        )
    )
  );

CREATE POLICY "processo_card_eventos_insert" ON public.processo_card_eventos
  FOR INSERT
  WITH CHECK (
    autor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = processo_card_eventos.processo_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = auth.uid() AND pf.role = 'admin')
          OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
        )
    )
  );

-- ConexÃ£o entre card "pai" (Step 3/6) e card "filho" no Painel CrÃ©dito.
-- TambÃ©m habilita compartilhamento do mesmo histÃ³rico/dados via historico_base_id.

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS historico_base_id UUID REFERENCES public.processo_step_one(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origem_credito_processo_id UUID REFERENCES public.processo_step_one(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.processo_step_one.historico_base_id IS 'ID base para compartilhar histÃ³rico/dados entre cards conectados (ex.: crÃ©dito).';
COMMENT ON COLUMN public.processo_step_one.origem_credito_processo_id IS 'Se preenchido, indica que este card Ã© filho criado no Painel CrÃ©dito a partir deste processo pai.';

-- Backfill: processos existentes passam a usar o prÃ³prio id como base.
UPDATE public.processo_step_one
SET historico_base_id = id
WHERE historico_base_id IS NULL;

-- Evitar duplicar cards filhos no crÃ©dito.
CREATE UNIQUE INDEX IF NOT EXISTS uidx_credito_filhos_uma_vez
ON public.processo_step_one (origem_credito_processo_id, etapa_painel)
WHERE origem_credito_processo_id IS NOT NULL;

-- Checklist Legal (Step 4: Check Legal + Checklist de CrÃ©dito)
-- PersistÃªncia das respostas + anexos do checklist, com reaproveitamento por "nome_condominio".

CREATE TABLE IF NOT EXISTS public.processo_card_checklist_legal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  nome_condominio TEXT NOT NULL,
  respostas_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  arquivos_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  completo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_processo_card_checklist_legal_processo
  ON public.processo_card_checklist_legal (processo_id);

CREATE INDEX IF NOT EXISTS idx_processo_card_checklist_legal_condominio
  ON public.processo_card_checklist_legal (nome_condominio);

ALTER TABLE public.processo_card_checklist_legal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "processo_card_checklist_legal_all"
  ON public.processo_card_checklist_legal
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = processo_card_checklist_legal.processo_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = auth.uid() AND pf.role = 'admin')
          OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
        )
    )
  );

-- Checklist CrÃ©dito (Step 4)

CREATE TABLE IF NOT EXISTS public.checklist_credito (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  franqueado_id UUID,
  nome_franqueado TEXT,

  -- ImÃ³vel
  upload_iptu TEXT,
  upload_matricula TEXT,
  upload_orcamento_cronograma TEXT,
  upload_projeto_aprovado TEXT,

  -- Documentos pessoais
  uploads_documentos_pessoais TEXT[],

  -- Categoria profissional
  categoria_profissional TEXT,

  -- EmpresÃ¡rio
  upload_contrato_social TEXT,
  uploads_extratos_pf TEXT[],
  upload_irpf TEXT,
  operacao_acima_3m BOOLEAN,
  uploads_extratos_pj TEXT[],
  upload_faturamento_12m TEXT,

  -- Assalariado
  uploads_ctps TEXT[],
  uploads_holerite TEXT[],

  -- FuncionÃ¡rio PÃºblico / Aposentado
  upload_comprovante_salario TEXT,

  -- Profissional Liberal / AutÃ´nomo
  descricao_atividade TEXT,
  presta_servico_empresas BOOLEAN,
  upload_contrato_prestacao TEXT,

  -- Renda de Aluguel
  upload_contrato_aluguel TEXT,
  uploads_extratos_aluguel TEXT[],

  -- PJ
  valor_operacao_pj TEXT,
  upload_contrato_social_pj TEXT,
  upload_faturamento_pj TEXT,
  uploads_extratos_pj_cc TEXT[],
  upload_balanco_dre TEXT,
  endividamento_info TEXT,

  preenchido_por UUID REFERENCES auth.users(id),
  completo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_checklist_credito_processo ON public.checklist_credito(processo_id);
CREATE INDEX IF NOT EXISTS idx_checklist_credito_franqueado ON public.checklist_credito(franqueado_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.credito_acesso_permitido (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  nome TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_credito_acesso_permitido_user_id ON public.credito_acesso_permitido(user_id);

ALTER TABLE public.checklist_credito ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura autenticada" ON public.checklist_credito;
CREATE POLICY "Leitura autenticada"
  ON public.checklist_credito
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Insert autenticado" ON public.checklist_credito;
CREATE POLICY "Insert autenticado"
  ON public.checklist_credito
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Update pelo preenchedor" ON public.checklist_credito;
CREATE POLICY "Update pelo preenchedor"
  ON public.checklist_credito
  FOR UPDATE
  USING (auth.uid() = preenchido_por);

ALTER TABLE public.credito_acesso_permitido ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura autenticada" ON public.credito_acesso_permitido;
CREATE POLICY "Leitura autenticada"
  ON public.credito_acesso_permitido
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Dados complementares do ComitÃª no card (Step 5)

CREATE TABLE IF NOT EXISTS public.processo_card_comite (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  etapa_painel TEXT NOT NULL DEFAULT 'step_5',
  comite_moni_concluido BOOLEAN NOT NULL DEFAULT false,
  parecer_texto TEXT,
  link_url TEXT,
  storage_path TEXT,
  nome_original TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_processo_card_comite_processo
  ON public.processo_card_comite (processo_id);

ALTER TABLE public.processo_card_comite ENABLE ROW LEVEL SECURITY;

CREATE POLICY "processo_card_comite_all"
  ON public.processo_card_comite
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.processo_step_one p
      WHERE p.id = processo_card_comite.processo_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = auth.uid() AND pf.role = 'admin')
          OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
        )
    )
  );

-- ConexÃ£o entre card pai (Novos NegÃ³cios) e cards filhos no Painel de Contabilidade.

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS origem_contabilidade_processo_id UUID REFERENCES public.processo_step_one(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.processo_step_one.origem_contabilidade_processo_id
  IS 'Se preenchido, indica que este card Ã© filho criado no Painel Contabilidade a partir deste processo pai.';

-- Compatibilidade com versÃ£o antiga (coluna "contabilidade" no fluxo principal)
UPDATE public.processo_step_one
SET etapa_painel = 'contabilidade_incorporadora'
WHERE etapa_painel = 'contabilidade';

-- Evitar duplicaÃ§Ã£o de filhos no painel contabilidade.
CREATE UNIQUE INDEX IF NOT EXISTS uidx_contabilidade_filhos_uma_vez
ON public.processo_step_one (origem_contabilidade_processo_id, etapa_painel)
WHERE origem_contabilidade_processo_id IS NOT NULL
  AND etapa_painel IN ('contabilidade_incorporadora', 'contabilidade_spe', 'contabilidade_gestora');

-- Parecer textual opcional por item de checklist (ex.: Comunique-se)

CREATE TABLE IF NOT EXISTS public.processo_card_checklist_pareceres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id UUID NOT NULL REFERENCES public.processo_card_checklist(id) ON DELETE CASCADE,
  texto TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_processo_card_checklist_pareceres_item
  ON public.processo_card_checklist_pareceres (checklist_item_id);

ALTER TABLE public.processo_card_checklist_pareceres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "processo_card_checklist_pareceres_all"
  ON public.processo_card_checklist_pareceres
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.processo_card_checklist c
      JOIN public.processo_step_one p ON p.id = c.processo_id
      WHERE c.id = processo_card_checklist_pareceres.checklist_item_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.id = auth.uid() AND pf.role = 'admin')
          OR (p.user_id IN (SELECT id FROM public.profiles WHERE consultor_id = auth.uid()))
        )
    )
  );

alter table public.processo_step_one
  add column if not exists previsao_aprovacao_condominio text,
  add column if not exists previsao_aprovacao_prefeitura text,
  add column if not exists previsao_emissao_alvara text,
  add column if not exists previsao_liberacao_credito_obra text,
  add column if not exists previsao_inicio_obra text;

comment on column public.processo_step_one.previsao_aprovacao_condominio is 'Dados PrÃ© Obra: previsÃ£o de aprovaÃ§Ã£o no condomÃ­nio';
comment on column public.processo_step_one.previsao_aprovacao_prefeitura is 'Dados PrÃ© Obra: previsÃ£o de aprovaÃ§Ã£o na prefeitura';
comment on column public.processo_step_one.previsao_emissao_alvara is 'Dados PrÃ© Obra: previsÃ£o de emissÃ£o do alvarÃ¡';
comment on column public.processo_step_one.previsao_liberacao_credito_obra is 'Dados PrÃ© Obra: previsÃ£o de liberaÃ§Ã£o do crÃ©dito para obra';
comment on column public.processo_step_one.previsao_inicio_obra is 'Dados PrÃ© Obra: previsÃ£o de inÃ­cio de obra';
alter table public.processo_card_documentos
  add column if not exists texto_livre text,
  add column if not exists anexos_json jsonb not null default '[]'::jsonb;

comment on column public.processo_card_documentos.texto_livre is 'Campo de texto livre para documentos especÃ­ficos (ex.: Gadgets no Step 2)';
comment on column public.processo_card_documentos.anexos_json is 'Lista de anexos extras por documento: [{storage_path,nome_original}]';
create table if not exists public.checklist_incorporadora (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid references public.processo_step_one(id) on delete cascade,
  cnpj text,
  razao_social text,
  nome_fantasia text,
  data_abertura date,
  situacao text check (situacao in ('Ativa', 'Inativa')),
  cnaes text[] not null default '{}',
  endereco text,
  inscricao_municipal_1 text,
  inscricao_municipal_2 text,
  upload_contrato_social text,
  upload_cartao_cnpj text,
  upload_comprovante_endereco text,
  preenchido_por uuid references auth.users(id),
  completo boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (processo_id)
);

create table if not exists public.checklist_spe (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid references public.processo_step_one(id) on delete cascade,
  cnpj text,
  razao_social text,
  nome_fantasia text,
  data_abertura date,
  situacao text check (situacao in ('Ativa', 'Inativa')),
  cnaes text[] not null default '{}',
  endereco text,
  inscricao_municipal_1 text,
  inscricao_municipal_2 text,
  upload_contrato_social text,
  upload_cartao_cnpj text,
  upload_comprovante_endereco text,
  preenchido_por uuid references auth.users(id),
  completo boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (processo_id)
);

create table if not exists public.checklist_gestora (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid references public.processo_step_one(id) on delete cascade,
  cnpj text,
  razao_social text,
  nome_fantasia text,
  data_abertura date,
  situacao text check (situacao in ('Ativa', 'Inativa')),
  cnaes text[] not null default '{}',
  endereco text,
  inscricao_municipal_1 text,
  inscricao_municipal_2 text,
  upload_contrato_social text,
  upload_cartao_cnpj text,
  upload_comprovante_endereco text,
  preenchido_por uuid references auth.users(id),
  completo boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (processo_id)
);

alter table public.checklist_incorporadora enable row level security;
alter table public.checklist_spe enable row level security;
alter table public.checklist_gestora enable row level security;

drop policy if exists "Leitura autenticada" on public.checklist_incorporadora;
drop policy if exists "Insert autenticado" on public.checklist_incorporadora;
drop policy if exists "Update pelo preenchedor" on public.checklist_incorporadora;
create policy "Leitura autenticada" on public.checklist_incorporadora
  for select using (auth.role() = 'authenticated');
create policy "Insert autenticado" on public.checklist_incorporadora
  for insert with check (auth.role() = 'authenticated');
create policy "Update pelo preenchedor" on public.checklist_incorporadora
  for update using (auth.uid() = preenchido_por);

drop policy if exists "Leitura autenticada" on public.checklist_spe;
drop policy if exists "Insert autenticado" on public.checklist_spe;
drop policy if exists "Update pelo preenchedor" on public.checklist_spe;
create policy "Leitura autenticada" on public.checklist_spe
  for select using (auth.role() = 'authenticated');
create policy "Insert autenticado" on public.checklist_spe
  for insert with check (auth.role() = 'authenticated');
create policy "Update pelo preenchedor" on public.checklist_spe
  for update using (auth.uid() = preenchido_por);

drop policy if exists "Leitura autenticada" on public.checklist_gestora;
drop policy if exists "Insert autenticado" on public.checklist_gestora;
drop policy if exists "Update pelo preenchedor" on public.checklist_gestora;
create policy "Leitura autenticada" on public.checklist_gestora
  for select using (auth.role() = 'authenticated');
create policy "Insert autenticado" on public.checklist_gestora
  for insert with check (auth.role() = 'authenticated');
create policy "Update pelo preenchedor" on public.checklist_gestora
  for update using (auth.uid() = preenchido_por);
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'checklist-contabilidade',
  'checklist-contabilidade',
  true,
  10485760,
  array['application/pdf', 'image/png', 'image/jpeg']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'checklist_contabilidade_insert_auth'
  ) then
    create policy "checklist_contabilidade_insert_auth"
      on storage.objects for insert
      to authenticated
      with check (bucket_id = 'checklist-contabilidade');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'checklist_contabilidade_select_public'
  ) then
    create policy "checklist_contabilidade_select_public"
      on storage.objects for select
      to public
      using (bucket_id = 'checklist-contabilidade');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'checklist_contabilidade_update_auth'
  ) then
    create policy "checklist_contabilidade_update_auth"
      on storage.objects for update
      to authenticated
      using (bucket_id = 'checklist-contabilidade');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'checklist_contabilidade_delete_auth'
  ) then
    create policy "checklist_contabilidade_delete_auth"
      on storage.objects for delete
      to authenticated
      using (bucket_id = 'checklist-contabilidade');
  end if;
end $$;
alter table public.processo_card_comite
add column if not exists comite_resultado text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'processo_card_comite_resultado_check'
  ) then
    alter table public.processo_card_comite
    add constraint processo_card_comite_resultado_check
    check (comite_resultado in ('pendente', 'aprovado', 'reprovado'));
  end if;
end $$;

update public.processo_card_comite
set comite_resultado = 'pendente'
where comite_resultado is null;

alter table public.processo_card_comite
alter column comite_resultado set default 'pendente';
alter table public.processo_step_one
add column if not exists data_aprovacao_condominio date;

alter table public.processo_step_one
add column if not exists data_aprovacao_prefeitura date;

alter table public.processo_step_one
add column if not exists data_emissao_alvara date;
create table if not exists public.processo_public_form_links (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.processo_step_one(id) on delete cascade,
  form_type text not null check (form_type in ('legal', 'credito')),
  token text not null unique,
  expires_at timestamptz not null,
  created_by uuid null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_public_form_links_processo_type
  on public.processo_public_form_links (processo_id, form_type);

create index if not exists idx_public_form_links_token
  on public.processo_public_form_links (token);

alter table public.processo_public_form_links enable row level security;

drop policy if exists "public_form_links_auth_read" on public.processo_public_form_links;
create policy "public_form_links_auth_read"
  on public.processo_public_form_links
  for select
  to authenticated
  using (true);

drop policy if exists "public_form_links_auth_write" on public.processo_public_form_links;
create policy "public_form_links_auth_write"
  on public.processo_public_form_links
  for all
  to authenticated
  using (true)
  with check (true);
-- Dashboard Novos NegÃ³cios: campos em processo_step_one (equivalente ao spec kanban_cards / dados_pre_obra)

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS data_aprovacao_credito date;

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS motivo_reprovacao_comite text,
  ADD COLUMN IF NOT EXISTS motivo_reprovacao_outro text,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento text,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento_outro text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'processo_step_one_motivo_reprovacao_comite_check'
  ) THEN
    ALTER TABLE public.processo_step_one
      ADD CONSTRAINT processo_step_one_motivo_reprovacao_comite_check
      CHECK (
        motivo_reprovacao_comite IS NULL OR motivo_reprovacao_comite IN (
          'DocumentaÃ§Ã£o incompleta',
          'SPT ausente ou insuficiente',
          'Inviabilidade financeira',
          'Terreno com restriÃ§Ãµes legais',
          'VGV abaixo do mÃ­nimo',
          'Prazo de aprovaÃ§Ã£o inviÃ¡vel',
          'DesistÃªncia do franqueado',
          'ReprovaÃ§Ã£o pelo condomÃ­nio',
          'Outro'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'processo_step_one_motivo_cancelamento_check'
  ) THEN
    ALTER TABLE public.processo_step_one
      ADD CONSTRAINT processo_step_one_motivo_cancelamento_check
      CHECK (
        motivo_cancelamento IS NULL OR motivo_cancelamento IN (
          'Terreno inviÃ¡vel',
          'Inviabilidade financeira',
          'DesistÃªncia do franqueado',
          'CondomÃ­nio nÃ£o aprovou',
          'Prazo expirado',
          'Outro'
        )
      );
  END IF;
END $$;

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS fase_contabilidade text,
  ADD COLUMN IF NOT EXISTS fase_credito text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'processo_step_one_fase_contabilidade_check'
  ) THEN
    ALTER TABLE public.processo_step_one
      ADD CONSTRAINT processo_step_one_fase_contabilidade_check
      CHECK (
        fase_contabilidade IS NULL OR fase_contabilidade IN (
          'abertura_incorporadora',
          'abertura_spe',
          'abertura_gestora',
          'em_andamento',
          'encerrado'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'processo_step_one_fase_credito_check'
  ) THEN
    ALTER TABLE public.processo_step_one
      ADD CONSTRAINT processo_step_one_fase_credito_check
      CHECK (
        fase_credito IS NULL OR fase_credito IN (
          'check_legal_mais_credito',
          'contratacao_credito',
          'credito_aprovado',
          'encerrado'
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.processo_step_one.data_aprovacao_credito IS 'Dados prÃ©-obra: data de aprovaÃ§Ã£o do crÃ©dito';
COMMENT ON COLUMN public.processo_step_one.fase_contabilidade IS 'Subfase exibida no dashboard (Kanban Contabilidade)';
COMMENT ON COLUMN public.processo_step_one.fase_credito IS 'Subfase exibida no dashboard (Kanban CrÃ©dito)';

-- Backfill fase_contabilidade a partir de etapa_painel (somente onde ainda NULL)
UPDATE public.processo_step_one
SET fase_contabilidade = CASE etapa_painel
  WHEN 'contabilidade_incorporadora' THEN 'abertura_incorporadora'
  WHEN 'contabilidade_spe' THEN 'abertura_spe'
  WHEN 'contabilidade_gestora' THEN 'abertura_gestora'
  ELSE fase_contabilidade
END
WHERE etapa_painel IN ('contabilidade_incorporadora', 'contabilidade_spe', 'contabilidade_gestora')
  AND fase_contabilidade IS NULL;

-- Backfill fase_credito
UPDATE public.processo_step_one
SET fase_credito = CASE etapa_painel
  WHEN 'credito_terreno' THEN 'check_legal_mais_credito'
  WHEN 'credito_obra' THEN 'contratacao_credito'
  ELSE fase_credito
END
WHERE etapa_painel IN ('credito_terreno', 'credito_obra')
  AND fase_credito IS NULL;

CREATE INDEX IF NOT EXISTS idx_processo_step_one_fase_contabilidade
  ON public.processo_step_one (fase_contabilidade)
  WHERE fase_contabilidade IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_processo_step_one_fase_credito
  ON public.processo_step_one (fase_credito)
  WHERE fase_credito IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_processo_step_one_cancelado_status
  ON public.processo_step_one (status, cancelado_em);
-- Remove todas as "atividades" dos cards do painel:
-- - Itens de checklist (processo_card_checklist) e pareceres ligados (CASCADE)
-- - TÃ³picos/tarefas por etapa (processo_etapa_topicos) e anexos (CASCADE)
-- - HistÃ³rico de eventos do card (processo_card_eventos)
--
-- NÃƒO remove: comentÃ¡rios (processo_card_comentarios), documentos (processo_card_documentos),
-- checklist legal (processo_card_checklist_legal), dados do processo.

BEGIN;

DELETE FROM public.processo_etapa_topicos;
-- anexos em processo_etapa_topicos_anexos sÃ£o removidos em CASCADE

DELETE FROM public.processo_card_checklist;
-- processo_card_checklist_pareceres removidos em CASCADE

DELETE FROM public.processo_card_eventos;

COMMIT;
-- Novas fases do Kanban Novos NegÃ³cios apÃ³s "AprovaÃ§Ã£o na Prefeitura" (valores em etapa_painel).
comment on column public.processo_step_one.etapa_painel is
  'Etapa no Painel Novos NegÃ³cios: step_1, step_2, aprovacao_moni_novo_negocio, step_3, step_4, acoplamento, step_5, step_6, step_7, passagem_wayser, planialtimetrico, sondagem, projeto_legal, aprovacao_condominio, aprovacao_prefeitura, revisao_bca, processos_cartorarios, aguardando_credito, em_obra, moni_care, contabilidade_incorporadora, contabilidade_spe, contabilidade_gestora, credito_terreno, credito_obra';
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_name text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_type text not null check (member_type in ('time', 'adm')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_name, user_id, member_type)
);

create index if not exists idx_team_members_team_name
  on public.team_members (team_name);

create index if not exists idx_team_members_user_id
  on public.team_members (user_id);

comment on table public.team_members is
  'VÃ­nculo usuÃ¡rio x time com tipo de participaÃ§Ã£o (time/adm).';

comment on column public.team_members.team_name is
  'Nome lÃ³gico do time (ex.: Marketing, CrÃ©dito, MonÃ­ Capital).';

comment on column public.team_members.member_type is
  'Tipo no time: time ou adm.';

alter table public.team_members enable row level security;

drop policy if exists "team_members_auth_read" on public.team_members;
create policy "team_members_auth_read"
  on public.team_members
  for select
  to authenticated
  using (true);

drop policy if exists "team_members_admin_write" on public.team_members;
drop policy if exists "team_members_auth_write" on public.team_members;
create policy "team_members_auth_write"
  on public.team_members
  for all
  to authenticated
  using (true)
  with check (true);

-- Seed inicial por e-mail (sÃ³ insere quando o profile existe).
with src(team_name, email, member_type) as (
  values
    ('Marketing', 'negao@moni.casa', 'time'),
    ('Novos Franks', 'paula.cruz@moni.casa', 'time'),
    ('PortfÃ³lio', 'helenna.luz@moni.casa', 'time'),
    ('Acoplamento', 'elisabete.nucci@moni.casa', 'time'),
    ('Waysers', 'nathalia.ferezin@moni.casa', 'time'),
    ('Waysers', 'rafael.mata@moni.casa', 'time'),
    ('Frank MonÃ­', 'daniel.viotto@moni.casa', 'time'),
    ('CrÃ©dito', 'kim@moni.casa', 'time'),
    ('CrÃ©dito', 'neil@moni.casa', 'adm'),
    ('Produto', 'vinicius.fr@moni.casa', 'time'),
    ('Produto', 'fabio.siano@moni.casa', 'time'),
    ('HomologaÃ§Ãµes', 'karoline.galdino@moni.casa', 'time'),
    ('HomologaÃ§Ãµes', 'helena.oliveira@moni.casa', 'time'),
    ('HomologaÃ§Ãµes', 'jessica.silva@moni.casa', 'time'),
    ('HomologaÃ§Ãµes', 'leticia.duarte@moni.casa', 'time'),
    ('Modelo Virtual', 'bruna.scarpeli@moni.casa', 'time'),
    ('Modelo Virtual', 'larissa.lima@moni.casa', 'time'),
    ('Modelo Virtual', 'vitor.penha@moni.casa', 'time'),
    ('Executivo', 'bruna.scarpeli@moni.casa', 'time'),
    ('Executivo', 'larissa.lima@moni.casa', 'time'),
    ('Executivo', 'vitor.penha@moni.casa', 'time'),
    ('Caneta Verde', 'fernanda.lobao@moni.casa', 'adm'),
    ('Caneta Verde', 'ingrid.hora@moni.casa', 'adm'),
    ('Caneta Verde', 'danilo.n@moni.casa', 'adm'),
    ('CEO', 'murillo@moni.casa', 'adm'),
    ('CEO', 'neil@moni.casa', 'adm'),
    ('Financeiro', 'isa.seabra@moni.casa', 'time'),
    ('Financeiro', 'felipe.batista@moni.casa', 'time'),
    ('Financeiro', 'kim@moni.casa', 'time'),
    ('Contabilidade', 'isa.seabra@moni.casa', 'adm'),
    ('Contabilidade', 'felipe.batista@moni.casa', 'time'),
    ('Contabilidade', 'kim@moni.casa', 'time'),
    ('MonÃ­ Capital', 'neil@moni.casa', 'adm'),
    ('MonÃ­ Capital', 'neil@moni.casa', 'time'),
    ('MonÃ­ Capital', 'murillo@moni.casa', 'adm'),
    ('MonÃ­ Capital', 'kim@moni.casa', 'time'),
    ('MonÃ­ Capital', 'felipe.batista@moni.casa', 'time'),
    ('MonÃ­ Capital', 'diogo.chagas@moni.casa', 'time')
)
insert into public.team_members (team_name, user_id, member_type)
select src.team_name, p.id, src.member_type
from src
join public.profiles p on lower(p.email) = lower(src.email)
on conflict (team_name, user_id, member_type) do nothing;
-- Controle de acesso por role + metadados de convite/aprovaÃ§Ã£o em profiles.

alter table public.profiles
  add column if not exists nome_completo text,
  add column if not exists cargo text,
  add column if not exists departamento text,
  add column if not exists aprovado_em timestamptz,
  add column if not exists aprovado_por uuid references auth.users(id),
  add column if not exists convidado_por uuid references auth.users(id),
  add column if not exists invite_token text unique;

-- Expandimos o domÃ­nio de roles preservando legados para nÃ£o quebrar features existentes.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  alter column role set default 'pending';
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'team', 'pending', 'blocked', 'frank', 'consultor', 'supervisor'));

comment on column public.profiles.role is
  'Role de acesso: admin|team|pending|blocked (mantendo legados frank|consultor|supervisor).';

comment on column public.profiles.invite_token is
  'Token de convite para fluxo /aceitar-convite.';

-- Seed consolidado por e-mail (admin > team).
create or replace function public.seed_users()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles p
  set
    role = s.role,
    departamento = s.departamento,
    updated_at = now(),
    aprovado_em = coalesce(p.aprovado_em, case when s.role = 'admin' or s.role = 'team' then now() else null end)
  from (
    values
      ('negao@moni.casa', 'team', 'Marketing'),
      ('paula.cruz@moni.casa', 'team', 'Novos Franks'),
      ('helenna.luz@moni.casa', 'team', 'PortfÃ³lio'),
      ('elisabete.nucci@moni.casa', 'team', 'Acoplamento'),
      ('nathalia.ferezin@moni.casa', 'team', 'Waysers'),
      ('rafael.mata@moni.casa', 'team', 'Waysers'),
      ('daniel.viotto@moni.casa', 'team', 'Frank MonÃ­'),
      ('kim@moni.casa', 'team', 'CrÃ©dito'),
      ('neil@moni.casa', 'admin', 'CrÃ©dito'),
      ('vinicius.fr@moni.casa', 'team', 'Produto'),
      ('fabio.siano@moni.casa', 'team', 'Produto'),
      ('karoline.galdino@moni.casa', 'team', 'HomologaÃ§Ãµes'),
      ('helena.oliveira@moni.casa', 'team', 'HomologaÃ§Ãµes'),
      ('jessica.silva@moni.casa', 'team', 'HomologaÃ§Ãµes'),
      ('leticia.duarte@moni.casa', 'team', 'HomologaÃ§Ãµes'),
      ('bruna.scarpeli@moni.casa', 'team', 'Modelo Virtual / Executivo'),
      ('larissa.lima@moni.casa', 'team', 'Modelo Virtual / Executivo'),
      ('vitor.penha@moni.casa', 'team', 'Modelo Virtual / Executivo'),
      ('fernanda.lobao@moni.casa', 'admin', 'Caneta Verde'),
      ('ingrid.hora@moni.casa', 'admin', 'Caneta Verde'),
      ('danilo.n@moni.casa', 'admin', 'Caneta Verde'),
      ('murillo@moni.casa', 'admin', 'CEO'),
      ('isa.seabra@moni.casa', 'admin', 'Contabilidade'),
      ('felipe.batista@moni.casa', 'team', 'Financeiro'),
      ('diogo.chagas@moni.casa', 'team', 'MonÃ­ Capital')
  ) as s(email, role, departamento)
  where lower(p.email) = lower(s.email);
end;
$$;

-- Campos preenchidos pelo Frank ao abrir o ticket: nome (obrigatÃ³rio), condomÃ­nio e lote (opcionais)

ALTER TABLE public.juridico_tickets
  ADD COLUMN IF NOT EXISTS nome_frank TEXT,
  ADD COLUMN IF NOT EXISTS nome_condominio TEXT,
  ADD COLUMN IF NOT EXISTS lote TEXT;

COMMENT ON COLUMN public.juridico_tickets.nome_frank IS 'Nome do franqueado (obrigatÃ³rio no formulÃ¡rio)';
COMMENT ON COLUMN public.juridico_tickets.nome_condominio IS 'Nome do condomÃ­nio (opcional)';
COMMENT ON COLUMN public.juridico_tickets.lote IS 'Lote (opcional)';
-- Regista quando o convite foi realmente enviado via Resend (distingue de token gerado sem envio).

alter table public.profiles
  add column if not exists invite_email_sent_at timestamptz;

comment on column public.profiles.invite_email_sent_at is
  'Preenchido quando o e-mail de convite foi enviado com sucesso via Resend. Null se sÃ³ houve token (ex.: sem RESEND_API_KEY).';
-- Regista quando o utilizador concluiu o fluxo /aceitar-convite (senha + nome).

alter table public.profiles
  add column if not exists invite_accepted_at timestamptz;

comment on column public.profiles.invite_accepted_at is
  'Preenchido quando o utilizador aceita o convite e define senha em /aceitar-convite. Null se nunca concluiu por esse fluxo ou apÃ³s novo convite.';
-- Ordem manual dos cards dentro de cada coluna (etapa_painel) nos Kanbans.
ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS ordem_coluna_painel INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.processo_step_one.ordem_coluna_painel IS 'Ordem de exibiÃ§Ã£o do card na coluna etapa_painel (menor = mais acima).';

-- Backfill estÃ¡vel por fase: mais antigo primeiro (alinhado ao histÃ³rico).
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY etapa_painel
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) - 1 AS rn
  FROM public.processo_step_one
)
UPDATE public.processo_step_one p
SET ordem_coluna_painel = ranked.rn
FROM ranked
WHERE p.id = ranked.id;

CREATE INDEX IF NOT EXISTS idx_processo_step_one_etapa_ordem
  ON public.processo_step_one (etapa_painel, ordem_coluna_painel);
image.png
-- ============================================================
-- Migration 090: Schema completo do Carometro
-- Usa IF NOT EXISTS em tudo - seguro para bancos existentes
-- ============================================================

-- 1. Tabela periodos
CREATE TABLE IF NOT EXISTS periodos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('ano','semestre','bimestre','trimestre','mes','semana')),
  ano int NOT NULL,
  numero int NULL,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now(),
  CONSTRAINT periodos_data_valida CHECK (data_fim >= data_inicio)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_periodos_tipo_ano_numero ON periodos(tipo, ano, COALESCE(numero, 0));
CREATE INDEX IF NOT EXISTS idx_periodos_tipo_ano ON periodos(tipo, ano);
CREATE INDEX IF NOT EXISTS idx_periodos_datas ON periodos(data_inicio, data_fim);

-- 2. Tabela areas
CREATE TABLE IF NOT EXISTS areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now(),
  ordem int NOT NULL DEFAULT 0
);

-- 3. Tabela area_pessoas
CREATE TABLE IF NOT EXISTS area_pessoas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem int DEFAULT 0,
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now()
);

-- 4. Tabela tarefas
CREATE TABLE IF NOT EXISTS tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid REFERENCES areas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text null,
  tempo_estimado_minutos int null,
  ordem int DEFAULT 0,
  criado_em timestamptz DEFAULT now()
);

-- 5. Tabela acoes
CREATE TABLE IF NOT EXISTS acoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid REFERENCES tarefas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tempo_estimado_minutos int null,
  ordem int DEFAULT 0,
  criado_em timestamptz DEFAULT now(),
  caneta_verde text null,
  recorrencia text null,
  multiplicador_valor int null,
  multiplicador_tipo text null,
  tipo_atividade character varying null,
  esteira_par_id uuid null,
  objetivo_id uuid null
);

-- 6. Tabela casas
CREATE TABLE IF NOT EXISTS casas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  area_id uuid REFERENCES areas(id) ON DELETE SET NULL,
  criado_em timestamptz DEFAULT now()
);

-- 7. Tabela carometro
CREATE TABLE IF NOT EXISTS carometro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid REFERENCES areas(id) ON DELETE CASCADE,
  tarefa_id uuid REFERENCES tarefas(id) ON DELETE SET NULL,
  nome_comportamento text NOT NULL,
  emoji_chave text null,
  ordem int DEFAULT 0,
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now(),
  comportamento_chave boolean DEFAULT false,
  periodo_id uuid REFERENCES periodos(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_carometro_periodo ON carometro(periodo_id);

-- 8. Tabela carometro_semana
CREATE TABLE IF NOT EXISTS carometro_semana (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carometro_id uuid NOT NULL REFERENCES carometro(id) ON DELETE CASCADE,
  semana int NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','concluido')),
  criado_em timestamptz DEFAULT now(),
  semana_ano int null
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_carometro_semana_carometro_semana_ano ON carometro_semana(carometro_id, semana_ano);

-- 9. Tabela cronograma
CREATE TABLE IF NOT EXISTS cronograma (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid REFERENCES tarefas(id) ON DELETE CASCADE,
  acao_id uuid REFERENCES acoes(id) ON DELETE CASCADE,
  data_inicio_prevista date null,
  data_fim_prevista date null,
  data_inicio_real date null,
  data_fim_real date null,
  status text DEFAULT 'pendente',
  observacao text null,
  criado_em timestamptz DEFAULT now(),
  semana int null,
  horas_previstas numeric null,
  planejamento_id uuid null,
  semana_ano int null,
  periodo_id uuid REFERENCES periodos(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_cronograma_periodo_acao_semana_ano ON cronograma(periodo_id, acao_id, semana_ano);

-- 10. Tabela gantt_planejamento
CREATE TABLE IF NOT EXISTS gantt_planejamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acao_id uuid NOT NULL REFERENCES acoes(id) ON DELETE CASCADE,
  responsavel text null,
  recorrencia text null,
  repeticao int null,
  semana_inicio int null,
  semana_fim int null,
  criado_em timestamptz DEFAULT now(),
  semanas_selecionadas int[] DEFAULT '{}',
  comportamento_chave boolean DEFAULT false,
  franqueado_nome text null,
  casa_id uuid null,
  periodo_id uuid REFERENCES periodos(id) ON DELETE CASCADE,
  objetivo_id uuid null,
  semana_ano_inicio int null,
  semana_ano_fim int null
);
CREATE INDEX IF NOT EXISTS idx_gantt_planejamento_periodo ON gantt_planejamento(periodo_id);

-- 11. Tabela indicadores
CREATE TABLE IF NOT EXISTS indicadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid REFERENCES areas(id) ON DELETE CASCADE,
  tarefa_id uuid REFERENCES tarefas(id) ON DELETE SET NULL,
  nome text NOT NULL,
  unidade text null,
  meta_valor numeric null,
  meta_tipo text null,
  ordem int DEFAULT 0,
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now(),
  indicador_chave boolean DEFAULT false
);

-- 12. Tabela indicador_lancamentos
CREATE TABLE IF NOT EXISTS indicador_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicador_id uuid NOT NULL REFERENCES indicadores(id) ON DELETE CASCADE,
  periodo_id uuid REFERENCES periodos(id) ON DELETE CASCADE,
  semana int null,
  semana_ano int null,
  valor numeric NOT NULL,
  observacao text null,
  criado_em timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_indicador_lancamentos_ind_periodo_semana_ano ON indicador_lancamentos(indicador_id, periodo_id, semana_ano);
CREATE INDEX IF NOT EXISTS idx_indicador_lancamentos_periodo ON indicador_lancamentos(periodo_id);

-- 13. Tabela indicador_conquistas
CREATE TABLE IF NOT EXISTS indicador_conquistas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicador_id uuid NOT NULL REFERENCES indicadores(id) ON DELETE CASCADE,
  periodo_id uuid REFERENCES periodos(id) ON DELETE CASCADE,
  conquista text NOT NULL,
  criado_em timestamptz DEFAULT now()
);

-- 14. Tabela multiplicador_tipos
CREATE TABLE IF NOT EXISTS multiplicador_tipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text null,
  criado_em timestamptz DEFAULT now()
);

-- 15. Tabela objetivos
CREATE TABLE IF NOT EXISTS objetivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid REFERENCES areas(id) ON DELETE CASCADE,
  periodo_id uuid REFERENCES periodos(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  meta_valor numeric null,
  meta_unidade text null,
  ordem int DEFAULT 0,
  criado_em timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_objetivos_periodo ON objetivos(periodo_id);

-- 16. Tabela audit_log
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  usuario text NOT NULL DEFAULT 'Desconhecido',
  is_admin boolean DEFAULT false,
  modulo text NOT NULL,
  area text null,
  entidade text NOT NULL,
  entidade_id text null,
  operacao text NOT NULL,
  campo text null,
  valor_anterior jsonb null,
  valor_novo jsonb null,
  descricao text null
);

-- 17. Tabela comentarios_atividade
CREATE TABLE IF NOT EXISTS comentarios_atividade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acao_id uuid NOT NULL REFERENCES acoes(id) ON DELETE CASCADE,
  semana_iso int NOT NULL,
  semana_ano int NOT NULL,
  texto text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 18. Tabela comentarios_indicador
CREATE TABLE IF NOT EXISTS comentarios_indicador (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicador_id uuid NOT NULL REFERENCES indicadores(id) ON DELETE CASCADE,
  semana_iso int NOT NULL,
  semana_ano int NOT NULL,
  texto text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 19. Tabela recorrencias_metas
CREATE TABLE IF NOT EXISTS recorrencias_metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acao_id uuid REFERENCES acoes(id) ON DELETE CASCADE,
  periodo_id uuid REFERENCES periodos(id) ON DELETE CASCADE,
  criado_em timestamptz DEFAULT now()
);

-- 20. Tabela registros_resultados
CREATE TABLE IF NOT EXISTS registros_resultados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objetivo_id uuid REFERENCES objetivos(id) ON DELETE CASCADE,
  data_referencia date NOT NULL,
  valor numeric NOT NULL,
  observacao text null,
  criado_em timestamptz DEFAULT now()
);
-- Atividades (checklist do card): vÃ¡rios times e vÃ¡rios responsÃ¡veis por item.
-- Colunas legadas time_nome / responsavel_nome permanecem (primeiro valor) para compatibilidade.

ALTER TABLE public.processo_card_checklist
  ADD COLUMN IF NOT EXISTS times_nomes TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS responsaveis_nomes TEXT[] NOT NULL DEFAULT '{}';

UPDATE public.processo_card_checklist
SET times_nomes = CASE
    WHEN time_nome IS NOT NULL AND btrim(time_nome) <> '' THEN ARRAY[btrim(time_nome)]
    ELSE '{}'::text[]
  END
WHERE cardinality(times_nomes) = 0;

UPDATE public.processo_card_checklist
SET responsaveis_nomes = CASE
    WHEN responsavel_nome IS NOT NULL AND btrim(responsavel_nome) <> '' THEN ARRAY[btrim(responsavel_nome)]
    ELSE '{}'::text[]
  END
WHERE cardinality(responsaveis_nomes) = 0;

COMMENT ON COLUMN public.processo_card_checklist.times_nomes IS 'Times associados Ã  atividade (mÃºltiplos).';
COMMENT ON COLUMN public.processo_card_checklist.responsaveis_nomes IS 'ResponsÃ¡veis associados Ã  atividade (mÃºltiplos).';
-- Kanban genÃ©rico + Funil Step One
-- Cria kanbans, kanban_fases e kanban_cards com RLS por franqueado/role.

-- â”€â”€â”€ kanbans â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.kanbans (
  id      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  nome    TEXT    NOT NULL,
  ordem   INT     NOT NULL DEFAULT 0,
  cor_hex TEXT,
  ativo   BOOLEAN NOT NULL DEFAULT true
);

COMMENT ON TABLE public.kanbans IS 'Boards de kanban do Hub Fly (ex: Funil Step One).';

-- â”€â”€â”€ kanban_fases â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.kanban_fases (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  kanban_id  UUID    NOT NULL REFERENCES public.kanbans(id) ON DELETE CASCADE,
  nome       TEXT    NOT NULL,
  ordem      INT     NOT NULL DEFAULT 0,
  sla_dias   INT,
  ativo      BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_kanban_fases_kanban ON public.kanban_fases(kanban_id);

COMMENT ON TABLE public.kanban_fases IS 'Fases/colunas de cada kanban.';

-- â”€â”€â”€ Seed: Funil Step One â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DO $$
DECLARE
  v_kanban_id UUID;
BEGIN
  -- Garante idempotÃªncia: insere o kanban apenas se ainda nÃ£o existir
  INSERT INTO public.kanbans (nome, ordem, cor_hex, ativo)
  SELECT 'Funil Step One', 1, '#5B4CF5', true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanbans WHERE nome = 'Funil Step One'
  )
  RETURNING id INTO v_kanban_id;

  -- Se jÃ¡ existia, busca o id
  IF v_kanban_id IS NULL THEN
    SELECT id INTO v_kanban_id FROM public.kanbans WHERE nome = 'Funil Step One';
  END IF;

  -- Insere as 7 fases apenas se ainda nÃ£o existirem para este kanban
  INSERT INTO public.kanban_fases (kanban_id, nome, ordem, sla_dias, ativo)
  SELECT v_kanban_id, fase.nome, fase.ordem, fase.sla_dias, true
  FROM (
    VALUES
      ('Dados da Cidade',           1, 7),
      ('Lista de CondomÃ­nios',      2, 7),
      ('Dados dos CondomÃ­nios',     3, 10),
      ('Lotes disponÃ­veis',         4, 7),
      ('Mapa de Competidores',      5, 7),
      ('BCA + Batalha de Casas',    6, 14),
      ('HipÃ³teses',                 7, 7)
  ) AS fase(nome, ordem, sla_dias)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND nome = fase.nome
  );
END;
$$;

-- â”€â”€â”€ kanban_cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.kanban_cards (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kanban_id     UUID        NOT NULL REFERENCES public.kanbans(id) ON DELETE CASCADE,
  fase_id       UUID        NOT NULL REFERENCES public.kanban_fases(id) ON DELETE CASCADE,
  franqueado_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo        TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'ativo',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kanban_cards_kanban    ON public.kanban_cards(kanban_id);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_fase      ON public.kanban_cards(fase_id);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_franqueado ON public.kanban_cards(franqueado_id);

COMMENT ON TABLE public.kanban_cards IS 'Cards do kanban; franqueado_id aponta para o dono do card.';

-- â”€â”€â”€ RLS: kanban_cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.kanban_cards ENABLE ROW LEVEL SECURITY;

-- Leitura: dono do card OU admin/consultor
DROP POLICY IF EXISTS "kanban_cards_select" ON public.kanban_cards;
CREATE POLICY "kanban_cards_select"
  ON public.kanban_cards FOR SELECT
  USING (
    franqueado_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'consultor')
    )
  );

-- InserÃ§Ã£o: dono do card (franqueado_id deve ser o prÃ³prio usuÃ¡rio) OU admin/consultor
DROP POLICY IF EXISTS "kanban_cards_insert" ON public.kanban_cards;
CREATE POLICY "kanban_cards_insert"
  ON public.kanban_cards FOR INSERT
  WITH CHECK (
    franqueado_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'consultor')
    )
  );

-- AtualizaÃ§Ã£o e exclusÃ£o: mesmo critÃ©rio
DROP POLICY IF EXISTS "kanban_cards_update" ON public.kanban_cards;
CREATE POLICY "kanban_cards_update"
  ON public.kanban_cards FOR UPDATE
  USING (
    franqueado_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'consultor')
    )
  );

DROP POLICY IF EXISTS "kanban_cards_delete" ON public.kanban_cards;
CREATE POLICY "kanban_cards_delete"
  ON public.kanban_cards FOR DELETE
  USING (
    franqueado_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'consultor')
    )
  );

-- â”€â”€â”€ RLS: kanbans (leitura pÃºblica, escrita sÃ³ admin) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.kanbans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kanbans_select" ON public.kanbans;
CREATE POLICY "kanbans_select"
  ON public.kanbans FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "kanbans_admin" ON public.kanbans;
CREATE POLICY "kanbans_admin"
  ON public.kanbans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'consultor')
    )
  );

-- â”€â”€â”€ RLS: kanban_fases (leitura pÃºblica, escrita sÃ³ admin) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.kanban_fases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kanban_fases_select" ON public.kanban_fases;
CREATE POLICY "kanban_fases_select"
  ON public.kanban_fases FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "kanban_fases_admin" ON public.kanban_fases;
CREATE POLICY "kanban_fases_admin"
  ON public.kanban_fases FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'consultor')
    )
  );
-- â”€â”€â”€ 092: Seed do Funil Step One â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Idempotente via WHERE NOT EXISTS (nÃ£o requer ALTER TABLE / UNIQUE constraint).
-- Seguro para rodar quantas vezes quiser.

-- â”€â”€â”€ 1. Kanban â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO public.kanbans (nome, ordem, ativo)
SELECT 'Funil Step One', 1, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanbans WHERE nome = 'Funil Step One'
);

-- â”€â”€â”€ 2. Fases â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO public.kanban_fases (kanban_id, nome, ordem, sla_dias, ativo)
SELECT
  k.id,
  fase.nome,
  fase.ordem,
  fase.sla_dias,
  true
FROM public.kanbans k
CROSS JOIN (
  VALUES
    ('Dados da Cidade',        1,  7),
    ('Lista de CondomÃ­nios',   2,  7),
    ('Dados dos CondomÃ­nios',  3, 10),
    ('Lotes disponÃ­veis',      4,  7),
    ('Mapa de Competidores',   5,  7),
    ('BCA + Batalha de Casas', 6, 14),
    ('HipÃ³teses',              7,  7)
) AS fase(nome, ordem, sla_dias)
WHERE k.nome = 'Funil Step One'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fases kf
    WHERE kf.kanban_id = k.id
      AND kf.nome = fase.nome
  );

-- â”€â”€â”€ 3. VerificaÃ§Ã£o (retorna o que foi inserido) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
SELECT
  k.id         AS kanban_id,
  k.nome       AS kanban_nome,
  k.ativo      AS kanban_ativo,
  kf.nome      AS fase_nome,
  kf.ordem     AS fase_ordem,
  kf.sla_dias  AS sla_dias
FROM public.kanbans k
JOIN public.kanban_fases kf ON kf.kanban_id = k.id
WHERE k.nome = 'Funil Step One'
ORDER BY kf.ordem;
-- â”€â”€â”€ 093: Remove duplicatas do kanban "Funil Step One" â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- DiagnÃ³stico: mostra quantas linhas existem antes de limpar.

-- 1. Ver o que existe
SELECT id, nome, ordem, ativo, ctid
FROM public.kanbans
WHERE nome = 'Funil Step One'
ORDER BY ctid;

-- 2. Manter apenas o registro mais antigo (menor ctid) e deletar os extras
DELETE FROM public.kanbans
WHERE nome = 'Funil Step One'
  AND ctid NOT IN (
    SELECT min(ctid)
    FROM public.kanbans
    WHERE nome = 'Funil Step One'
  );

-- 3. Confirma: deve restar exatamente 1 linha
SELECT id, nome, ativo FROM public.kanbans WHERE nome = 'Funil Step One';

-- 4. Confirma as 7 fases vinculadas
SELECT kf.nome, kf.ordem, kf.sla_dias
FROM public.kanban_fases kf
JOIN public.kanbans k ON k.id = kf.kanban_id
WHERE k.nome = 'Funil Step One'
ORDER BY kf.ordem;
-- â”€â”€â”€ 094: Corrige RLS e GRANT das tabelas kanbans e kanban_fases â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Problema: pÃ¡gina /funil-stepone retorna "Kanban nÃ£o encontrado" mesmo com
-- dados presentes no banco. Causa provÃ¡vel: RLS bloqueando SELECT ou falta
-- de GRANT para os roles anon/authenticated.
--
-- DiagnÃ³stico: execute os SELECTs abaixo para ver o estado atual antes de rodar.

-- â”€â”€â”€ DiagnÃ³stico: polÃ­ticas existentes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN ('kanbans', 'kanban_fases')
-- ORDER BY tablename, policyname;

-- â”€â”€â”€ DiagnÃ³stico: grants existentes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- SELECT grantee, table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_name IN ('kanbans', 'kanban_fases')
--   AND table_schema = 'public'
-- ORDER BY table_name, grantee;

-- â”€â”€â”€ 1. kanbans: garantir RLS ativo e polÃ­tica de leitura â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.kanbans ENABLE ROW LEVEL SECURITY;

-- Remove polÃ­ticas antigas (qualquer nome) para evitar conflito
DROP POLICY IF EXISTS "kanbans_select"     ON public.kanbans;
DROP POLICY IF EXISTS "kanbans_select_all" ON public.kanbans;
DROP POLICY IF EXISTS "kanbans_admin"      ON public.kanbans;

-- Leitura: qualquer usuÃ¡rio autenticado (ou anÃ´nimo) pode ver kanbans
CREATE POLICY "kanbans_select_all"
  ON public.kanbans FOR SELECT
  USING (true);

-- Escrita: apenas admin/consultor
CREATE POLICY "kanbans_admin"
  ON public.kanbans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'consultor')
    )
  );

-- Grant explÃ­cito para os roles do Supabase
GRANT SELECT ON public.kanbans TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.kanbans TO authenticated;

-- â”€â”€â”€ 2. kanban_fases: garantir RLS ativo e polÃ­tica de leitura â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.kanban_fases ENABLE ROW LEVEL SECURITY;

-- Remove polÃ­ticas antigas
DROP POLICY IF EXISTS "kanban_fases_select"     ON public.kanban_fases;
DROP POLICY IF EXISTS "kanban_fases_select_all" ON public.kanban_fases;
DROP POLICY IF EXISTS "kanban_fases_admin"      ON public.kanban_fases;

-- Leitura: qualquer usuÃ¡rio pode ver as fases
CREATE POLICY "kanban_fases_select_all"
  ON public.kanban_fases FOR SELECT
  USING (true);

-- Escrita: apenas admin/consultor
CREATE POLICY "kanban_fases_admin"
  ON public.kanban_fases FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'consultor')
    )
  );

-- Grant explÃ­cito
GRANT SELECT ON public.kanban_fases TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.kanban_fases TO authenticated;

-- â”€â”€â”€ 3. ConfirmaÃ§Ã£o final â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Deve mostrar as 2 polÃ­ticas "_select_all" recÃ©m criadas:
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('kanbans', 'kanban_fases')
ORDER BY tablename, policyname;

-- Deve retornar 1 kanban:
SELECT id, nome, ativo FROM public.kanbans WHERE nome = 'Funil Step One';

-- Deve retornar 7 fases:
SELECT kf.nome, kf.ordem, kf.sla_dias
FROM public.kanban_fases kf
JOIN public.kanbans k ON k.id = kf.kanban_id
WHERE k.nome = 'Funil Step One'
ORDER BY kf.ordem;
-- â”€â”€â”€ 095: Atividades aprimoradas â€” Sprint C â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- "Atividades" neste projeto = tabela public.processo_card_checklist
-- Adiciona colunas de contexto kanban sem perder dados existentes.
-- Idempotente: ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- â”€â”€â”€ 1. Novas colunas em processo_card_checklist â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Estado atual da tabela (migrations 045 â†’ 090):
--   id, processo_id, etapa_painel, titulo, concluido, ordem,
--   created_at, updated_at, prazo, responsavel_nome, status,
--   time_nome, times_nomes, responsaveis_nomes

ALTER TABLE public.processo_card_checklist
  ADD COLUMN IF NOT EXISTS kanban_id     UUID REFERENCES public.kanbans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fase_id       UUID REFERENCES public.kanban_fases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS card_id       UUID REFERENCES public.kanban_cards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS franqueado_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS condominio    TEXT,
  ADD COLUMN IF NOT EXISTS lote          TEXT,
  ADD COLUMN IF NOT EXISTS quadra        TEXT;

CREATE INDEX IF NOT EXISTS idx_pcc_kanban     ON public.processo_card_checklist(kanban_id);
CREATE INDEX IF NOT EXISTS idx_pcc_fase        ON public.processo_card_checklist(fase_id);
CREATE INDEX IF NOT EXISTS idx_pcc_card        ON public.processo_card_checklist(card_id);
CREATE INDEX IF NOT EXISTS idx_pcc_franqueado  ON public.processo_card_checklist(franqueado_id);

-- â”€â”€â”€ 2. atividade_times â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Tabela de junction: times vinculados a uma atividade (processo_card_checklist).
CREATE TABLE IF NOT EXISTS public.atividade_times (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atividade_id UUID NOT NULL REFERENCES public.processo_card_checklist(id) ON DELETE CASCADE,
  time_nome    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_atividade_times_atividade ON public.atividade_times(atividade_id);

COMMENT ON TABLE public.atividade_times IS
  'Times vinculados a uma atividade (processo_card_checklist). '
  'Complementa a coluna legada times_nomes[] da tabela principal.';

-- â”€â”€â”€ 3. atividade_responsaveis â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Tabela de junction: responsÃ¡veis por atividade com referÃªncia a auth.users.
CREATE TABLE IF NOT EXISTS public.atividade_responsaveis (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atividade_id UUID NOT NULL REFERENCES public.processo_card_checklist(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE (atividade_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_atividade_resp_atividade ON public.atividade_responsaveis(atividade_id);
CREATE INDEX IF NOT EXISTS idx_atividade_resp_user      ON public.atividade_responsaveis(user_id);

COMMENT ON TABLE public.atividade_responsaveis IS
  'ResponsÃ¡veis por atividade com FK para auth.users. '
  'Complementa a coluna legada responsaveis_nomes[] da tabela principal.';

-- â”€â”€â”€ 4. duvidas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Espelha a estrutura de processo_card_checklist com tipo = 'duvida'.
CREATE TABLE IF NOT EXISTS public.duvidas (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id    UUID        REFERENCES public.processo_step_one(id) ON DELETE CASCADE,
  kanban_id      UUID        REFERENCES public.kanbans(id) ON DELETE SET NULL,
  fase_id        UUID        REFERENCES public.kanban_fases(id) ON DELETE SET NULL,
  card_id        UUID        REFERENCES public.kanban_cards(id) ON DELETE SET NULL,
  franqueado_id  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  etapa_painel   TEXT,
  titulo         TEXT        NOT NULL,
  descricao      TEXT,
  condominio     TEXT,
  lote           TEXT,
  quadra         TEXT,
  status         TEXT        NOT NULL DEFAULT 'aberta'
                             CHECK (status IN ('aberta', 'respondida', 'fechada')),
  tipo           TEXT        NOT NULL DEFAULT 'duvida',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_duvidas_processo   ON public.duvidas(processo_id);
CREATE INDEX IF NOT EXISTS idx_duvidas_kanban      ON public.duvidas(kanban_id);
CREATE INDEX IF NOT EXISTS idx_duvidas_fase         ON public.duvidas(fase_id);
CREATE INDEX IF NOT EXISTS idx_duvidas_card         ON public.duvidas(card_id);
CREATE INDEX IF NOT EXISTS idx_duvidas_franqueado   ON public.duvidas(franqueado_id);

COMMENT ON TABLE public.duvidas IS
  'DÃºvidas de franqueados. Espelha estrutura de processo_card_checklist '
  'com tipo = duvida e campos de status prÃ³prios.';

-- â”€â”€â”€ RLS: atividade_times â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.atividade_times ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "atividade_times_select" ON public.atividade_times;
CREATE POLICY "atividade_times_select"
  ON public.atividade_times FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "atividade_times_write" ON public.atividade_times;
CREATE POLICY "atividade_times_write"
  ON public.atividade_times FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

-- â”€â”€â”€ RLS: atividade_responsaveis â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.atividade_responsaveis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "atividade_responsaveis_select" ON public.atividade_responsaveis;
CREATE POLICY "atividade_responsaveis_select"
  ON public.atividade_responsaveis FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "atividade_responsaveis_write" ON public.atividade_responsaveis;
CREATE POLICY "atividade_responsaveis_write"
  ON public.atividade_responsaveis FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

-- â”€â”€â”€ RLS: duvidas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.duvidas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "duvidas_select" ON public.duvidas;
CREATE POLICY "duvidas_select"
  ON public.duvidas FOR SELECT
  USING (
    franqueado_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

DROP POLICY IF EXISTS "duvidas_insert" ON public.duvidas;
CREATE POLICY "duvidas_insert"
  ON public.duvidas FOR INSERT
  WITH CHECK (
    franqueado_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

DROP POLICY IF EXISTS "duvidas_update" ON public.duvidas;
CREATE POLICY "duvidas_update"
  ON public.duvidas FOR UPDATE
  USING (
    franqueado_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

-- â”€â”€â”€ GRANTs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atividade_times        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atividade_responsaveis TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.duvidas                 TO authenticated;
-- â”€â”€â”€ 096: SLA e arquivamento de cards â€” Sprint D â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Idempotente: CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE FUNCTION.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- â”€â”€â”€ 1. fase_sla â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.fase_sla (
  id        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  fase_id   UUID    NOT NULL REFERENCES public.kanban_fases(id) ON DELETE CASCADE,
  kanban_id UUID    NOT NULL REFERENCES public.kanbans(id) ON DELETE CASCADE,
  sla_dias  INT     NOT NULL CHECK (sla_dias > 0),
  UNIQUE (fase_id, kanban_id)
);

CREATE INDEX IF NOT EXISTS idx_fase_sla_fase   ON public.fase_sla(fase_id);
CREATE INDEX IF NOT EXISTS idx_fase_sla_kanban ON public.fase_sla(kanban_id);

COMMENT ON TABLE public.fase_sla IS 'SLA configurÃ¡vel por fase/kanban (sobrescreve sla_dias da fase).';

-- â”€â”€â”€ 2. card_arquivamento â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.card_arquivamento (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id    UUID        NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  fase_id    UUID        REFERENCES public.kanban_fases(id) ON DELETE SET NULL,
  motivo     TEXT,
  data_acao  TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_card_arquivamento_card ON public.card_arquivamento(card_id);
CREATE INDEX IF NOT EXISTS idx_card_arquivamento_user ON public.card_arquivamento(user_id);

COMMENT ON TABLE public.card_arquivamento IS 'HistÃ³rico de arquivamentos de cards.';

-- â”€â”€â”€ 3. card_vinculos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.card_vinculos (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  card_origem_id    UUID    NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  card_destino_id   UUID    NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  kanban_origem     TEXT,
  kanban_destino    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (card_origem_id, card_destino_id)
);

CREATE INDEX IF NOT EXISTS idx_card_vinculos_origem  ON public.card_vinculos(card_origem_id);
CREATE INDEX IF NOT EXISTS idx_card_vinculos_destino ON public.card_vinculos(card_destino_id);

COMMENT ON TABLE public.card_vinculos IS 'VÃ­nculos entre cards de kanbans distintos ou do mesmo.';

-- â”€â”€â”€ 4. FunÃ§Ã£o: status SLA do card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Retorna: 'ok' | 'atencao' | 'atrasado'
-- LÃ³gica:
--   dias_restantes > 1  â†’ ok
--   dias_restantes = 1  â†’ atencao  (D-1)
--   dias_restantes = 0  â†’ atencao  (vence hoje)
--   dias_restantes < 0  â†’ atrasado

CREATE OR REPLACE FUNCTION public.fn_card_sla_status(
  p_card_id    UUID,
  p_fase_id    UUID,
  p_kanban_id  UUID,
  p_created_at TIMESTAMPTZ
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_sla_dias      INT;
  v_dias_corridos INT;
  v_dias_restantes INT;
BEGIN
  -- Prioridade 1: fase_sla (configuraÃ§Ã£o especÃ­fica)
  SELECT sla_dias INTO v_sla_dias
  FROM public.fase_sla
  WHERE fase_id = p_fase_id AND kanban_id = p_kanban_id
  LIMIT 1;

  -- Prioridade 2: sla_dias da prÃ³pria kanban_fases
  IF v_sla_dias IS NULL THEN
    SELECT sla_dias INTO v_sla_dias
    FROM public.kanban_fases
    WHERE id = p_fase_id
    LIMIT 1;
  END IF;

  -- Sem SLA configurado â†’ sempre ok
  IF v_sla_dias IS NULL OR v_sla_dias <= 0 THEN
    RETURN 'ok';
  END IF;

  v_dias_corridos  := EXTRACT(DAY FROM (now() - p_created_at))::INT;
  v_dias_restantes := v_sla_dias - v_dias_corridos;

  IF v_dias_restantes < 0 THEN
    RETURN 'atrasado';
  ELSIF v_dias_restantes <= 1 THEN
    RETURN 'atencao';
  ELSE
    RETURN 'ok';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.fn_card_sla_status IS
  'Retorna ok | atencao | atrasado para um card. '
  'atencao = D-1 ou vence hoje; atrasado = SLA vencido.';

-- â”€â”€â”€ RLS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.fase_sla          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_arquivamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_vinculos     ENABLE ROW LEVEL SECURITY;

-- fase_sla: leitura pÃºblica, escrita sÃ³ admin/consultor
DROP POLICY IF EXISTS "fase_sla_select" ON public.fase_sla;
CREATE POLICY "fase_sla_select" ON public.fase_sla FOR SELECT USING (true);

DROP POLICY IF EXISTS "fase_sla_admin" ON public.fase_sla;
CREATE POLICY "fase_sla_admin"
  ON public.fase_sla FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'consultor')));

-- card_arquivamento: leitura para dono ou admin/consultor
DROP POLICY IF EXISTS "card_arquivamento_select" ON public.card_arquivamento;
CREATE POLICY "card_arquivamento_select"
  ON public.card_arquivamento FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'consultor'))
  );

DROP POLICY IF EXISTS "card_arquivamento_insert" ON public.card_arquivamento;
CREATE POLICY "card_arquivamento_insert"
  ON public.card_arquivamento FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- card_vinculos: leitura pÃºblica, escrita autenticada
DROP POLICY IF EXISTS "card_vinculos_select" ON public.card_vinculos;
CREATE POLICY "card_vinculos_select" ON public.card_vinculos FOR SELECT USING (true);

DROP POLICY IF EXISTS "card_vinculos_write" ON public.card_vinculos;
CREATE POLICY "card_vinculos_write"
  ON public.card_vinculos FOR ALL
  USING (auth.uid() IS NOT NULL);

-- GRANTs
GRANT SELECT ON public.fase_sla          TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fase_sla          TO authenticated;
GRANT SELECT, INSERT ON public.card_arquivamento TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.card_vinculos TO authenticated;
-- â”€â”€â”€ 097: Materiais e instruÃ§Ãµes por fase â€” Sprint E â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Idempotente: CREATE TABLE IF NOT EXISTS.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- â”€â”€â”€ fase_materiais â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.fase_materiais (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  fase_id    UUID        NOT NULL REFERENCES public.kanban_fases(id) ON DELETE CASCADE,
  kanban_id  UUID        NOT NULL REFERENCES public.kanbans(id) ON DELETE CASCADE,
  tipo       TEXT        NOT NULL CHECK (tipo IN ('instrucao', 'material')),
  titulo     TEXT        NOT NULL,
  conteudo   TEXT,
  url        TEXT,
  criado_por UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fase_materiais_fase   ON public.fase_materiais(fase_id);
CREATE INDEX IF NOT EXISTS idx_fase_materiais_kanban ON public.fase_materiais(kanban_id);

COMMENT ON TABLE public.fase_materiais IS
  'Materiais e instruÃ§Ãµes vinculados a fases de kanban. '
  'tipo = instrucao (texto orientativo) ou material (link/arquivo).';

-- â”€â”€â”€ RLS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.fase_materiais ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuÃ¡rio autenticado
DROP POLICY IF EXISTS "fase_materiais_select" ON public.fase_materiais;
CREATE POLICY "fase_materiais_select"
  ON public.fase_materiais FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Escrita: apenas admin e consultor
DROP POLICY IF EXISTS "fase_materiais_insert" ON public.fase_materiais;
CREATE POLICY "fase_materiais_insert"
  ON public.fase_materiais FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

DROP POLICY IF EXISTS "fase_materiais_update" ON public.fase_materiais;
CREATE POLICY "fase_materiais_update"
  ON public.fase_materiais FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

DROP POLICY IF EXISTS "fase_materiais_delete" ON public.fase_materiais;
CREATE POLICY "fase_materiais_delete"
  ON public.fase_materiais FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

-- GRANTs
GRANT SELECT ON public.fase_materiais TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.fase_materiais TO authenticated;
-- â”€â”€â”€ 098: Portal do Franqueado â€” Sprint F â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Idempotente: DO $$ com verificaÃ§Ãµes, CREATE TABLE IF NOT EXISTS.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co
-- GRANTs das tabelas criadas em 095/096/097 ficam em cada migration respectiva.
-- Este script cuida apenas de: role, convites_franqueado e RLS de kanban_cards.

-- â”€â”€â”€ 1. Role franqueado em profiles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Se a coluna role tiver CHECK constraint sem 'franqueado', recria incluindo-o.
DO $$
DECLARE
  v_constraint_name TEXT;
  v_check_clause    TEXT;
BEGIN
  SELECT cc.constraint_name, cc.check_clause
  INTO v_constraint_name, v_check_clause
  FROM information_schema.check_constraints cc
  JOIN information_schema.constraint_column_usage ccu
    ON cc.constraint_name = ccu.constraint_name
   AND cc.constraint_schema = ccu.constraint_schema
  WHERE ccu.table_schema = 'public'
    AND ccu.table_name   = 'profiles'
    AND ccu.column_name  = 'role'
  LIMIT 1;

  -- SÃ³ age se encontrou constraint E ela nÃ£o inclui 'franqueado'
  IF v_constraint_name IS NOT NULL AND v_check_clause NOT LIKE '%franqueado%' THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('admin', 'consultor', 'frank', 'franqueado'));
  END IF;
END;
$$;

-- â”€â”€â”€ 2. convites_franqueado â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.convites_franqueado (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT        NOT NULL,
  franqueado_id  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  token          TEXT        NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
  usado          BOOLEAN     NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_convites_email      ON public.convites_franqueado(email);
CREATE INDEX IF NOT EXISTS idx_convites_token      ON public.convites_franqueado(token);
CREATE INDEX IF NOT EXISTS idx_convites_franqueado ON public.convites_franqueado(franqueado_id);

COMMENT ON TABLE public.convites_franqueado IS
  'Convites de acesso ao portal do franqueado. '
  'token Ã© Ãºnico e de uso Ãºnico (usado = true apÃ³s aceite).';

-- â”€â”€â”€ 3. RLS em convites_franqueado â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.convites_franqueado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "convites_select" ON public.convites_franqueado;
CREATE POLICY "convites_select"
  ON public.convites_franqueado FOR SELECT
  USING (
    franqueado_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

DROP POLICY IF EXISTS "convites_insert" ON public.convites_franqueado;
CREATE POLICY "convites_insert"
  ON public.convites_franqueado FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

DROP POLICY IF EXISTS "convites_update" ON public.convites_franqueado;
CREATE POLICY "convites_update"
  ON public.convites_franqueado FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

-- â”€â”€â”€ 5. GRANTs â€” somente tabelas criadas nesta migration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
GRANT SELECT ON public.convites_franqueado TO authenticated;
GRANT INSERT, UPDATE ON public.convites_franqueado TO authenticated;
-- â”€â”€â”€ 099: Reabilitar RLS com polÃ­ticas permissivas (debug â†’ produÃ§Ã£o) â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Executado manualmente no DEV apÃ³s desabilitar RLS para diagnÃ³stico.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co
--
-- DiferenÃ§a em relaÃ§Ã£o a 091/094:
--   kanban_cards_select â†’ USING (true)  [antes: franqueado_id = auth.uid() OR admin]
--   kanban_cards_insert â†’ auth.uid() IS NOT NULL  [antes: franqueado_id check]
--   kanban_cards_update â†’ auth.uid() IS NOT NULL  [antes: role check]

-- â”€â”€â”€ 1. Reabilitar RLS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.kanban_cards  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanbans       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_fases  ENABLE ROW LEVEL SECURITY;

-- â”€â”€â”€ 2. kanbans: leitura pÃºblica â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DROP POLICY IF EXISTS "kanbans_select_all" ON public.kanbans;
CREATE POLICY "kanbans_select_all" ON public.kanbans
  FOR SELECT USING (true);

-- â”€â”€â”€ 3. kanban_fases: leitura pÃºblica â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DROP POLICY IF EXISTS "kanban_fases_select_all" ON public.kanban_fases;
CREATE POLICY "kanban_fases_select_all" ON public.kanban_fases
  FOR SELECT USING (true);

-- â”€â”€â”€ 4. kanban_cards: qualquer autenticado lÃª/escreve â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DROP POLICY IF EXISTS "kanban_cards_select" ON public.kanban_cards;
CREATE POLICY "kanban_cards_select" ON public.kanban_cards
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "kanban_cards_insert" ON public.kanban_cards;
CREATE POLICY "kanban_cards_insert" ON public.kanban_cards
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "kanban_cards_update" ON public.kanban_cards;
CREATE POLICY "kanban_cards_update" ON public.kanban_cards
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- â”€â”€â”€ 5. GRANTs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
GRANT SELECT, INSERT, UPDATE ON public.kanbans                  TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.kanban_fases             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_cards     TO authenticated;
GRANT SELECT ON public.processo_card_checklist                  TO authenticated;
-- Fix: Adicionar foreign key constraint que estÃ¡ faltando
-- e corrigir o relacionamento entre kanban_cards e profiles

-- Remove constraint antiga se existir (com nome diferente)
DO $$
BEGIN
  -- Remove qualquer constraint de FK existente para franqueado_id
  ALTER TABLE public.kanban_cards 
  DROP CONSTRAINT IF EXISTS kanban_cards_franqueado_id_fkey;
  
  ALTER TABLE public.kanban_cards 
  DROP CONSTRAINT IF EXISTS fk_kanban_cards_franqueado;
EXCEPTION
  WHEN undefined_object THEN
    NULL; -- Ignora se nÃ£o existir
END $$;

-- Adiciona a foreign key corretamente
ALTER TABLE public.kanban_cards
ADD CONSTRAINT kanban_cards_franqueado_id_fkey
FOREIGN KEY (franqueado_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- Cria Ã­ndice para melhor performance
CREATE INDEX IF NOT EXISTS idx_kanban_cards_franqueado_id 
ON public.kanban_cards(franqueado_id);

-- Verifica se a constraint foi criada
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'kanban_cards'
  AND kcu.column_name = 'franqueado_id';
-- Fix RLS policies para kanban_cards
-- Garantir que admins possam ver todos os cards

-- Desabilita RLS temporariamente para debug
-- ALTER TABLE public.kanban_cards DISABLE ROW LEVEL SECURITY;

-- Ou mantÃ©m RLS mas corrige as policies

-- Remove policies antigas
DROP POLICY IF EXISTS "kanban_cards_select" ON public.kanban_cards;
DROP POLICY IF EXISTS "kanban_cards_insert" ON public.kanban_cards;
DROP POLICY IF EXISTS "kanban_cards_update" ON public.kanban_cards;
DROP POLICY IF EXISTS "kanban_cards_delete" ON public.kanban_cards;

-- Policy de SELECT: admin vÃª tudo, franqueado vÃª sÃ³ os seus
CREATE POLICY "kanban_cards_select"
ON public.kanban_cards
FOR SELECT
USING (
  -- Admin ou consultor vÃª tudo
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'consultor')
  )
  OR
  -- Franqueado vÃª apenas os prÃ³prios cards
  franqueado_id = auth.uid()
);

-- Policy de INSERT: qualquer usuÃ¡rio autenticado pode criar
CREATE POLICY "kanban_cards_insert"
ON public.kanban_cards
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    -- Admin/consultor pode criar para qualquer um
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'consultor')
    )
    OR
    -- Franqueado sÃ³ pode criar cards para si mesmo
    franqueado_id = auth.uid()
  )
);

-- Policy de UPDATE: mesmo critÃ©rio do SELECT
CREATE POLICY "kanban_cards_update"
ON public.kanban_cards
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'consultor')
  )
  OR
  franqueado_id = auth.uid()
);

-- Policy de DELETE: mesmo critÃ©rio
CREATE POLICY "kanban_cards_delete"
ON public.kanban_cards
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'consultor')
  )
  OR
  franqueado_id = auth.uid()
);

-- Verificar as policies criadas
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'kanban_cards';
-- ========================================
-- Feriados Nacionais e FunÃ§Ã£o de Dias Ãšteis
-- ========================================

-- â”€â”€â”€ Tabela de feriados nacionais â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.feriados_nacionais (
  id         SERIAL PRIMARY KEY,
  data       DATE NOT NULL UNIQUE,
  nome       TEXT NOT NULL,
  fixo       BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT uk_feriados_data UNIQUE (data)
);

COMMENT ON TABLE public.feriados_nacionais IS 'Feriados nacionais brasileiros para cÃ¡lculo de dias Ãºteis no SLA.';

-- Seed: feriados nacionais fixos e mÃ³veis de 2025-2027
INSERT INTO public.feriados_nacionais (data, nome, fixo) VALUES
  -- 2025
  ('2025-01-01', 'Ano Novo', true),
  ('2025-04-18', 'PaixÃ£o de Cristo', false),
  ('2025-04-21', 'Tiradentes', true),
  ('2025-05-01', 'Dia do Trabalho', true),
  ('2025-06-19', 'Corpus Christi', false),
  ('2025-09-07', 'IndependÃªncia', true),
  ('2025-10-12', 'Nossa Senhora Aparecida', true),
  ('2025-11-02', 'Finados', true),
  ('2025-11-15', 'ProclamaÃ§Ã£o da RepÃºblica', true),
  ('2025-12-25', 'Natal', true),
  
  -- 2026
  ('2026-01-01', 'Ano Novo', true),
  ('2026-02-16', 'Carnaval', false),
  ('2026-02-17', 'Carnaval', false),
  ('2026-04-03', 'PaixÃ£o de Cristo', false),
  ('2026-04-21', 'Tiradentes', true),
  ('2026-05-01', 'Dia do Trabalho', true),
  ('2026-06-04', 'Corpus Christi', false),
  ('2026-09-07', 'IndependÃªncia', true),
  ('2026-10-12', 'Nossa Senhora Aparecida', true),
  ('2026-11-02', 'Finados', true),
  ('2026-11-15', 'ProclamaÃ§Ã£o da RepÃºblica', true),
  ('2026-12-25', 'Natal', true),
  
  -- 2027
  ('2027-01-01', 'Ano Novo', true),
  ('2027-02-08', 'Carnaval', false),
  ('2027-02-09', 'Carnaval', false),
  ('2027-03-26', 'PaixÃ£o de Cristo', false),
  ('2027-04-21', 'Tiradentes', true),
  ('2027-05-01', 'Dia do Trabalho', true),
  ('2027-05-27', 'Corpus Christi', false),
  ('2027-09-07', 'IndependÃªncia', true),
  ('2027-10-12', 'Nossa Senhora Aparecida', true),
  ('2027-11-02', 'Finados', true),
  ('2027-11-15', 'ProclamaÃ§Ã£o da RepÃºblica', true),
  ('2027-12-25', 'Natal', true)
ON CONFLICT (data) DO NOTHING;

-- â”€â”€â”€ FunÃ§Ã£o: Calcular Dias Ãšteis â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  -- Se data fim Ã© anterior, retorna 0
  IF data_fim < data_inicio THEN
    RETURN 0;
  END IF;

  WHILE data_atual <= data_fim LOOP
    -- 0=domingo, 6=sÃ¡bado no PostgreSQL (extract dow)
    dia_semana := EXTRACT(DOW FROM data_atual);
    
    -- Verifica se Ã© feriado
    SELECT EXISTS(
      SELECT 1 FROM public.feriados_nacionais
      WHERE data = data_atual
    ) INTO eh_feriado;
    
    -- Conta apenas se nÃ£o for fim de semana e nÃ£o for feriado
    IF dia_semana NOT IN (0, 6) AND NOT eh_feriado THEN
      dias_uteis := dias_uteis + 1;
    END IF;
    
    data_atual := data_atual + 1;
  END LOOP;

  RETURN dias_uteis;
END;
$$;

COMMENT ON FUNCTION public.calcular_dias_uteis IS 'Calcula dias Ãºteis entre duas datas, excluindo sÃ¡bados, domingos e feriados nacionais.';

-- â”€â”€â”€ FunÃ§Ã£o: Adicionar Dias Ãšteis a uma Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  -- Se dias a adicionar Ã© 0 ou negativo, retorna a data base
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

COMMENT ON FUNCTION public.adicionar_dias_uteis IS 'Adiciona N dias Ãºteis a uma data base, pulando fins de semana e feriados.';

-- â”€â”€â”€ Testes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Teste 1: calcular dias Ãºteis entre duas datas
SELECT 
  '2026-04-13'::DATE as inicio,
  '2026-04-22'::DATE as fim,
  public.calcular_dias_uteis('2026-04-13'::DATE, '2026-04-22'::DATE) as dias_uteis;

-- Teste 2: adicionar 5 dias Ãºteis a uma data
SELECT 
  '2026-04-15'::DATE as data_base,
  public.adicionar_dias_uteis('2026-04-15'::DATE, 5) as prazo_5_dias_uteis;
-- ========================================
-- Tabela de Atividades Vinculadas aos Cards do Kanban
-- ========================================

-- â”€â”€â”€ Tabela de Atividades â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.kanban_atividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluida', 'cancelada')),
  prioridade TEXT DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
  responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  data_vencimento DATE,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  concluida_em TIMESTAMPTZ,
  ordem INT DEFAULT 0
);

COMMENT ON TABLE public.kanban_atividades IS 'Atividades vinculadas aos cards do Kanban';
COMMENT ON COLUMN public.kanban_atividades.status IS 'Status: pendente, em_andamento, concluida, cancelada';
COMMENT ON COLUMN public.kanban_atividades.prioridade IS 'Prioridade: baixa, normal, alta, urgente';
COMMENT ON COLUMN public.kanban_atividades.ordem IS 'Ordem de exibiÃ§Ã£o dentro do card';

-- Ãndices para performance
CREATE INDEX idx_kanban_atividades_card_id ON public.kanban_atividades(card_id);
CREATE INDEX idx_kanban_atividades_responsavel_id ON public.kanban_atividades(responsavel_id);
CREATE INDEX idx_kanban_atividades_status ON public.kanban_atividades(status);
CREATE INDEX idx_kanban_atividades_created_at ON public.kanban_atividades(created_at DESC);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_kanban_atividades_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.status = 'concluida' AND OLD.status != 'concluida' THEN
    NEW.concluida_em = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_kanban_atividades_updated_at
BEFORE UPDATE ON public.kanban_atividades
FOR EACH ROW
EXECUTE FUNCTION update_kanban_atividades_updated_at();

-- â”€â”€â”€ RLS Policies â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

ALTER TABLE public.kanban_atividades ENABLE ROW LEVEL SECURITY;

-- Policy: SELECT - Admin/consultor vÃª tudo, franqueado vÃª apenas seus cards
CREATE POLICY kanban_atividades_select ON public.kanban_atividades
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'consultor')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.kanban_cards
    WHERE kanban_cards.id = kanban_atividades.card_id
      AND kanban_cards.franqueado_id = auth.uid()
  )
);

-- Policy: INSERT - Admin/consultor insere em qualquer card, franqueado apenas em seus
CREATE POLICY kanban_atividades_insert ON public.kanban_atividades
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'consultor')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.kanban_cards
    WHERE kanban_cards.id = kanban_atividades.card_id
      AND kanban_cards.franqueado_id = auth.uid()
  )
);

-- Policy: UPDATE - Mesma lÃ³gica do SELECT
CREATE POLICY kanban_atividades_update ON public.kanban_atividades
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'consultor')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.kanban_cards
    WHERE kanban_cards.id = kanban_atividades.card_id
      AND kanban_cards.franqueado_id = auth.uid()
  )
);

-- Policy: DELETE - Mesma lÃ³gica do SELECT
CREATE POLICY kanban_atividades_delete ON public.kanban_atividades
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'consultor')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.kanban_cards
    WHERE kanban_cards.id = kanban_atividades.card_id
      AND kanban_cards.franqueado_id = auth.uid()
  )
);

-- ========================================
-- ðŸŽ‰ MIGRAÃ‡ÃƒO CONCLUÃDA!
-- Tabela kanban_atividades criada com sucesso
-- RLS configurado
-- Pronta para receber atividades
-- ========================================
-- ========================================
-- Adiciona campo "time" (equipe) Ã s atividades
-- ========================================

-- Adiciona coluna time (equipe/time responsÃ¡vel)
ALTER TABLE public.kanban_atividades
ADD COLUMN IF NOT EXISTS time TEXT;

COMMENT ON COLUMN public.kanban_atividades.time IS 'Equipe/time responsÃ¡vel pela atividade (comercial, operacoes, juridico, financeiro)';

-- Ãndice para filtrar por time
CREATE INDEX IF NOT EXISTS idx_kanban_atividades_time ON public.kanban_atividades(time);

-- ========================================
-- Atualiza atividades exemplo com times
-- ========================================

UPDATE public.kanban_atividades
SET time = CASE 
  WHEN titulo LIKE '%dados cadastrais%' THEN 'operacoes'
  WHEN titulo LIKE '%Validar informaÃ§Ãµes%' THEN 'juridico'
  WHEN titulo LIKE '%reuniÃ£o%' THEN 'comercial'
  WHEN titulo LIKE '%certidÃµes%' THEN 'juridico'
  WHEN titulo LIKE '%relatÃ³rio%' THEN 'operacoes'
  ELSE 'operacoes'
END
WHERE time IS NULL;

-- ========================================
-- ðŸŽ‰ MIGRAÃ‡ÃƒO CONCLUÃDA!
-- Campo "time" adicionado Ã  tabela kanban_atividades
-- Atividades exemplo atualizadas com times
-- ========================================
-- â”€â”€â”€ 105: View v_atividades_unificadas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Unifica atividades de todos os kanbans em uma Ãºnica view consultÃ¡vel.
-- SLA calculado a partir de data_vencimento da prÃ³pria atividade.
-- security_invoker = true â†’ view herda RLS das tabelas subjacentes.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- â”€â”€â”€ 1. Drop + Create â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DROP VIEW IF EXISTS public.v_atividades_unificadas;

CREATE VIEW public.v_atividades_unificadas
WITH (security_invoker = true)
AS
SELECT
  -- Identificadores
  a.id,
  a.card_id,

  -- Contexto do card
  c.titulo                                              AS card_titulo,
  f.nome                                                AS fase_nome,
  k.nome                                                AS kanban_nome,

  -- ResponsÃ¡vel
  a.responsavel_id,
  COALESCE(p.full_name, p.email)                        AS responsavel_nome,

  -- Tipo de atividade
  -- kanban_atividades representa tarefas; campo expandÃ­vel no futuro
  'tarefa'::TEXT                                        AS tipo,

  -- ConteÃºdo
  a.descricao,

  -- Timestamp
  a.created_at                                          AS criado_em,

  -- SLA calculado a partir de data_vencimento
  CASE
    WHEN a.data_vencimento IS NULL   THEN NULL
    WHEN a.data_vencimento < CURRENT_DATE THEN 'atrasado'
    WHEN a.data_vencimento = CURRENT_DATE THEN 'vence_hoje'
    ELSE 'ok'
  END::TEXT                                             AS sla_status

FROM public.kanban_atividades  a
JOIN public.kanban_cards        c ON c.id = a.card_id
JOIN public.kanban_fases        f ON f.id = c.fase_id
JOIN public.kanbans             k ON k.id = c.kanban_id
LEFT JOIN public.profiles       p ON p.id = a.responsavel_id;

COMMENT ON VIEW public.v_atividades_unificadas IS
  'VisÃ£o unificada de todas as atividades dos kanbans. '
  'Inclui contexto de card, fase e kanban. '
  'sla_status calculado a partir de data_vencimento da atividade: '
  'atrasado | vence_hoje | ok | null (sem prazo).';

-- â”€â”€â”€ 2. GRANT â€” autenticados podem consultar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- A view usa security_invoker = true, portanto as polÃ­ticas RLS das tabelas
-- subjacentes (kanban_atividades, kanban_cards) continuam valendo.
GRANT SELECT ON public.v_atividades_unificadas TO authenticated;
-- â”€â”€â”€ 106: Trigger â€” criar card no Funil Step One ao inserir franqueado â”€â”€â”€â”€â”€â”€â”€â”€
-- Dispara AFTER INSERT em rede_franqueados.
-- Busca o kanban "Funil Step One" e a fase "Dados da Cidade" dinamicamente.
-- TÃ­tulo do card: n_franquia - cidade_casa_frank - area_atuacao (partes nulas omitidas).
-- franqueado_id = auth.uid() (quem inseriu); se NULL (backend/service role) pula criaÃ§Ã£o.
-- Tratamento de erro via EXCEPTION: falhas nunca bloqueiam o INSERT do franqueado.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- â”€â”€â”€ 1. FunÃ§Ã£o do trigger â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE FUNCTION public.fn_criar_card_funil_ao_inserir_franqueado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kanban_id  UUID;
  v_fase_id    UUID;
  v_titulo     TEXT;
  v_user_id    UUID;
BEGIN
  -- â”€â”€ UsuÃ¡rio que disparou o INSERT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  -- auth.uid() retorna NULL quando chamado via service role (backend).
  -- Neste caso nÃ£o temos um dono vÃ¡lido para o card; pulamos silenciosamente.
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- â”€â”€ Localiza o kanban "Funil Step One" â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  SELECT id INTO v_kanban_id
  FROM public.kanbans
  WHERE nome = 'Funil Step One'
    AND ativo = true
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RETURN NEW; -- kanban inexistente: nÃ£o bloqueia
  END IF;

  -- â”€â”€ Localiza a fase "Dados da Cidade" (fase 1) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  SELECT id INTO v_fase_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND nome = 'Dados da Cidade'
    AND ativo = true
  LIMIT 1;

  -- Fallback: se a fase nÃ£o existir pelo nome, pega a primeira fase ativa
  IF v_fase_id IS NULL THEN
    SELECT id INTO v_fase_id
    FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id
      AND ativo = true
    ORDER BY ordem ASC
    LIMIT 1;
  END IF;

  IF v_fase_id IS NULL THEN
    RETURN NEW; -- nenhuma fase disponÃ­vel: nÃ£o bloqueia
  END IF;

  -- â”€â”€ Monta o tÃ­tulo: FK0001 - Cidade - Ãrea â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  -- CONCAT_WS ignora NULLs automaticamente; convertemos strings vazias em NULL
  -- para que partes ausentes nÃ£o gerem " -  - " no tÃ­tulo.
  v_titulo := CONCAT_WS(
    ' - ',
    NULLIF(TRIM(COALESCE(NEW.n_franquia,        '')), ''),
    NULLIF(TRIM(COALESCE(NEW.cidade_casa_frank,  '')), ''),
    NULLIF(TRIM(COALESCE(NEW.area_atuacao,       '')), '')
  );

  -- Se todos os trÃªs campos estavam vazios, usa fallback legÃ­vel
  IF v_titulo IS NULL OR v_titulo = '' THEN
    v_titulo := 'Novo Franqueado';
  END IF;

  -- â”€â”€ Insere o card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  INSERT INTO public.kanban_cards (kanban_id, fase_id, franqueado_id, titulo, status)
  VALUES (v_kanban_id, v_fase_id, v_user_id, v_titulo, 'ativo');

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- Qualquer erro inesperado (FK violada, lock timeout, etc.) nÃ£o deve
    -- impedir o INSERT principal na rede_franqueados.
    RAISE WARNING 'fn_criar_card_funil_ao_inserir_franqueado: erro ignorado â€” %', SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_criar_card_funil_ao_inserir_franqueado() IS
  'Cria automaticamente um card no kanban "Funil Step One" / fase "Dados da Cidade" '
  'sempre que um novo franqueado Ã© inserido em rede_franqueados. '
  'TÃ­tulo: n_franquia - cidade_casa_frank - area_atuacao. '
  'Sem auth.uid() (backend/service role) ou sem kanban/fase cadastrado, pula silenciosamente.';

-- â”€â”€â”€ 2. Trigger â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DROP TRIGGER IF EXISTS trg_rede_franqueados_criar_card_funil ON public.rede_franqueados;

CREATE TRIGGER trg_rede_franqueados_criar_card_funil
  AFTER INSERT ON public.rede_franqueados
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_criar_card_funil_ao_inserir_franqueado();

COMMENT ON TRIGGER trg_rede_franqueados_criar_card_funil ON public.rede_franqueados IS
  'ApÃ³s INSERT em rede_franqueados: cria card no Funil Step One (fase Dados da Cidade).';
-- â”€â”€â”€ 107: InteraÃ§Ãµes â€” tipo + multi-times em kanban_atividades â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 1. Cria tabela kanban_times (UUID + nome) semeada com times existentes.
-- 2. Adiciona coluna tipo Ã  kanban_atividades (atividade | duvida).
-- 3. Adiciona coluna times_ids UUID[] Ã  kanban_atividades (multi-times).
--    A coluna time TEXT legada Ã© mantida para compatibilidade retroativa.
-- 4. Recria v_atividades_unificadas com tipo, times_ids e times_nomes.
-- Idempotente: CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- â”€â”€â”€ 1. Tabela kanban_times â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.kanban_times (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome  TEXT NOT NULL,
  UNIQUE (nome)
);

COMMENT ON TABLE public.kanban_times IS
  'Times/equipes disponÃ­veis para atribuiÃ§Ã£o em kanban_atividades. '
  'Semeado a partir dos team_name distintos em team_members.';

-- Seed: popula com todos os times jÃ¡ cadastrados em team_members
INSERT INTO public.kanban_times (nome)
SELECT DISTINCT team_name
FROM   public.team_members
ORDER  BY team_name
ON CONFLICT (nome) DO NOTHING;

-- RLS
ALTER TABLE public.kanban_times ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kanban_times_select" ON public.kanban_times;
CREATE POLICY "kanban_times_select"
  ON public.kanban_times FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "kanban_times_admin" ON public.kanban_times;
CREATE POLICY "kanban_times_admin"
  ON public.kanban_times FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'consultor')
    )
  );

GRANT SELECT ON public.kanban_times TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.kanban_times TO authenticated;

-- â”€â”€â”€ 2. Novas colunas em kanban_atividades â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- 2a. tipo: classifica a interaÃ§Ã£o como atividade (tarefa) ou dÃºvida
ALTER TABLE public.kanban_atividades
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'atividade'
    CHECK (tipo IN ('atividade', 'duvida'));

COMMENT ON COLUMN public.kanban_atividades.tipo IS
  'Tipo da interaÃ§Ã£o: atividade (tarefa) | duvida.';

-- 2b. times_ids: array de UUIDs referenciando kanban_times
--     Complementa a coluna legada "time TEXT" â€” ambas coexistem.
ALTER TABLE public.kanban_atividades
  ADD COLUMN IF NOT EXISTS times_ids UUID[] DEFAULT '{}';

COMMENT ON COLUMN public.kanban_atividades.times_ids IS
  'Times responsÃ¡veis pela atividade (array de kanban_times.id). '
  'Substitui progressivamente a coluna legada "time TEXT".';

-- Ãndice GIN para buscas eficientes dentro do array
CREATE INDEX IF NOT EXISTS idx_kanban_atividades_times_ids
  ON public.kanban_atividades USING GIN (times_ids);

CREATE INDEX IF NOT EXISTS idx_kanban_atividades_tipo
  ON public.kanban_atividades (tipo);

-- â”€â”€â”€ 3. View v_atividades_unificadas (recriaÃ§Ã£o completa) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DROP VIEW IF EXISTS public.v_atividades_unificadas;

CREATE VIEW public.v_atividades_unificadas
WITH (security_invoker = true)
AS
SELECT
  -- Identificadores
  a.id,
  a.card_id,

  -- Contexto do card
  c.titulo                                              AS card_titulo,
  f.nome                                                AS fase_nome,
  k.nome                                                AS kanban_nome,

  -- ResponsÃ¡vel
  a.responsavel_id,
  COALESCE(p.full_name, p.email)                        AS responsavel_nome,

  -- Tipo da interaÃ§Ã£o (atividade | duvida)
  a.tipo,

  -- ConteÃºdo
  a.descricao,

  -- Times (IDs + nomes resolvidos)
  a.times_ids,
  ARRAY(
    SELECT t.nome
    FROM   public.kanban_times t
    WHERE  t.id = ANY(a.times_ids)
    ORDER  BY t.nome
  )                                                     AS times_nomes,

  -- Timestamp
  a.created_at                                          AS criado_em,

  -- SLA calculado a partir de data_vencimento da prÃ³pria atividade
  CASE
    WHEN a.data_vencimento IS NULL        THEN NULL
    WHEN a.data_vencimento < CURRENT_DATE THEN 'atrasado'
    WHEN a.data_vencimento = CURRENT_DATE THEN 'vence_hoje'
    ELSE 'ok'
  END::TEXT                                             AS sla_status

FROM public.kanban_atividades  a
JOIN public.kanban_cards        c ON c.id = a.card_id
JOIN public.kanban_fases        f ON f.id = c.fase_id
JOIN public.kanbans             k ON k.id = c.kanban_id
LEFT JOIN public.profiles       p ON p.id = a.responsavel_id;

COMMENT ON VIEW public.v_atividades_unificadas IS
  'VisÃ£o unificada de todas as atividades dos kanbans. '
  'Inclui contexto de card/fase/kanban, tipo (atividade|duvida), '
  'times_ids (array de UUIDs) e times_nomes (array de nomes resolvidos). '
  'sla_status: atrasado | vence_hoje | ok | null (sem prazo). '
  'security_invoker=true: RLS das tabelas subjacentes Ã© aplicado ao chamador.';

-- GRANT â€” autenticados podem consultar (RLS das tabelas base filtra o resultado)
GRANT SELECT ON public.v_atividades_unificadas TO authenticated;
-- â”€â”€â”€ 108: kanban_historico + triggers automÃ¡ticos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Tabela de auditoria de cards: registra mudanÃ§as de fase e interaÃ§Ãµes.
-- Triggers SECURITY DEFINER garantem escrita mesmo com RLS ativo.
-- RLS SELECT: usuÃ¡rio sÃ³ vÃª histÃ³rico de cards aos quais tem acesso.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- â”€â”€â”€ 1. Tabela kanban_historico â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.kanban_historico (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id      UUID        NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  usuario_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  usuario_nome TEXT,           -- desnormalizado: evita JOIN em consultas de auditoria
  acao         TEXT        NOT NULL
                           CHECK (acao IN (
                             'card_criado',
                             'fase_avancada',
                             'fase_retrocedida',
                             'interacao_criada',
                             'interacao_editada',
                             'campo_alterado'
                           )),
  detalhe      JSONB,          -- dados extras contextuais (fases, campos, valores)
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kanban_historico_card_id
  ON public.kanban_historico (card_id);

CREATE INDEX IF NOT EXISTS idx_kanban_historico_criado_em
  ON public.kanban_historico (criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_kanban_historico_acao
  ON public.kanban_historico (acao);

CREATE INDEX IF NOT EXISTS idx_kanban_historico_detalhe
  ON public.kanban_historico USING GIN (detalhe);

COMMENT ON TABLE public.kanban_historico IS
  'Log de auditoria de cards do kanban: mudanÃ§as de fase e interaÃ§Ãµes. '
  'Populado exclusivamente via triggers â€” nunca inserir manualmente.';

-- â”€â”€â”€ 2. RLS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.kanban_historico ENABLE ROW LEVEL SECURITY;

-- SELECT: usuÃ¡rio vÃª histÃ³rico dos cards que jÃ¡ tem acesso
-- (replica a lÃ³gica de kanban_cards_select sem criar dependÃªncia circular)
DROP POLICY IF EXISTS "kanban_historico_select" ON public.kanban_historico;
CREATE POLICY "kanban_historico_select"
  ON public.kanban_historico FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.kanban_cards kc
      WHERE kc.id = kanban_historico.card_id
        AND (
          kc.franqueado_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND role IN ('admin', 'consultor')
          )
        )
    )
  );

GRANT SELECT ON public.kanban_historico TO authenticated;

-- â”€â”€â”€ 3. Helper: resolve nome do usuÃ¡rio â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Usada pelas funÃ§Ãµes de trigger para desnormalizar usuario_nome.
CREATE OR REPLACE FUNCTION public.fn_resolve_usuario_nome(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(full_name, email)
  FROM   public.profiles
  WHERE  id = p_user_id
  LIMIT  1;
$$;

-- â”€â”€â”€ 4a. Trigger: mudanÃ§a de fase em kanban_cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Dispara AFTER UPDATE quando fase_id muda.
-- Compara kanban_fases.ordem para decidir se Ã© avanÃ§o ou retrocesso.

CREATE OR REPLACE FUNCTION public.fn_historico_fase_alterada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ordem_antiga  INT;
  v_ordem_nova    INT;
  v_nome_antiga   TEXT;
  v_nome_nova     TEXT;
  v_acao          TEXT;
  v_user_id       UUID;
BEGIN
  -- Sem mudanÃ§a efetiva de fase: nada a registrar
  IF OLD.fase_id IS NOT DISTINCT FROM NEW.fase_id THEN
    RETURN NEW;
  END IF;

  -- Busca metadados das fases
  SELECT ordem, nome INTO v_ordem_antiga, v_nome_antiga
  FROM public.kanban_fases WHERE id = OLD.fase_id;

  SELECT ordem, nome INTO v_ordem_nova, v_nome_nova
  FROM public.kanban_fases WHERE id = NEW.fase_id;

  -- Determina direÃ§Ã£o do movimento
  v_acao := CASE
    WHEN COALESCE(v_ordem_nova, 0) >= COALESCE(v_ordem_antiga, 0) THEN 'fase_avancada'
    ELSE 'fase_retrocedida'
  END;

  v_user_id := auth.uid();

  INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, detalhe)
  VALUES (
    NEW.id,
    v_user_id,
    public.fn_resolve_usuario_nome(v_user_id),
    v_acao,
    jsonb_build_object(
      'fase_anterior_id',   OLD.fase_id,
      'fase_anterior_nome', COALESCE(v_nome_antiga, ''),
      'fase_nova_id',       NEW.fase_id,
      'fase_nova_nome',     COALESCE(v_nome_nova, '')
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'fn_historico_fase_alterada: erro ignorado â€” %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kanban_cards_historico_fase ON public.kanban_cards;
CREATE TRIGGER trg_kanban_cards_historico_fase
  AFTER UPDATE OF fase_id ON public.kanban_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_historico_fase_alterada();

COMMENT ON FUNCTION public.fn_historico_fase_alterada() IS
  'Registra fase_avancada ou fase_retrocedida ao mover card entre fases. '
  'DireÃ§Ã£o determinada comparando kanban_fases.ordem das fases anterior e nova.';

-- â”€â”€â”€ 4b. Trigger: nova interaÃ§Ã£o em kanban_atividades â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE FUNCTION public.fn_historico_interacao_criada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(auth.uid(), NEW.criado_por);

  INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, detalhe)
  VALUES (
    NEW.card_id,
    v_user_id,
    public.fn_resolve_usuario_nome(v_user_id),
    'interacao_criada',
    jsonb_build_object(
      'atividade_id', NEW.id,
      'titulo',       COALESCE(NEW.titulo, ''),
      'tipo',         COALESCE(NEW.tipo, 'atividade'),
      'status',       COALESCE(NEW.status, 'pendente')
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'fn_historico_interacao_criada: erro ignorado â€” %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kanban_atividades_historico_insert ON public.kanban_atividades;
CREATE TRIGGER trg_kanban_atividades_historico_insert
  AFTER INSERT ON public.kanban_atividades
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_historico_interacao_criada();

COMMENT ON FUNCTION public.fn_historico_interacao_criada() IS
  'Registra interacao_criada ao inserir uma nova atividade num card.';

-- â”€â”€â”€ 4c. Trigger: ediÃ§Ã£o de interaÃ§Ã£o em kanban_atividades â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE FUNCTION public.fn_historico_interacao_editada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_detalhe JSONB := '{}'::JSONB;
BEGIN
  v_user_id := auth.uid();

  -- Registra campos que efetivamente mudaram
  IF OLD.titulo   IS DISTINCT FROM NEW.titulo THEN
    v_detalhe := v_detalhe || jsonb_build_object(
      'titulo_anterior', OLD.titulo,
      'titulo_novo',     NEW.titulo
    );
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_detalhe := v_detalhe || jsonb_build_object(
      'status_anterior', OLD.status,
      'status_novo',     NEW.status
    );
  END IF;

  IF OLD.descricao IS DISTINCT FROM NEW.descricao THEN
    v_detalhe := v_detalhe || jsonb_build_object(
      'descricao_alterada', true
    );
  END IF;

  IF OLD.responsavel_id IS DISTINCT FROM NEW.responsavel_id THEN
    v_detalhe := v_detalhe || jsonb_build_object(
      'responsavel_anterior', OLD.responsavel_id,
      'responsavel_novo',     NEW.responsavel_id
    );
  END IF;

  IF OLD.data_vencimento IS DISTINCT FROM NEW.data_vencimento THEN
    v_detalhe := v_detalhe || jsonb_build_object(
      'data_vencimento_anterior', OLD.data_vencimento,
      'data_vencimento_nova',     NEW.data_vencimento
    );
  END IF;

  -- Sempre inclui identificador da atividade
  v_detalhe := v_detalhe || jsonb_build_object('atividade_id', NEW.id);

  INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, detalhe)
  VALUES (
    NEW.card_id,
    v_user_id,
    public.fn_resolve_usuario_nome(v_user_id),
    'interacao_editada',
    v_detalhe
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'fn_historico_interacao_editada: erro ignorado â€” %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kanban_atividades_historico_update ON public.kanban_atividades;
CREATE TRIGGER trg_kanban_atividades_historico_update
  AFTER UPDATE ON public.kanban_atividades
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_historico_interacao_editada();

COMMENT ON FUNCTION public.fn_historico_interacao_editada() IS
  'Registra interacao_editada ao atualizar uma atividade. '
  'detalhe inclui apenas os campos que efetivamente mudaram.';
-- â”€â”€â”€ 109: ComentÃ¡rios por card do kanban (funil) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Agrega comentÃ¡rios do card; fase_id opcional (contexto ao publicar).

CREATE TABLE IF NOT EXISTS public.kanban_card_comentarios (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id    UUID        NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  fase_id    UUID        REFERENCES public.kanban_fases(id) ON DELETE SET NULL,
  autor_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  texto      TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kanban_card_comentarios_card
  ON public.kanban_card_comentarios (card_id);

CREATE INDEX IF NOT EXISTS idx_kanban_card_comentarios_created
  ON public.kanban_card_comentarios (created_at DESC);

COMMENT ON TABLE public.kanban_card_comentarios IS
  'ComentÃ¡rios do card no kanban; listagem agrega todas as fases.';

ALTER TABLE public.kanban_card_comentarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kanban_card_comentarios_select" ON public.kanban_card_comentarios;
CREATE POLICY "kanban_card_comentarios_select"
  ON public.kanban_card_comentarios FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kanban_cards c WHERE c.id = kanban_card_comentarios.card_id));

DROP POLICY IF EXISTS "kanban_card_comentarios_insert" ON public.kanban_card_comentarios;
CREATE POLICY "kanban_card_comentarios_insert"
  ON public.kanban_card_comentarios FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.kanban_cards c WHERE c.id = kanban_card_comentarios.card_id)
  );

GRANT SELECT, INSERT ON public.kanban_card_comentarios TO authenticated;
-- â”€â”€â”€ 110: v_atividades_unificadas â€” merge 106 + 107 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Garante colunas usadas pelo app (titulo, status, prazo, kanban_id, franqueado,
-- time legado) junto com tipo, times_ids e times_nomes da 107.

DROP VIEW IF EXISTS public.v_atividades_unificadas;

CREATE VIEW public.v_atividades_unificadas
WITH (security_invoker = true)
AS
SELECT
  a.id,
  a.card_id,

  c.titulo                                              AS card_titulo,
  f.nome                                                AS fase_nome,
  k.nome                                                AS kanban_nome,
  k.id                                                  AS kanban_id,

  a.responsavel_id,
  COALESCE(p.full_name, p.email)                        AS responsavel_nome,

  a.tipo,

  COALESCE(NULLIF(trim(a.titulo), ''), NULLIF(trim(a.descricao), ''), '(sem tÃ­tulo)') AS titulo,
  a.descricao,

  a.status                                              AS atividade_status,
  a.data_vencimento,
  a.time                                                AS time_nome,
  a.times_ids,
  ARRAY(
    SELECT t.nome
    FROM   public.kanban_times t
    WHERE  t.id = ANY(a.times_ids)
    ORDER  BY t.nome
  )                                                     AS times_nomes,

  COALESCE(fp.full_name, fp.email)                      AS franqueado_nome,

  a.created_at                                          AS criado_em,

  CASE
    WHEN a.data_vencimento IS NULL        THEN NULL
    WHEN a.data_vencimento < CURRENT_DATE THEN 'atrasado'
    WHEN a.data_vencimento = CURRENT_DATE THEN 'vence_hoje'
    ELSE 'ok'
  END::TEXT                                             AS sla_status

FROM public.kanban_atividades  a
JOIN public.kanban_cards        c ON c.id = a.card_id
JOIN public.kanban_fases        f ON f.id = c.fase_id
JOIN public.kanbans             k ON k.id = c.kanban_id
LEFT JOIN public.profiles       p ON p.id = a.responsavel_id
LEFT JOIN public.profiles       fp ON fp.id = c.franqueado_id;

COMMENT ON VIEW public.v_atividades_unificadas IS
  'VisÃ£o unificada de interaÃ§Ãµes (kanban_atividades): card, fase, kanban, '
  'responsÃ¡vel, tipo (atividade|duvida), conteÃºdo, SLA por data_vencimento, '
  'times multi (times_nomes) e time legado, franqueado do card.';

GRANT SELECT ON public.v_atividades_unificadas TO authenticated;
-- â”€â”€â”€ 111: Registrar todos os kanbans do sistema â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 1. Adiciona coluna descricao Ã  tabela kanbans (sem quebrar dados existentes).
-- 2. Remove duplicatas de nome antes de criar a constraint UNIQUE.
-- 3. Adiciona UNIQUE (nome) idempotentemente.
-- 4. Insere os 5 kanbans canÃ´nicos via ON CONFLICT (nome) DO NOTHING.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- â”€â”€â”€ 1. Coluna descricao â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.kanbans
  ADD COLUMN IF NOT EXISTS descricao TEXT;

COMMENT ON COLUMN public.kanbans.descricao IS
  'DescriÃ§Ã£o resumida do propÃ³sito do kanban.';

-- â”€â”€â”€ 2. Remover duplicatas por nome â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- MantÃ©m apenas a linha mais antiga (menor ctid) de cada nome.
-- Seguro mesmo se nÃ£o houver duplicatas.
DELETE FROM public.kanbans
WHERE ctid NOT IN (
  SELECT min(ctid)
  FROM   public.kanbans
  GROUP  BY nome
);

-- â”€â”€â”€ 3. UNIQUE (nome) idempotente â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname      = 'kanbans_nome_unique'
      AND  conrelid     = 'public.kanbans'::REGCLASS
  ) THEN
    ALTER TABLE public.kanbans
      ADD CONSTRAINT kanbans_nome_unique UNIQUE (nome);
  END IF;
END;
$$;

-- â”€â”€â”€ 4. Seed: 5 kanbans canÃ´nicos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO public.kanbans (nome, descricao, ordem, ativo) VALUES
  ('Funil Step One', 'Funil de viabilidade de novas franquias',  1, true),
  ('Portfolio',      'GestÃ£o de portfolio de franquias',          2, true),
  ('OperaÃ§Ãµes',      'GestÃ£o operacional de franquias',           3, true),
  ('Contabilidade',  'GestÃ£o contÃ¡bil de franquias',              4, true),
  ('CrÃ©dito',        'GestÃ£o de crÃ©dito de franquias',            5, true)
ON CONFLICT (nome) DO UPDATE
  SET descricao = EXCLUDED.descricao,
      ativo     = true
  WHERE public.kanbans.descricao IS NULL;

COMMENT ON TABLE public.kanbans IS
  'Boards de kanban do Hub Fly. '
  'Kanbans canÃ´nicos: Funil Step One, Portfolio, OperaÃ§Ãµes, Contabilidade, CrÃ©dito.';
-- Migration 112: Views de compatibilidade legado
-- Objetivo: fazer o frontend novo (KanbanBoard/KanbanCardModal) ler dados reais
-- de processo_step_one sem mover nem apagar nada.
-- ATENÃ‡ÃƒO: Requer migration 111 jÃ¡ aplicada antes de rodar esta.

-- ============================================================
-- PARTE 0: Adicionar coluna slug em kanban_fases
-- ============================================================
-- Nullable para nÃ£o quebrar as 7 fases existentes do Funil Step One.
-- O Ã­ndice Ãºnico parcial (WHERE slug IS NOT NULL) garante idempotÃªncia
-- nos INSERTs abaixo sem afetar fases sem slug.

ALTER TABLE public.kanban_fases
  ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_kanban_fases_kanban_slug
  ON public.kanban_fases (kanban_id, slug)
  WHERE slug IS NOT NULL;

-- ============================================================
-- PARTE 1: Registrar fases reais nos kanbans legados em kanban_fases
-- ============================================================

-- Contabilidade (3 fases)
INSERT INTO kanban_fases (kanban_id, nome, slug, ordem)
SELECT k.id, fase.nome, fase.slug, fase.ordem
FROM kanbans k
CROSS JOIN (VALUES
  ('Incorporadora', 'contabilidade_incorporadora', 1),
  ('SPE', 'contabilidade_spe', 2),
  ('Gestora', 'contabilidade_gestora', 3)
) AS fase(nome, slug, ordem)
WHERE k.nome = 'Contabilidade'
ON CONFLICT (kanban_id, slug) WHERE slug IS NOT NULL DO NOTHING;

-- CrÃ©dito (2 fases)
INSERT INTO kanban_fases (kanban_id, nome, slug, ordem)
SELECT k.id, fase.nome, fase.slug, fase.ordem
FROM kanbans k
CROSS JOIN (VALUES
  ('CrÃ©dito Terreno', 'credito_terreno', 1),
  ('CrÃ©dito Obra', 'credito_obra', 2)
) AS fase(nome, slug, ordem)
WHERE k.nome = 'CrÃ©dito'
ON CONFLICT (kanban_id, slug) WHERE slug IS NOT NULL DO NOTHING;

-- Portfolio + OperaÃ§Ãµes (19 fases de PAINEL_COLUMNS)
INSERT INTO kanban_fases (kanban_id, nome, slug, ordem)
SELECT k.id, fase.nome, fase.slug, fase.ordem
FROM kanbans k
CROSS JOIN (VALUES
  ('Dados do NegÃ³cio',       'step_2',                    1),
  ('AprovaÃ§Ã£o MonÃ­',         'aprovacao_moni_novo_negocio',2),
  ('DocumentaÃ§Ã£o',           'step_3',                    3),
  ('Acoplamento',            'acoplamento',               4),
  ('Step 4',                 'step_4',                    5),
  ('Step 5',                 'step_5',                    6),
  ('Step 6',                 'step_6',                    7),
  ('Step 7',                 'step_7',                    8),
  ('Passagem Wayser',        'passagem_wayser',           9),
  ('PlanialtimÃ©trico',       'planialtimetrico',          10),
  ('Sondagem',               'sondagem',                  11),
  ('Projeto Legal',          'projeto_legal',             12),
  ('AprovaÃ§Ã£o CondomÃ­nio',   'aprovacao_condominio',      13),
  ('AprovaÃ§Ã£o Prefeitura',   'aprovacao_prefeitura',      14),
  ('RevisÃ£o BCA',            'revisao_bca',               15),
  ('Processos CartorÃ¡rios',  'processos_cartorarios',     16),
  ('Aguardando CrÃ©dito',     'aguardando_credito',        17),
  ('Em Obra',                'em_obra',                   18),
  ('Moni Care',              'moni_care',                 19)
) AS fase(nome, slug, ordem)
WHERE k.nome IN ('Portfolio', 'OperaÃ§Ãµes')
ON CONFLICT (kanban_id, slug) WHERE slug IS NOT NULL DO NOTHING;

-- ============================================================
-- PARTE 2: VIEW de compatibilidade processo_step_one â†’ formato kanban_cards
-- ============================================================

CREATE OR REPLACE VIEW public.v_processo_como_kanban_cards AS
SELECT
  p.id,
  kf.kanban_id,
  kf.id          AS fase_id,
  COALESCE(
    NULLIF(TRIM(CONCAT_WS(' - ', p.numero_franquia, p.nome_condominio)), ''),
    'Sem tÃ­tulo'
  )              AS titulo,
  p.status,
  p.created_at   AS criado_em,
  p.updated_at,
  p.user_id      AS responsavel_id,
  p.etapa_painel AS etapa_slug,
  NULL::date     AS data_prazo_sla,
  'legado'       AS origem
FROM processo_step_one p
JOIN kanban_fases kf ON kf.slug = p.etapa_painel
JOIN kanbans k       ON k.id   = kf.kanban_id
WHERE k.nome IN ('Portfolio', 'OperaÃ§Ãµes', 'Contabilidade', 'CrÃ©dito')
  AND p.cancelado_em IS NULL
  AND p.removido_em  IS NULL;

GRANT SELECT ON public.v_processo_como_kanban_cards TO authenticated, anon;

-- ============================================================
-- VerificaÃ§Ã£o: quantos registros por kanban
-- ============================================================
SELECT k.nome, COUNT(*)
FROM v_processo_como_kanban_cards v
JOIN kanbans k ON k.id = v.kanban_id
GROUP BY k.nome;
GRANT SELECT ON public.v_atividades_unificadas TO authenticated, anon;
GRANT SELECT ON public.v_processo_como_kanban_cards TO authenticated, anon;
-- Migration 114: Renomear kanbans, aparar fases e corrigir nomes de fases
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ============================================================
-- PARTE 1: Renomear kanbans
-- ============================================================

UPDATE public.kanbans SET nome = 'Funil PortfÃ³lio'    WHERE nome = 'Portfolio';
UPDATE public.kanbans SET nome = 'Funil OperaÃ§Ãµes'    WHERE nome = 'OperaÃ§Ãµes';
UPDATE public.kanbans SET nome = 'Funil Contabilidade' WHERE nome = 'Contabilidade';
UPDATE public.kanbans SET nome = 'Funil CrÃ©dito'      WHERE nome = 'CrÃ©dito';

-- ============================================================
-- PARTE 2: Funil PortfÃ³lio â€” remover fases a partir de PlanialtimÃ©trico
-- (manter apenas step_2 â†’ passagem_wayser inclusive)
-- ============================================================

DELETE FROM public.kanban_fases
WHERE slug IN (
  'planialtimetrico', 'sondagem', 'projeto_legal',
  'aprovacao_condominio', 'aprovacao_prefeitura',
  'revisao_bca', 'processos_cartorarios',
  'aguardando_credito', 'em_obra', 'moni_care'
)
AND kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil PortfÃ³lio');

-- ============================================================
-- PARTE 3: Funil OperaÃ§Ãµes â€” remover fases atÃ© Passagem Wayser
-- (manter apenas planialtimetrico â†’ moni_care inclusive)
-- ============================================================

DELETE FROM public.kanban_fases
WHERE slug IN (
  'step_2', 'aprovacao_moni_novo_negocio', 'step_3', 'acoplamento',
  'step_4', 'step_5', 'step_6', 'step_7', 'passagem_wayser'
)
AND kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil OperaÃ§Ãµes');

-- ============================================================
-- PARTE 4: Corrigir nomes de fases (nomes exatos de painelColumns.ts)
-- ============================================================

-- Funil PortfÃ³lio
UPDATE public.kanban_fases SET nome = 'Step 2: Novo NegÃ³cio'                     WHERE slug = 'step_2';
UPDATE public.kanban_fases SET nome = 'AprovaÃ§Ã£o MonÃ­ - Novo NegÃ³cio'            WHERE slug = 'aprovacao_moni_novo_negocio';
UPDATE public.kanban_fases SET nome = 'Step 3: OpÃ§Ã£o'                            WHERE slug = 'step_3';
UPDATE public.kanban_fases SET nome = 'Step 4: Check Legal + Checklist de CrÃ©dito' WHERE slug = 'step_4';
-- 'acoplamento' â†’ 'Acoplamento' (jÃ¡ estÃ¡ correto)
UPDATE public.kanban_fases SET nome = 'Step 5: ComitÃª'                           WHERE slug = 'step_5';
UPDATE public.kanban_fases SET nome = 'Step 6: DiligÃªncia'                       WHERE slug = 'step_6';
UPDATE public.kanban_fases SET nome = 'Step 7: Contrato'                         WHERE slug = 'step_7';
UPDATE public.kanban_fases SET nome = 'Passagem para Wayser'                     WHERE slug = 'passagem_wayser';

-- Funil OperaÃ§Ãµes
-- 'planialtimetrico' â†’ 'PlanialtimÃ©trico' (jÃ¡ estÃ¡ correto)
UPDATE public.kanban_fases SET nome = 'Sondagem (paralelo PlanialtimÃ©trico)'     WHERE slug = 'sondagem';
-- 'projeto_legal' â†’ 'Projeto Legal' (jÃ¡ estÃ¡ correto)
UPDATE public.kanban_fases SET nome = 'AprovaÃ§Ã£o no CondomÃ­nio'                  WHERE slug = 'aprovacao_condominio';
UPDATE public.kanban_fases SET nome = 'AprovaÃ§Ã£o na Prefeitura'                  WHERE slug = 'aprovacao_prefeitura';
UPDATE public.kanban_fases SET nome = 'RevisÃ£o do BCA'                           WHERE slug = 'revisao_bca';
-- 'processos_cartorarios' â†’ 'Processos CartorÃ¡rios' (jÃ¡ estÃ¡ correto)
-- 'aguardando_credito' â†’ 'Aguardando CrÃ©dito' (jÃ¡ estÃ¡ correto)
-- 'em_obra' â†’ 'Em Obra' (jÃ¡ estÃ¡ correto)
UPDATE public.kanban_fases SET nome = 'MonÃ­ Care'                                WHERE slug = 'moni_care';

-- Funil Contabilidade
UPDATE public.kanban_fases SET nome = 'Abertura da Incorporadora'                WHERE slug = 'contabilidade_incorporadora';
UPDATE public.kanban_fases SET nome = 'Abertura da SPE'                          WHERE slug = 'contabilidade_spe';
UPDATE public.kanban_fases SET nome = 'Abertura da Gestora'                      WHERE slug = 'contabilidade_gestora';

-- Funil CrÃ©dito: 'CrÃ©dito Terreno' e 'CrÃ©dito Obra' jÃ¡ estÃ£o corretos

-- ============================================================
-- PARTE 5: Atualizar a view para usar os novos nomes dos kanbans
-- ============================================================

CREATE OR REPLACE VIEW public.v_processo_como_kanban_cards AS
SELECT
  p.id,
  kf.kanban_id,
  kf.id          AS fase_id,
  COALESCE(
    NULLIF(TRIM(CONCAT_WS(' - ', p.numero_franquia, p.nome_condominio)), ''),
    'Sem tÃ­tulo'
  )              AS titulo,
  p.status,
  p.created_at   AS criado_em,
  p.updated_at,
  p.user_id      AS responsavel_id,
  p.etapa_painel AS etapa_slug,
  NULL::date     AS data_prazo_sla,
  'legado'       AS origem
FROM processo_step_one p
JOIN kanban_fases kf ON kf.slug = p.etapa_painel
JOIN kanbans k       ON k.id   = kf.kanban_id
WHERE k.nome IN ('Funil PortfÃ³lio', 'Funil OperaÃ§Ãµes', 'Funil Contabilidade', 'Funil CrÃ©dito')
  AND p.cancelado_em IS NULL
  AND p.removido_em  IS NULL;

GRANT SELECT ON public.v_processo_como_kanban_cards TO authenticated, anon;

-- ============================================================
-- VerificaÃ§Ã£o: kanbans e contagem de fases
-- ============================================================
SELECT k.nome, COUNT(kf.id) AS total_fases
FROM public.kanbans k
LEFT JOIN public.kanban_fases kf ON kf.kanban_id = k.id
GROUP BY k.nome
ORDER BY k.nome;
UPDATE public.kanban_fases
SET sla_dias = 7
WHERE kanban_id IN (
  SELECT id FROM public.kanbans
  WHERE nome IN ('Funil PortfÃ³lio', 'Funil OperaÃ§Ãµes', 'Funil Contabilidade', 'Funil CrÃ©dito')
)
AND sla_dias IS NULL;
-- â”€â”€â”€ 116: FK suporte a cards legados (processo_step_one) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Problema: kanban_historico, kanban_atividades e kanban_card_comentarios
-- referenciavam kanban_cards(id), mas cards legados usam UUID de processo_step_one.
-- SoluÃ§Ã£o: remover FKs de card_id; em atividades, coluna origem nativo|legado.
-- Atualiza RLS e recria v_atividades_unificadas (compatÃ­vel com migration 110 + app).
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ============================================================
-- PARTE 0 â€” View depende de kanban_atividades; derrubar antes
-- ============================================================
DROP VIEW IF EXISTS public.v_atividades_unificadas;

-- ============================================================
-- PARTE 1 â€” kanban_atividades
-- ============================================================
ALTER TABLE public.kanban_atividades
  DROP CONSTRAINT IF EXISTS kanban_atividades_card_id_fkey;

ALTER TABLE public.kanban_atividades
  ADD COLUMN IF NOT EXISTS origem TEXT;

UPDATE public.kanban_atividades
SET origem = 'nativo'
WHERE origem IS NULL;

ALTER TABLE public.kanban_atividades
  ALTER COLUMN origem SET DEFAULT 'nativo';

ALTER TABLE public.kanban_atividades
  DROP CONSTRAINT IF EXISTS kanban_atividades_origem_check;

ALTER TABLE public.kanban_atividades
  ADD CONSTRAINT kanban_atividades_origem_check
  CHECK (origem IN ('nativo', 'legado'));

ALTER TABLE public.kanban_atividades
  ALTER COLUMN origem SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kanban_atividades_card_id
  ON public.kanban_atividades (card_id);

COMMENT ON COLUMN public.kanban_atividades.origem IS
  'nativo: card_id em kanban_cards. legado: card_id = processo_step_one.id.';

-- RLS: mesma regra de cards + processo dono (frank) ou jÃ¡ coberto por admin/consultor
DROP POLICY IF EXISTS kanban_atividades_select ON public.kanban_atividades;
CREATE POLICY kanban_atividades_select ON public.kanban_atividades
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'consultor')
    )
    OR EXISTS (
      SELECT 1 FROM public.kanban_cards
      WHERE kanban_cards.id = kanban_atividades.card_id
        AND kanban_cards.franqueado_id = auth.uid()
    )
    OR (
      kanban_atividades.origem = 'legado'
      AND EXISTS (
        SELECT 1 FROM public.processo_step_one p
        WHERE p.id = kanban_atividades.card_id
          AND p.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS kanban_atividades_insert ON public.kanban_atividades;
CREATE POLICY kanban_atividades_insert ON public.kanban_atividades
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'consultor')
    )
    OR EXISTS (
      SELECT 1 FROM public.kanban_cards
      WHERE kanban_cards.id = kanban_atividades.card_id
        AND kanban_cards.franqueado_id = auth.uid()
    )
    OR (
      kanban_atividades.origem = 'legado'
      AND EXISTS (
        SELECT 1 FROM public.processo_step_one p
        WHERE p.id = kanban_atividades.card_id
          AND p.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS kanban_atividades_update ON public.kanban_atividades;
CREATE POLICY kanban_atividades_update ON public.kanban_atividades
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'consultor')
    )
    OR EXISTS (
      SELECT 1 FROM public.kanban_cards
      WHERE kanban_cards.id = kanban_atividades.card_id
        AND kanban_cards.franqueado_id = auth.uid()
    )
    OR (
      kanban_atividades.origem = 'legado'
      AND EXISTS (
        SELECT 1 FROM public.processo_step_one p
        WHERE p.id = kanban_atividades.card_id
          AND p.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS kanban_atividades_delete ON public.kanban_atividades;
CREATE POLICY kanban_atividades_delete ON public.kanban_atividades
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'consultor')
    )
    OR EXISTS (
      SELECT 1 FROM public.kanban_cards
      WHERE kanban_cards.id = kanban_atividades.card_id
        AND kanban_cards.franqueado_id = auth.uid()
    )
    OR (
      kanban_atividades.origem = 'legado'
      AND EXISTS (
        SELECT 1 FROM public.processo_step_one p
        WHERE p.id = kanban_atividades.card_id
          AND p.user_id = auth.uid()
      )
    )
  );

-- ============================================================
-- PARTE 2 â€” kanban_historico
-- ============================================================
ALTER TABLE public.kanban_historico
  DROP CONSTRAINT IF EXISTS kanban_historico_card_id_fkey;

CREATE INDEX IF NOT EXISTS idx_kanban_historico_card_id
  ON public.kanban_historico (card_id);

DROP POLICY IF EXISTS "kanban_historico_select" ON public.kanban_historico;
CREATE POLICY "kanban_historico_select"
  ON public.kanban_historico FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role IN ('admin', 'consultor')
    )
    OR EXISTS (
      SELECT 1 FROM public.kanban_cards kc
      WHERE kc.id = kanban_historico.card_id
        AND kc.franqueado_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = kanban_historico.card_id
        AND p.user_id = auth.uid()
    )
  );

-- ============================================================
-- PARTE 3 â€” kanban_card_comentarios
-- ============================================================
ALTER TABLE public.kanban_card_comentarios
  DROP CONSTRAINT IF EXISTS kanban_card_comentarios_card_id_fkey;

CREATE INDEX IF NOT EXISTS idx_kanban_card_comentarios_card_id
  ON public.kanban_card_comentarios (card_id);

DROP POLICY IF EXISTS "kanban_card_comentarios_select" ON public.kanban_card_comentarios;
CREATE POLICY "kanban_card_comentarios_select"
  ON public.kanban_card_comentarios FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.kanban_cards c
      WHERE c.id = kanban_card_comentarios.card_id
    )
    OR EXISTS (
      SELECT 1 FROM public.processo_step_one p
      WHERE p.id = kanban_card_comentarios.card_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles pr
            WHERE pr.id = auth.uid()
              AND pr.role IN ('admin', 'consultor')
          )
        )
    )
  );

DROP POLICY IF EXISTS "kanban_card_comentarios_insert" ON public.kanban_card_comentarios;
CREATE POLICY "kanban_card_comentarios_insert"
  ON public.kanban_card_comentarios FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.kanban_cards c
        WHERE c.id = kanban_card_comentarios.card_id
      )
      OR EXISTS (
        SELECT 1 FROM public.processo_step_one p
        WHERE p.id = kanban_card_comentarios.card_id
          AND (
            p.user_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.profiles pr
              WHERE pr.id = auth.uid()
                AND pr.role IN ('admin', 'consultor')
            )
          )
      )
    )
  );

-- ============================================================
-- PARTE 4 â€” v_atividades_unificadas (nativo + legado)
-- Colunas alinhadas Ã  migration 110 (app / card-actions).
-- sla_status: NULL sem prazo (filtro "sem_prazo" no painel).
-- ============================================================
CREATE VIEW public.v_atividades_unificadas
WITH (security_invoker = true)
AS
SELECT
  a.id,
  a.card_id,

  COALESCE(kc.titulo, vmap.titulo, '(sem tÃ­tulo)') AS card_titulo,

  COALESCE(kf.nome, '') AS fase_nome,

  COALESCE(k.nome, '') AS kanban_nome,

  COALESCE(kc.kanban_id, vmap.kanban_id) AS kanban_id,

  a.responsavel_id,
  COALESCE(rsp.full_name, rsp.email) AS responsavel_nome,

  a.tipo,

  COALESCE(
    NULLIF(trim(a.titulo), ''),
    NULLIF(trim(a.descricao), ''),
    '(sem tÃ­tulo)'
  ) AS titulo,

  a.descricao,

  a.status AS atividade_status,

  a.data_vencimento,

  a.time AS time_nome,

  a.times_ids,

  ARRAY(
    SELECT t.nome
    FROM   public.kanban_times t
    WHERE  t.id = ANY (a.times_ids)
    ORDER  BY t.nome
  ) AS times_nomes,

  COALESCE(fp_card.full_name, fp_card.email, fp_leg.full_name, fp_leg.email) AS franqueado_nome,

  a.created_at AS criado_em,

  CASE
    WHEN a.data_vencimento IS NULL THEN NULL::text
    WHEN a.data_vencimento < CURRENT_DATE THEN 'atrasado'
    WHEN a.data_vencimento = CURRENT_DATE THEN 'vence_hoje'
    ELSE 'ok'
  END::text AS sla_status

FROM public.kanban_atividades a
LEFT JOIN public.kanban_cards kc
  ON kc.id = a.card_id
 AND a.origem = 'nativo'
LEFT JOIN public.v_processo_como_kanban_cards vmap
  ON vmap.id = a.card_id
 AND a.origem = 'legado'
LEFT JOIN public.kanban_fases kf
  ON kf.id = COALESCE(kc.fase_id, vmap.fase_id)
LEFT JOIN public.kanbans k
  ON k.id = COALESCE(kc.kanban_id, vmap.kanban_id)
LEFT JOIN public.profiles rsp
  ON rsp.id = a.responsavel_id
LEFT JOIN public.profiles fp_card
  ON fp_card.id = kc.franqueado_id
LEFT JOIN public.profiles fp_leg
  ON fp_leg.id = vmap.responsavel_id
WHERE
  (a.origem = 'nativo' AND kc.id IS NOT NULL)
  OR (a.origem = 'legado' AND vmap.id IS NOT NULL);

COMMENT ON VIEW public.v_atividades_unificadas IS
  'InteraÃ§Ãµes (kanban_atividades): cards nativos (kanban_cards) ou legados '
  '(processo_step_one via v_processo_como_kanban_cards). Mesmas colunas da 110.';

GRANT SELECT ON public.v_atividades_unificadas TO authenticated, anon;
-- â”€â”€â”€ 117: kanban_atividades â€” tabela central de interaÃ§Ãµes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Expande kanban_atividades com mÃºltiplos responsÃ¡veis, trava e suporte a
-- interaÃ§Ãµes originadas externamente (origem_externa, solicitante_nome/email).
-- responsavel_id (legado, singular) Ã© migrado para responsaveis_ids[].
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ============================================================
-- PARTE 1 â€” Novas colunas
-- ============================================================
ALTER TABLE public.kanban_atividades
  ADD COLUMN IF NOT EXISTS responsaveis_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trava BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS origem_externa BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS solicitante_nome TEXT,
  ADD COLUMN IF NOT EXISTS solicitante_email TEXT;

COMMENT ON COLUMN public.kanban_atividades.responsaveis_ids IS
  'Lista de responsÃ¡veis pela atividade. Substitui/complementa responsavel_id singular.';
COMMENT ON COLUMN public.kanban_atividades.trava IS
  'Se true, bloqueia avanÃ§o do card atÃ© esta atividade ser concluÃ­da.';
COMMENT ON COLUMN public.kanban_atividades.origem_externa IS
  'Se true, a atividade foi criada por solicitante externo (nÃ£o usuÃ¡rio interno).';
COMMENT ON COLUMN public.kanban_atividades.solicitante_nome IS
  'Nome do solicitante externo (quando origem_externa = true).';
COMMENT ON COLUMN public.kanban_atividades.solicitante_email IS
  'E-mail do solicitante externo (quando origem_externa = true).';

-- ============================================================
-- PARTE 2 â€” Migrar responsavel_id â†’ responsaveis_ids
-- ============================================================
UPDATE public.kanban_atividades
SET responsaveis_ids = ARRAY[responsavel_id]
WHERE responsavel_id IS NOT NULL
  AND (responsaveis_ids IS NULL OR responsaveis_ids = '{}');

-- ============================================================
-- PARTE 3 â€” Ãndices
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_kanban_atividades_responsaveis
  ON public.kanban_atividades USING GIN (responsaveis_ids);

CREATE INDEX IF NOT EXISTS idx_kanban_atividades_trava
  ON public.kanban_atividades (trava) WHERE trava = true;
-- â”€â”€â”€ 118: sirene_topicos como sub-interaÃ§Ãµes de kanban_atividades â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Vincula tÃ³picos a interaÃ§Ãµes do kanban (interacao_id), adiciona suporte a
-- mÃºltiplos times e responsÃ¡veis, e trava por tÃ³pico (jÃ¡ existia via 039,
-- adicionada aqui para times_ids e responsaveis_ids).
-- Fluxo de aprovaÃ§Ã£o Bombeiro (aprovado_bombeiro / motivo_reprovacao) Ã©
-- DESATIVADO: colunas mantidas no schema, marcadas via COMMENT.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ============================================================
-- PARTE 1 â€” Novas colunas em sirene_topicos
-- ============================================================
ALTER TABLE public.sirene_topicos
  ADD COLUMN IF NOT EXISTS interacao_id UUID REFERENCES public.kanban_atividades(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS times_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS responsaveis_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trava BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.sirene_topicos.interacao_id IS
  'VÃ­nculo com kanban_atividades: tÃ³pico como sub-interaÃ§Ã£o de uma interaÃ§Ã£o do kanban.';
COMMENT ON COLUMN public.sirene_topicos.times_ids IS
  'Times UUID responsÃ¡veis pelo tÃ³pico (complementa time_responsavel texto).';
COMMENT ON COLUMN public.sirene_topicos.responsaveis_ids IS
  'Lista de responsÃ¡veis pelo tÃ³pico. Complementa/substitui responsavel_id singular.';

-- ============================================================
-- PARTE 2 â€” Migrar responsavel_id â†’ responsaveis_ids
-- ============================================================
UPDATE public.sirene_topicos
SET responsaveis_ids = ARRAY[responsavel_id]
WHERE responsavel_id IS NOT NULL
  AND (responsaveis_ids IS NULL OR responsaveis_ids = '{}');

-- ============================================================
-- PARTE 3 â€” Desativar fluxo de aprovaÃ§Ã£o Bombeiro
-- Colunas preservadas para nÃ£o quebrar queries existentes.
-- Ver docs/SIRENE_TOPICOS_APROVACAO_BACKUP.md para reativaÃ§Ã£o.
-- ============================================================
COMMENT ON COLUMN public.sirene_topicos.aprovado_bombeiro IS
  'DESATIVADO â€” fluxo de aprovaÃ§Ã£o removido em migration 118. Ver docs/SIRENE_TOPICOS_APROVACAO_BACKUP.md';
COMMENT ON COLUMN public.sirene_topicos.motivo_reprovacao IS
  'DESATIVADO â€” fluxo de aprovaÃ§Ã£o removido em migration 118. Ver docs/SIRENE_TOPICOS_APROVACAO_BACKUP.md';

-- ============================================================
-- PARTE 4 â€” Ãndices
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sirene_topicos_interacao
  ON public.sirene_topicos (interacao_id);

CREATE INDEX IF NOT EXISTS idx_sirene_topicos_responsaveis
  ON public.sirene_topicos USING GIN (responsaveis_ids);
-- â”€â”€â”€ 119: notificaÃ§Ãµes ao atribuir interaÃ§Ãµes (kanban_atividades) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Vincula sirene_notificacoes a kanban_atividades via interacao_id e dispara
-- notificaÃ§Ã£o automÃ¡tica para cada responsÃ¡vel ao INSERT de nova interaÃ§Ã£o.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ============================================================
-- PARTE 1 â€” interacao_id em sirene_notificacoes
-- ============================================================
ALTER TABLE public.sirene_notificacoes
  ADD COLUMN IF NOT EXISTS interacao_id UUID REFERENCES public.kanban_atividades(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.sirene_notificacoes.interacao_id IS
  'ReferÃªncia Ã  interaÃ§Ã£o (kanban_atividades) que gerou a notificaÃ§Ã£o. NULL para notificaÃ§Ãµes de chamado puro.';

CREATE INDEX IF NOT EXISTS idx_sirene_notificacoes_interacao
  ON public.sirene_notificacoes (interacao_id);

-- ============================================================
-- PARTE 2 â€” Trigger: notificar responsÃ¡veis ao criar interaÃ§Ã£o
-- Silencia erros para nunca bloquear o INSERT da atividade.
-- NÃ£o notifica o prÃ³prio criador da interaÃ§Ã£o.
-- Suporta cards nativos (kanban_cards) e legados (origem = 'legado'):
-- legado nÃ£o tem linha em kanban_cards, card_titulo fica NULL â†’ omitido.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_notificar_responsaveis_interacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  resp_id    UUID;
  card_titulo TEXT;
BEGIN
  IF NEW.responsaveis_ids IS NULL OR array_length(NEW.responsaveis_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(titulo, '(sem tÃ­tulo)') INTO card_titulo
  FROM public.kanban_cards
  WHERE id = NEW.card_id
  LIMIT 1;

  FOREACH resp_id IN ARRAY NEW.responsaveis_ids LOOP
    IF resp_id != COALESCE(NEW.criado_por, '00000000-0000-0000-0000-000000000000'::uuid) THEN
      INSERT INTO public.sirene_notificacoes (user_id, interacao_id, tipo, texto)
      VALUES (
        resp_id,
        NEW.id,
        'interacao_atribuida',
        'VocÃª foi atribuÃ­do Ã  interaÃ§Ã£o "' ||
          COALESCE(NEW.titulo, NEW.descricao, 'sem tÃ­tulo') || '"' ||
          CASE WHEN card_titulo IS NOT NULL THEN ' no card ' || card_titulo ELSE '' END
      );
    END IF;
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_interacao ON public.kanban_atividades;
CREATE TRIGGER trg_notificar_interacao
  AFTER INSERT ON public.kanban_atividades
  FOR EACH ROW EXECUTE FUNCTION public.fn_notificar_responsaveis_interacao();

GRANT EXECUTE ON FUNCTION public.fn_notificar_responsaveis_interacao() TO authenticated;
-- â”€â”€â”€ 120: migrar sirene_chamados â†’ kanban_atividades â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Chamados existentes nÃ£o tÃªm card de origem; entram como origem='sirene'.
-- Expande o check de origem, torna card_id nullable, migra os chamados e
-- atualiza v_atividades_unificadas para incluir sirene e externo.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ============================================================
-- PARTE 0 â€” View depende de kanban_atividades; derrubar antes
-- ============================================================
DROP VIEW IF EXISTS public.v_atividades_unificadas;

-- ============================================================
-- PARTE 1 â€” Ampliar check de origem
-- ============================================================
ALTER TABLE public.kanban_atividades
  DROP CONSTRAINT IF EXISTS kanban_atividades_origem_check;

ALTER TABLE public.kanban_atividades
  ADD CONSTRAINT kanban_atividades_origem_check
  CHECK (origem IN ('nativo', 'legado', 'sirene', 'externo'));

-- ============================================================
-- PARTE 2 â€” card_id passa a ser nullable
-- Registros nativo/legado jÃ¡ existentes continuam com valor;
-- sirene/externo entram com card_id = NULL.
-- ============================================================
ALTER TABLE public.kanban_atividades
  ALTER COLUMN card_id DROP NOT NULL;

-- ============================================================
-- PARTE 3 â€” Migrar chamados existentes
-- Idempotente via ON CONFLICT DO NOTHING (nÃ£o hÃ¡ UNIQUE em
-- sirene_chamados.id â†’ kanban_atividades, mas o INSERT duplo
-- seria bloqueado pelo check de origem caso reexecutado num
-- banco zerado). Para evitar duplicatas em reexecuÃ§Ãµes num
-- banco com dados, filtramos chamados que jÃ¡ geraram uma
-- interaÃ§Ã£o origem='sirene' com o mesmo criado_por + created_at.
-- ============================================================
INSERT INTO public.kanban_atividades (
  titulo,
  descricao,
  tipo,
  status,
  trava,
  origem,
  criado_por,
  created_at,
  updated_at
)
SELECT
  sc.incendio                          AS titulo,
  sc.resolucao_pontual                 AS descricao,
  CASE sc.tipo
    WHEN 'hdm' THEN 'chamado_hdm'
    ELSE           'chamado_padrao'
  END                                  AS tipo,
  CASE sc.status
    WHEN 'nao_iniciado'              THEN 'pendente'
    WHEN 'em_andamento'              THEN 'em_andamento'
    WHEN 'concluido'                 THEN 'concluida'
    WHEN 'aguardando_aprovacao_criador' THEN 'em_andamento'
    ELSE                                  'pendente'
  END                                  AS status,
  sc.trava                             AS trava,
  'sirene'                             AS origem,
  sc.aberto_por                        AS criado_por,
  sc.created_at,
  sc.updated_at
FROM public.sirene_chamados sc
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_atividades ka
  WHERE ka.origem    = 'sirene'
    AND ka.criado_por = sc.aberto_por
    AND ka.created_at = sc.created_at
);

-- ============================================================
-- PARTE 4 â€” Recriar v_atividades_unificadas
-- Colunas idÃªnticas Ã  migration 116 + suporte a sirene/externo:
--   card_titulo  â†’ '(chamado direto)' | '(externo)'
--   kanban_nome  â†’ 'Sirene'           | 'Externo'
--   fase_nome    â†’ '' (sem fase)
--   kanban_id    â†’ NULL
--   franqueado_nome â†’ NULL
-- ============================================================
CREATE VIEW public.v_atividades_unificadas
WITH (security_invoker = true)
AS
SELECT
  a.id,
  a.card_id,

  COALESCE(
    kc.titulo,
    vmap.titulo,
    CASE a.origem
      WHEN 'sirene'   THEN '(chamado direto)'
      WHEN 'externo'  THEN '(externo)'
      ELSE                 '(sem tÃ­tulo)'
    END
  ) AS card_titulo,

  COALESCE(kf.nome, '') AS fase_nome,

  COALESCE(
    k.nome,
    CASE a.origem
      WHEN 'sirene'  THEN 'Sirene'
      WHEN 'externo' THEN 'Externo'
      ELSE                ''
    END
  ) AS kanban_nome,

  COALESCE(kc.kanban_id, vmap.kanban_id) AS kanban_id,

  a.responsavel_id,
  COALESCE(rsp.full_name, rsp.email) AS responsavel_nome,

  a.tipo,

  COALESCE(
    NULLIF(trim(a.titulo), ''),
    NULLIF(trim(a.descricao), ''),
    '(sem tÃ­tulo)'
  ) AS titulo,

  a.descricao,

  a.status AS atividade_status,

  a.data_vencimento,

  a.time AS time_nome,

  a.times_ids,

  ARRAY(
    SELECT t.nome
    FROM   public.kanban_times t
    WHERE  t.id = ANY (a.times_ids)
    ORDER  BY t.nome
  ) AS times_nomes,

  COALESCE(fp_card.full_name, fp_card.email, fp_leg.full_name, fp_leg.email) AS franqueado_nome,

  a.created_at AS criado_em,

  CASE
    WHEN a.data_vencimento IS NULL    THEN NULL::text
    WHEN a.data_vencimento < CURRENT_DATE THEN 'atrasado'
    WHEN a.data_vencimento = CURRENT_DATE THEN 'vence_hoje'
    ELSE 'ok'
  END::text AS sla_status

FROM public.kanban_atividades a
LEFT JOIN public.kanban_cards kc
  ON kc.id = a.card_id
 AND a.origem = 'nativo'
LEFT JOIN public.v_processo_como_kanban_cards vmap
  ON vmap.id = a.card_id
 AND a.origem = 'legado'
LEFT JOIN public.kanban_fases kf
  ON kf.id = COALESCE(kc.fase_id, vmap.fase_id)
LEFT JOIN public.kanbans k
  ON k.id = COALESCE(kc.kanban_id, vmap.kanban_id)
LEFT JOIN public.profiles rsp
  ON rsp.id = a.responsavel_id
LEFT JOIN public.profiles fp_card
  ON fp_card.id = kc.franqueado_id
LEFT JOIN public.profiles fp_leg
  ON fp_leg.id = vmap.responsavel_id
WHERE
  (a.origem = 'nativo'  AND kc.id   IS NOT NULL)
  OR (a.origem = 'legado'   AND vmap.id IS NOT NULL)
  OR  a.origem = 'sirene'
  OR  a.origem = 'externo';

COMMENT ON VIEW public.v_atividades_unificadas IS
  'InteraÃ§Ãµes (kanban_atividades): cards nativos, legados (processo_step_one), '
  'chamados Sirene (origem=sirene) e interaÃ§Ãµes externas (origem=externo). '
  'Mesmas colunas da migration 116.';

GRANT SELECT ON public.v_atividades_unificadas TO authenticated, anon;
-- â”€â”€â”€ 121: sirene_topicos como sub-interaÃ§Ã£o sÃ³ de kanban (sem chamado) â”€â”€â”€â”€â”€â”€â”€
-- Permite chamado_id NULL quando interacao_id aponta para kanban_atividades.
-- Ajusta RLS para linhas vinculadas a interaÃ§Ã£o (acesso alinhado ao card/atividade).

ALTER TABLE public.sirene_topicos
  ALTER COLUMN chamado_id DROP NOT NULL;

COMMENT ON COLUMN public.sirene_topicos.chamado_id IS
  'Chamado Sirene (legado). NULL quando o tÃ³pico Ã© sub-interaÃ§Ã£o de kanban_atividades (interacao_id).';

ALTER TABLE public.sirene_topicos
  DROP CONSTRAINT IF EXISTS sirene_topicos_chamado_ou_interacao_chk;

ALTER TABLE public.sirene_topicos
  ADD CONSTRAINT sirene_topicos_chamado_ou_interacao_chk
  CHECK (chamado_id IS NOT NULL OR interacao_id IS NOT NULL);

DROP POLICY IF EXISTS "sirene_topicos_all" ON public.sirene_topicos;

CREATE POLICY "sirene_topicos_all"
  ON public.sirene_topicos FOR ALL
  USING (
    (
      sirene_topicos.chamado_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM   public.sirene_chamados c
        WHERE  c.id = sirene_topicos.chamado_id
          AND (
            c.aberto_por = auth.uid()
            OR public.get_my_sirene_papel() IN ('bombeiro', 'caneta_verde')
            OR public.user_has_topic_on_chamado(c.id, auth.uid())
          )
      )
    )
    OR (
      sirene_topicos.interacao_id IS NOT NULL
      AND (
        auth.uid() = ANY (COALESCE(sirene_topicos.responsaveis_ids, '{}'))
        OR sirene_topicos.responsavel_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM   public.kanban_atividades a
          WHERE  a.id = sirene_topicos.interacao_id
            AND (
              EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = auth.uid()
                  AND p.role IN ('admin', 'consultor')
              )
              OR EXISTS (
                SELECT 1 FROM public.kanban_cards kc
                WHERE kc.id = a.card_id
                  AND a.origem = 'nativo'
                  AND kc.franqueado_id = auth.uid()
              )
              OR (
                a.origem = 'legado'
                AND EXISTS (
                  SELECT 1 FROM public.processo_step_one p
                  WHERE p.id = a.card_id
                    AND p.user_id = auth.uid()
                )
              )
              OR a.responsavel_id = auth.uid()
              OR auth.uid() = ANY (COALESCE(a.responsaveis_ids, '{}'))
              OR a.criado_por = auth.uid()
            )
        )
      )
    )
  );
-- â”€â”€â”€ 122: seed de interaÃ§Ãµes de exemplo para teste do Painel Sirene â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Insere kanban_atividades para cards nativos (Funil Step One) e interaÃ§Ãµes
-- diretas origem='sirene' (sem card). Idempotente: filtra por titulo+card_id.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ============================================================
-- PARTE 1 â€” InteraÃ§Ãµes para cards do Funil Step One (nativo)
-- Usa os 5 primeiros cards ativos para nÃ£o saturar o banco dev.
-- ============================================================
INSERT INTO public.kanban_atividades
  (card_id, titulo, descricao, tipo, status, data_vencimento, origem, time,
   criado_por, responsavel_id, responsaveis_ids)
SELECT
  kc.id                                     AS card_id,
  t.titulo,
  t.descricao,
  t.tipo,
  t.status,
  t.data_vencimento,
  'nativo'                                  AS origem,
  t.time,
  kc.franqueado_id                          AS criado_por,
  kc.franqueado_id                          AS responsavel_id,
  CASE WHEN kc.franqueado_id IS NOT NULL
    THEN ARRAY[kc.franqueado_id]
    ELSE '{}'::uuid[]
  END                                       AS responsaveis_ids
FROM (
  SELECT id, franqueado_id
  FROM   public.kanban_cards
  ORDER  BY created_at DESC
  LIMIT  5
) kc
CROSS JOIN (
  VALUES
    ('Preparar relatÃ³rio fotogrÃ¡fico da regiÃ£o',
     'Fazer registros visuais dos principais pontos de interesse',
     'atividade', 'pendente',     CURRENT_DATE - INTERVAL '7 days',  'operacoes'),
    ('Agendar reuniÃ£o com corretores locais',
     'Marcar encontro para entender dinÃ¢mica do mercado imobiliÃ¡rio',
     'duvida',    'pendente',     CURRENT_DATE + INTERVAL '1 day',   'comercial'),
    ('Solicitar certidÃµes e documentos',
     'Reunir toda documentaÃ§Ã£o legal para anÃ¡lise de viabilidade',
     'atividade', 'em_andamento', CURRENT_DATE + INTERVAL '5 days',  'juridico')
) AS t(titulo, descricao, tipo, status, data_vencimento, time)
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_atividades ka
  WHERE ka.card_id = kc.id
    AND ka.titulo  = t.titulo
    AND ka.origem  = 'nativo'
);

-- ============================================================
-- PARTE 2 â€” InteraÃ§Ãµes diretas origem='sirene' (sem card)
-- Vinculadas aos 3 chamados mais recentes para teste do painel.
-- ============================================================
INSERT INTO public.kanban_atividades
  (card_id, titulo, descricao, tipo, status, data_vencimento, origem, time,
   criado_por, responsavel_id, responsaveis_ids, trava)
SELECT
  NULL                                           AS card_id,
  t.titulo,
  t.descricao,
  t.tipo,
  t.status,
  t.data_vencimento,
  'sirene'                                       AS origem,
  t.time,
  sc.aberto_por                                  AS criado_por,
  sc.aberto_por                                  AS responsavel_id,
  CASE WHEN sc.aberto_por IS NOT NULL
    THEN ARRAY[sc.aberto_por]
    ELSE '{}'::uuid[]
  END                                            AS responsaveis_ids,
  t.trava
FROM (
  SELECT id, aberto_por
  FROM   public.sirene_chamados
  ORDER  BY created_at DESC
  LIMIT  3
) sc
CROSS JOIN (
  VALUES
    ('AnÃ¡lise de impacto da ocorrÃªncia',
     'Levantar dados de recorrÃªncia e raiz do problema',
     'atividade', 'pendente',     CURRENT_DATE + INTERVAL '2 days',  'operacoes', false),
    ('Documentar resoluÃ§Ã£o no sistema',
     'Registrar passos da soluÃ§Ã£o para base de conhecimento',
     'atividade', 'em_andamento', CURRENT_DATE + INTERVAL '3 days',  'operacoes', false),
    ('Validar com o time jurÃ­dico',
     'Confirmar se hÃ¡ implicaÃ§Ãµes contratuais',
     'duvida',    'pendente',     CURRENT_DATE - INTERVAL '1 day',   'juridico',  true)
) AS t(titulo, descricao, tipo, status, data_vencimento, time, trava)
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_atividades ka
  WHERE ka.criado_por = sc.aberto_por
    AND ka.titulo     = t.titulo
    AND ka.origem     = 'sirene'
);

-- ============================================================
-- PARTE 3 â€” Sub-interaÃ§Ãµes (sirene_topicos) vinculadas Ã s
-- interaÃ§Ãµes sirene criadas na PARTE 2
-- ============================================================
INSERT INTO public.sirene_topicos
  (interacao_id, chamado_id, ordem, descricao, time_responsavel, status, trava,
   responsaveis_ids)
SELECT
  ka.id                       AS interacao_id,
  NULL                        AS chamado_id,
  st.ordem,
  st.descricao,
  st.time_responsavel,
  st.status,
  false                       AS trava,
  CASE WHEN ka.responsavel_id IS NOT NULL
    THEN ARRAY[ka.responsavel_id]
    ELSE '{}'::uuid[]
  END                         AS responsaveis_ids
FROM public.kanban_atividades ka
CROSS JOIN (
  VALUES
    (1, 'Coletar evidÃªncias do incidente',   'operacoes',  'nao_iniciado'),
    (2, 'Elaborar relatÃ³rio de encerramento','operacoes',  'em_andamento'),
    (3, 'Apresentar Ã  Caneta Verde',         'juridico',   'nao_iniciado')
) AS st(ordem, descricao, time_responsavel, status)
WHERE ka.origem = 'sirene'
  AND NOT EXISTS (
    SELECT 1 FROM public.sirene_topicos stt
    WHERE stt.interacao_id = ka.id
      AND stt.descricao    = st.descricao
  )
ORDER BY ka.created_at DESC
LIMIT 9;
-- â”€â”€â”€ 123: arquivamento de cards + SLA configurÃ¡vel em fases â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Parte 1: colunas de arquivamento em kanban_cards + trigger de log.
-- Parte 2: SLA padrÃ£o 7 dias em kanban_fases + fn_atualizar_sla_fase().
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ============================================================
-- PARTE 1 â€” Arquivamento em kanban_cards
-- ============================================================

-- 1a. Novas colunas
ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS arquivado          BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS arquivado_em       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arquivado_por      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo_arquivamento TEXT;

COMMENT ON COLUMN public.kanban_cards.arquivado IS
  'Se true, card estÃ¡ arquivado e nÃ£o aparece nas listagens ativas.';
COMMENT ON COLUMN public.kanban_cards.arquivado_em IS
  'Timestamp do arquivamento.';
COMMENT ON COLUMN public.kanban_cards.arquivado_por IS
  'UsuÃ¡rio que arquivou o card.';
COMMENT ON COLUMN public.kanban_cards.motivo_arquivamento IS
  'Motivo opcional informado ao arquivar.';

-- 1b. Ãndice parcial â€” sÃ³ indexa cards arquivados (minoria)
CREATE INDEX IF NOT EXISTS idx_kanban_cards_arquivado
  ON public.kanban_cards (arquivado) WHERE arquivado = true;

-- 1c. Expandir check de kanban_historico.acao para incluir card_arquivado
ALTER TABLE public.kanban_historico
  DROP CONSTRAINT IF EXISTS kanban_historico_acao_check;

ALTER TABLE public.kanban_historico
  ADD CONSTRAINT kanban_historico_acao_check
  CHECK (acao IN (
    'card_criado',
    'fase_avancada',
    'fase_retrocedida',
    'interacao_criada',
    'interacao_editada',
    'campo_alterado',
    'card_arquivado'
  ));

-- 1d. Trigger: loga arquivamento quando arquivado muda de false â†’ true
CREATE OR REPLACE FUNCTION public.fn_log_arquivamento_card()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- SÃ³ dispara quando arquivado efetivamente virou true
  IF NOT (OLD.arquivado IS DISTINCT FROM NEW.arquivado AND NEW.arquivado = true) THEN
    RETURN NEW;
  END IF;

  v_user_id := COALESCE(auth.uid(), NEW.arquivado_por);

  INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, detalhe)
  VALUES (
    NEW.id,
    v_user_id,
    public.fn_resolve_usuario_nome(v_user_id),
    'card_arquivado',
    jsonb_build_object(
      'motivo',       COALESCE(NEW.motivo_arquivamento, ''),
      'arquivado_em', COALESCE(NEW.arquivado_em, now())
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_log_arquivamento_card: erro ignorado â€” %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kanban_cards_arquivamento ON public.kanban_cards;
CREATE TRIGGER trg_kanban_cards_arquivamento
  AFTER UPDATE OF arquivado ON public.kanban_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_log_arquivamento_card();

COMMENT ON FUNCTION public.fn_log_arquivamento_card() IS
  'Registra card_arquivado em kanban_historico quando arquivado muda para true. '
  'Inclui motivo e timestamp no detalhe JSONB.';

-- ============================================================
-- PARTE 2 â€” SLA configurÃ¡vel em kanban_fases
-- ============================================================

-- 2a. Preencher sla_dias nulos restantes e fixar default
UPDATE public.kanban_fases
SET sla_dias = 7
WHERE sla_dias IS NULL;

ALTER TABLE public.kanban_fases
  ALTER COLUMN sla_dias SET DEFAULT 7;

COMMENT ON COLUMN public.kanban_fases.sla_dias IS
  'SLA em dias Ãºteis para cards nesta fase. Default 7. ConfigurÃ¡vel via fn_atualizar_sla_fase().';

-- 2b. FunÃ§Ã£o para atualizar SLA de uma fase com validaÃ§Ã£o
CREATE OR REPLACE FUNCTION public.fn_atualizar_sla_fase(
  p_fase_id  UUID,
  p_sla_dias INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_sla_dias IS NULL OR p_sla_dias < 1 OR p_sla_dias > 365 THEN
    RAISE EXCEPTION 'sla_dias deve ser um inteiro entre 1 e 365. Recebido: %', p_sla_dias;
  END IF;

  UPDATE public.kanban_fases
  SET sla_dias = p_sla_dias
  WHERE id = p_fase_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fase nÃ£o encontrada: %', p_fase_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.fn_atualizar_sla_fase(UUID, INTEGER) IS
  'Atualiza sla_dias de uma fase. Valida intervalo 1â€“365 e lanÃ§a exceÃ§Ã£o se a fase nÃ£o existir.';

GRANT EXECUTE ON FUNCTION public.fn_atualizar_sla_fase(UUID, INTEGER) TO authenticated;
-- â”€â”€â”€ 124: finalizaÃ§Ã£o de cards + mÃ©tricas de retrabalho + SLA acumulado â”€â”€â”€â”€â”€â”€
-- Parte 1: colunas concluido/concluido_em/concluido_por em kanban_cards.
-- Parte 2: coluna is_retrocesso em kanban_historico + trigger fn_marcar_retrocesso.
-- Parte 3: substituiÃ§Ã£o de fn_historico_fase_alterada (108) para incluir ordens no detalhe.
-- Parte 4: sla_dias_acumulados em kanban_cards.
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- ============================================================
-- PARTE 1 â€” Colunas de finalizaÃ§Ã£o em kanban_cards
-- ============================================================

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS concluido       BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS concluido_em    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS concluido_por   UUID        REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.kanban_cards.concluido IS
  'Se true, card foi finalizado manualmente.';
COMMENT ON COLUMN public.kanban_cards.concluido_em IS
  'Timestamp da finalizaÃ§Ã£o do card.';
COMMENT ON COLUMN public.kanban_cards.concluido_por IS
  'UsuÃ¡rio que finalizou o card.';

-- ============================================================
-- PARTE 2 â€” MÃ©tricas de retrabalho em kanban_historico
-- ============================================================

ALTER TABLE public.kanban_historico
  ADD COLUMN IF NOT EXISTS is_retrocesso BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.kanban_historico.is_retrocesso IS
  'true quando a mudanÃ§a de fase representa retrocesso (fase_nova_ordem < fase_anterior_ordem).';

-- Trigger que marca is_retrocesso logo apÃ³s inserÃ§Ã£o no histÃ³rico.
-- Depende de fase_anterior_ordem e fase_nova_ordem presentes no detalhe JSONB
-- (garantidos pelo fn_historico_fase_alterada atualizado na Parte 3).
CREATE OR REPLACE FUNCTION public.fn_marcar_retrocesso()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.acao IN ('fase_avancada', 'fase_retrocedida')
     AND (NEW.detalhe->>'fase_nova_ordem') IS NOT NULL
     AND (NEW.detalhe->>'fase_anterior_ordem') IS NOT NULL
  THEN
    UPDATE public.kanban_historico
    SET is_retrocesso = (
      (NEW.detalhe->>'fase_nova_ordem')::int < (NEW.detalhe->>'fase_anterior_ordem')::int
    )
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_marcar_retrocesso ON public.kanban_historico;
CREATE TRIGGER trg_marcar_retrocesso
  AFTER INSERT ON public.kanban_historico
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_marcar_retrocesso();

COMMENT ON FUNCTION public.fn_marcar_retrocesso() IS
  'Marca is_retrocesso=true quando fase_nova_ordem < fase_anterior_ordem no detalhe JSONB.';

-- ============================================================
-- PARTE 3 â€” Atualiza fn_historico_fase_alterada (migration 108)
--           para incluir fase_anterior_ordem e fase_nova_ordem no detalhe
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_historico_fase_alterada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ordem_antiga  INT;
  v_ordem_nova    INT;
  v_nome_antiga   TEXT;
  v_nome_nova     TEXT;
  v_acao          TEXT;
  v_user_id       UUID;
BEGIN
  IF OLD.fase_id IS NOT DISTINCT FROM NEW.fase_id THEN
    RETURN NEW;
  END IF;

  SELECT ordem, nome INTO v_ordem_antiga, v_nome_antiga
  FROM public.kanban_fases WHERE id = OLD.fase_id;

  SELECT ordem, nome INTO v_ordem_nova, v_nome_nova
  FROM public.kanban_fases WHERE id = NEW.fase_id;

  v_acao := CASE
    WHEN COALESCE(v_ordem_nova, 0) >= COALESCE(v_ordem_antiga, 0) THEN 'fase_avancada'
    ELSE 'fase_retrocedida'
  END;

  v_user_id := auth.uid();

  INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, detalhe)
  VALUES (
    NEW.id,
    v_user_id,
    public.fn_resolve_usuario_nome(v_user_id),
    v_acao,
    jsonb_build_object(
      'fase_anterior_id',     OLD.fase_id,
      'fase_anterior_nome',   COALESCE(v_nome_antiga, ''),
      'fase_anterior_ordem',  v_ordem_antiga,
      'fase_nova_id',         NEW.fase_id,
      'fase_nova_nome',       COALESCE(v_nome_nova, ''),
      'fase_nova_ordem',      v_ordem_nova
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'fn_historico_fase_alterada: erro ignorado â€” %', SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_historico_fase_alterada() IS
  'Registra fase_avancada ou fase_retrocedida ao mover card entre fases. '
  'detalhe inclui ids, nomes e ordens das fases anterior e nova (necessÃ¡rio para is_retrocesso).';

-- Backfill: marcar is_retrocesso em linhas histÃ³ricas que jÃ¡ tenham ordens no detalhe
UPDATE public.kanban_historico
SET is_retrocesso = (
  (detalhe->>'fase_nova_ordem')::int < (detalhe->>'fase_anterior_ordem')::int
)
WHERE acao IN ('fase_avancada', 'fase_retrocedida')
  AND (detalhe->>'fase_nova_ordem') IS NOT NULL
  AND (detalhe->>'fase_anterior_ordem') IS NOT NULL;

-- ============================================================
-- PARTE 4 â€” SLA acumulado por card
-- ============================================================

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS sla_dias_acumulados INTEGER DEFAULT 0;

COMMENT ON COLUMN public.kanban_cards.sla_dias_acumulados IS
  'Dias Ãºteis de SLA jÃ¡ consumidos antes do retrocesso de fase. '
  'Nunca Ã© zerado em retrocessos â€” preserva o tempo jÃ¡ gasto no processo.';
-- Cronologia do funil: registro de criaÃ§Ã£o no histÃ³rico + data de conclusÃ£o (Ãºltima fase).
-- card_criado alimenta o modal com fase inicial; concluido_em grava a primeira entrada na Ãºltima fase.

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS concluido_em TIMESTAMPTZ;

COMMENT ON COLUMN public.kanban_cards.concluido_em IS
  'Primeira vez em que o card entrou na Ãºltima fase do kanban (ordem mÃ¡xima). Preservado se o card voltar a fases anteriores.';

-- â”€â”€â”€ Log card_criado (histÃ³rico) ao inserir card nativo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE FUNCTION public.fn_kanban_card_criado_historico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome TEXT;
BEGIN
  SELECT nome INTO v_nome
  FROM public.kanban_fases
  WHERE id = NEW.fase_id
  LIMIT 1;

  INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, detalhe, criado_em)
  VALUES (
    NEW.id,
    COALESCE(auth.uid(), NEW.franqueado_id),
    public.fn_resolve_usuario_nome(COALESCE(auth.uid(), NEW.franqueado_id)),
    'card_criado',
    jsonb_build_object(
      'fase_id',       NEW.fase_id,
      'fase_nome',     COALESCE(v_nome, ''),
      'kanban_id',     NEW.kanban_id
    ),
    NEW.created_at
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'fn_kanban_card_criado_historico: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kanban_cards_criado_historico ON public.kanban_cards;
CREATE TRIGGER trg_kanban_cards_criado_historico
  AFTER INSERT ON public.kanban_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_kanban_card_criado_historico();

COMMENT ON FUNCTION public.fn_kanban_card_criado_historico() IS
  'Insere kanban_historico com acao card_criado (fase inicial) usando o timestamp de criaÃ§Ã£o do card.';

-- Backfill: cards sem linha card_criado
INSERT INTO public.kanban_historico (card_id, usuario_id, usuario_nome, acao, detalhe, criado_em)
SELECT
  kc.id,
  kc.franqueado_id,
  public.fn_resolve_usuario_nome(kc.franqueado_id),
  'card_criado',
  jsonb_build_object(
    'fase_id',   kc.fase_id,
    'fase_nome', COALESCE(kf.nome, ''),
    'kanban_id', kc.kanban_id
  ),
  kc.created_at
FROM public.kanban_cards kc
JOIN public.kanban_fases kf ON kf.id = kc.fase_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.kanban_historico h
  WHERE h.card_id = kc.id
    AND h.acao = 'card_criado'
);

-- â”€â”€â”€ concluido_em: primeira entrada na Ãºltima fase (por ordem) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE FUNCTION public.fn_kanban_cards_concluido_ultima_fase()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_max   INT;
  v_ordem INT;
BEGIN
  IF TG_OP <> 'UPDATE' OR OLD.fase_id IS NOT DISTINCT FROM NEW.fase_id THEN
    RETURN NEW;
  END IF;

  SELECT MAX(kf.ordem) INTO v_max
  FROM public.kanban_fases kf
  WHERE kf.kanban_id = NEW.kanban_id
    AND COALESCE(kf.ativo, true);

  SELECT kf.ordem INTO v_ordem
  FROM public.kanban_fases kf
  WHERE kf.id = NEW.fase_id
  LIMIT 1;

  IF v_ordem IS NOT NULL AND v_max IS NOT NULL AND v_ordem = v_max THEN
    IF NEW.concluido_em IS NULL THEN
      NEW.concluido_em := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kanban_cards_concluido_fase ON public.kanban_cards;
CREATE TRIGGER trg_kanban_cards_concluido_fase
  BEFORE UPDATE OF fase_id ON public.kanban_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_kanban_cards_concluido_ultima_fase();

COMMENT ON FUNCTION public.fn_kanban_cards_concluido_ultima_fase() IS
  'BEFORE UPDATE fase_id: na primeira entrada na fase de maior ordem do kanban, define concluido_em.';
-- FinalizaÃ§Ã£o explÃ­cita de card (aÃ§Ã£o finalizarCard) + colunas concluido / concluido_por.
-- Remove o trigger antigo que gravava concluido_em ao entrar na Ãºltima fase (125): concluido_em passa a ser sÃ³ da finalizaÃ§Ã£o.

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS concluido BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS concluido_por UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.kanban_cards.concluido IS 'Card finalizado pelo usuÃ¡rio (server action finalizarCard).';
COMMENT ON COLUMN public.kanban_cards.concluido_por IS 'UsuÃ¡rio que finalizou o card.';

COMMENT ON COLUMN public.kanban_cards.concluido_em IS
  'Timestamp definido em finalizarCard quando concluido = true.';

DROP TRIGGER IF EXISTS trg_kanban_cards_concluido_fase ON public.kanban_cards;
DROP FUNCTION IF EXISTS public.fn_kanban_cards_concluido_ultima_fase();

-- Limpa timestamps antigos gerados pelo trigger removido (card ainda nÃ£o finalizado)
UPDATE public.kanban_cards
SET concluido_em = NULL
WHERE concluido IS NOT TRUE;
-- Caminho do contrato de franquia (Storage bucket contratos-franquia).
ALTER TABLE public.rede_franqueados
  ADD COLUMN IF NOT EXISTS contrato_franquia_path TEXT;

COMMENT ON COLUMN public.rede_franqueados.contrato_franquia_path IS
  'Caminho no bucket contratos-franquia (ex.: {id}/arquivo.pdf).';

-- Bucket privado para anexos de contrato de franquia (modal Kanban).
INSERT INTO storage.buckets (id, name, public)
VALUES ('contratos-franquia', 'contratos-franquia', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "contratos_franquia_insert_auth" ON storage.objects;
CREATE POLICY "contratos_franquia_insert_auth"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contratos-franquia');

DROP POLICY IF EXISTS "contratos_franquia_select_auth" ON storage.objects;
CREATE POLICY "contratos_franquia_select_auth"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contratos-franquia');

DROP POLICY IF EXISTS "contratos_franquia_update_auth" ON storage.objects;
CREATE POLICY "contratos_franquia_update_auth"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'contratos-franquia');

DROP POLICY IF EXISTS "contratos_franquia_delete_auth" ON storage.objects;
CREATE POLICY "contratos_franquia_delete_auth"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'contratos-franquia');

-- Consultores podem atualizar processos da carteira (prÃ©-obra no modal Kanban).
DROP POLICY IF EXISTS "Consultor atualiza processos da carteira" ON public.processo_step_one;
CREATE POLICY "Consultor atualiza processos da carteira"
  ON public.processo_step_one FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = public.processo_step_one.user_id AND p.consultor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = public.processo_step_one.user_id AND p.consultor_id = auth.uid()
    )
  );

-- Consultores podem atualizar rede (ex.: caminho do contrato).
DROP POLICY IF EXISTS "rede_franqueados_update_consultor" ON public.rede_franqueados;
CREATE POLICY "rede_franqueados_update_consultor"
  ON public.rede_franqueados FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'consultor'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'consultor'));
-- Migration 128: Kanban "Funil Acoplamento" + 4 fases (idempotente).
-- Banco DEV: bgaadvfucnrkpimaszjv.supabase.co

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- PARTE 1 â€” Registrar o kanban
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
INSERT INTO public.kanbans (nome, descricao)
SELECT 'Funil Acoplamento', 'GestÃ£o do processo de acoplamento de terreno e casa'
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanbans WHERE nome = 'Funil Acoplamento'
);

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- PARTE 2 â€” Inserir as 4 fases
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo)
SELECT
  k.id,
  fase.nome,
  fase.slug,
  fase.ordem,
  7 AS sla_dias,
  true AS ativo
FROM public.kanbans k
CROSS JOIN (VALUES
  ('Modelagem do Terreno', 'modelagem_terreno', 1),
  ('Modelagem da Casa + GBox', 'modelagem_casa_gbox', 2),
  ('ValidaÃ§Ã£o do Acoplamento', 'validacao_acoplamento', 3),
  ('AlteraÃ§Ãµes do Acoplamento', 'alteracoes_acoplamento', 4)
) AS fase(nome, slug, ordem)
WHERE k.nome = 'Funil Acoplamento'
ON CONFLICT DO NOTHING;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- PARTE 3 â€” Garantir GRANTs
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
GRANT SELECT ON public.kanbans TO authenticated, anon;
GRANT SELECT ON public.kanban_fases TO authenticated, anon;
-- â”€â”€â”€ 129: InstruÃ§Ãµes e materiais em kanban_fases (modal kanban) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

ALTER TABLE public.kanban_fases
  ADD COLUMN IF NOT EXISTS instrucoes TEXT,
  ADD COLUMN IF NOT EXISTS materiais JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.kanban_fases.instrucoes IS
  'OrientaÃ§Ãµes da fase exibidas no KanbanCardModal.';
COMMENT ON COLUMN public.kanban_fases.materiais IS
  'JSON array: [{"titulo","url","tipo"}]; tipo: link | documento | video.';

-- ApÃ³s 099 (sÃ³ SELECT em kanban_fases): permitir UPDATE para admin/consultor.
DROP POLICY IF EXISTS "kanban_fases_update_admin_consultor" ON public.kanban_fases;
CREATE POLICY "kanban_fases_update_admin_consultor"
  ON public.kanban_fases
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );
-- â”€â”€â”€ 130: VÃ­nculos entre cards nativos (relacionamentos no modal) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS public.kanban_card_vinculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_origem_id UUID NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  card_destino_id UUID NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  tipo_vinculo TEXT NOT NULL DEFAULT 'relacionado'
    CHECK (tipo_vinculo IN ('relacionado', 'depende_de', 'bloqueia')),
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(card_origem_id, card_destino_id),
  CHECK (card_origem_id <> card_destino_id)
);

CREATE INDEX IF NOT EXISTS idx_kanban_card_vinculos_origem
  ON public.kanban_card_vinculos(card_origem_id);
CREATE INDEX IF NOT EXISTS idx_kanban_card_vinculos_destino
  ON public.kanban_card_vinculos(card_destino_id);

COMMENT ON TABLE public.kanban_card_vinculos IS
  'Relacionamentos entre cards: origem â†’ destino conforme tipo_vinculo.';

ALTER TABLE public.kanban_card_vinculos ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuÃ¡rio autenticado (card visÃ­vel no modal jÃ¡ passou RLS do card).
DROP POLICY IF EXISTS "kanban_card_vinculos_select_auth" ON public.kanban_card_vinculos;
CREATE POLICY "kanban_card_vinculos_select_auth"
  ON public.kanban_card_vinculos
  FOR SELECT
  TO authenticated
  USING (true);

-- Escrita: admin e consultor (alinhado a outras tabelas de configuraÃ§Ã£o do kanban).
DROP POLICY IF EXISTS "kanban_card_vinculos_insert_admin" ON public.kanban_card_vinculos;
CREATE POLICY "kanban_card_vinculos_insert_admin"
  ON public.kanban_card_vinculos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

DROP POLICY IF EXISTS "kanban_card_vinculos_delete_admin" ON public.kanban_card_vinculos;
CREATE POLICY "kanban_card_vinculos_delete_admin"
  ON public.kanban_card_vinculos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

GRANT SELECT ON public.kanban_card_vinculos TO authenticated;
GRANT INSERT, DELETE ON public.kanban_card_vinculos TO authenticated;
-- â”€â”€â”€ 131: Convites Portal Frank (link 7 dias) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS public.convites_frank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE DEFAULT (gen_random_uuid()::text),
  email TEXT,
  franqueado_id UUID REFERENCES public.rede_franqueados(id) ON DELETE SET NULL,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expira_em TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  usado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_convites_frank_token ON public.convites_frank(token);
CREATE INDEX IF NOT EXISTS idx_convites_frank_expira ON public.convites_frank(expira_em);

COMMENT ON TABLE public.convites_frank IS
  'Convite por link para cadastro no portal do franqueado (7 dias). Leitura/aceite via service role nas routes.';

ALTER TABLE public.convites_frank ENABLE ROW LEVEL SECURITY;

-- Apenas admin/consultor gerencia convites autenticados.
DROP POLICY IF EXISTS "convites_frank_select_admin" ON public.convites_frank;
CREATE POLICY "convites_frank_select_admin"
  ON public.convites_frank FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

DROP POLICY IF EXISTS "convites_frank_insert_admin" ON public.convites_frank;
CREATE POLICY "convites_frank_insert_admin"
  ON public.convites_frank FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

DROP POLICY IF EXISTS "convites_frank_update_admin" ON public.convites_frank;
CREATE POLICY "convites_frank_update_admin"
  ON public.convites_frank FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'consultor')
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.convites_frank TO authenticated;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cargo TEXT
  CHECK (cargo IN ('adm', 'analista', 'estagiario'));

COMMENT ON COLUMN public.profiles.cargo IS
  'Cargo dentro do grupo: adm, analista ou estagiario';

UPDATE public.profiles
SET role = 'team'
WHERE role = 'consultor';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'team', 'frank', 'parceiro', 'fornecedor', 'cliente'));

DO $$
DECLARE
  r       RECORD;
  v_qual  TEXT;
  v_check TEXT;
  v_sql   TEXT;
BEGIN
  FOR r IN
    SELECT
      n.nspname AS schemaname,
      c.relname AS tablename,
      p.polname AS policyname,
      CASE p.polpermissive WHEN true THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END AS permissive,
      CASE p.polcmd
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
        ELSE 'ALL'
      END AS cmd,
      pg_get_expr(p.polqual,      p.polrelid) AS qual,
      pg_get_expr(p.polwithcheck, p.polrelid) AS with_check
    FROM pg_policy p
    JOIN pg_class     c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND (
        pg_get_expr(p.polqual,      p.polrelid) LIKE '%consultor%'
        OR pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%consultor%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename);

    v_qual  := replace(
                 replace(r.qual,  '''consultor''::text', '''team'''),
                 '''consultor''', '''team''');
    v_check := replace(
                 replace(r.with_check, '''consultor''::text', '''team'''),
                 '''consultor''', '''team''');

    v_sql := format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO authenticated',
      r.policyname, r.schemaname, r.tablename, r.permissive, r.cmd);

    IF v_qual IS NOT NULL THEN
      v_sql := v_sql || ' USING (' || v_qual || ')';
    END IF;
    IF v_check IS NOT NULL THEN
      v_sql := v_sql || ' WITH CHECK (' || v_check || ')';
    END IF;

    EXECUTE v_sql;
    RAISE NOTICE 'Policy atualizada: % em %.%', r.policyname, r.schemaname, r.tablename;
  END LOOP;
END;
$$;

GRANT SELECT ON public.profiles TO authenticated, anon;
CREATE TABLE IF NOT EXISTS public.permissoes_perfil (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role       TEXT NOT NULL,
  cargo      TEXT NOT NULL,
  permissao  TEXT NOT NULL,
  valor      BOOLEAN DEFAULT true,
  criado_em  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role, cargo, permissao)
);

COMMENT ON TABLE public.permissoes_perfil IS
  'Matriz de permissÃµes por role + cargo. Lida pelo frontend para controlar acesso a aÃ§Ãµes.';

ALTER TABLE public.permissoes_perfil ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permissoes_perfil_select_auth" ON public.permissoes_perfil;
CREATE POLICY "permissoes_perfil_select_auth"
  ON public.permissoes_perfil FOR SELECT TO authenticated
  USING (true);

INSERT INTO public.permissoes_perfil (role, cargo, permissao, valor) VALUES
-- â”€â”€ Admin / adm â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
('admin', 'adm', 'criar_cards',        true),
('admin', 'adm', 'mover_fase',         true),
('admin', 'adm', 'arquivar_cards',     true),
('admin', 'adm', 'finalizar_cards',    true),
('admin', 'adm', 'criar_chamados',     true),
('admin', 'adm', 'ver_sirene',         true),
('admin', 'adm', 'ver_dashboard',      true),
('admin', 'adm', 'configurar_sla',     true),
('admin', 'adm', 'convidar_usuarios',  true),
('admin', 'adm', 'editar_instrucoes',  true),
('admin', 'adm', 'vincular_cards',     true),
-- â”€â”€ Admin / analista â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
('admin', 'analista', 'criar_cards',        true),
('admin', 'analista', 'mover_fase',         true),
('admin', 'analista', 'arquivar_cards',     true),
('admin', 'analista', 'finalizar_cards',    true),
('admin', 'analista', 'criar_chamados',     true),
('admin', 'analista', 'ver_sirene',         true),
('admin', 'analista', 'ver_dashboard',      true),
('admin', 'analista', 'configurar_sla',     false),
('admin', 'analista', 'convidar_usuarios',  false),
('admin', 'analista', 'editar_instrucoes',  true),
('admin', 'analista', 'vincular_cards',     true),
-- â”€â”€ Admin / estagiario â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
('admin', 'estagiario', 'criar_cards',        false),
('admin', 'estagiario', 'mover_fase',         false),
('admin', 'estagiario', 'arquivar_cards',     false),
('admin', 'estagiario', 'finalizar_cards',    false),
('admin', 'estagiario', 'criar_chamados',     true),
('admin', 'estagiario', 'ver_sirene',         true),
('admin', 'estagiario', 'ver_dashboard',      true),
('admin', 'estagiario', 'configurar_sla',     false),
('admin', 'estagiario', 'convidar_usuarios',  false),
('admin', 'estagiario', 'editar_instrucoes',  false),
('admin', 'estagiario', 'vincular_cards',     false),
-- â”€â”€ Team / adm â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
('team', 'adm', 'criar_cards',        true),
('team', 'adm', 'mover_fase',         true),
('team', 'adm', 'arquivar_cards',     true),
('team', 'adm', 'finalizar_cards',    true),
('team', 'adm', 'criar_chamados',     true),
('team', 'adm', 'ver_sirene',         true),
('team', 'adm', 'ver_dashboard',      true),
('team', 'adm', 'configurar_sla',     true),
('team', 'adm', 'convidar_usuarios',  true),
('team', 'adm', 'editar_instrucoes',  true),
('team', 'adm', 'vincular_cards',     true),
-- â”€â”€ Team / analista â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
('team', 'analista', 'criar_cards',        true),
('team', 'analista', 'mover_fase',         true),
('team', 'analista', 'arquivar_cards',     false),
('team', 'analista', 'finalizar_cards',    false),
('team', 'analista', 'criar_chamados',     true),
('team', 'analista', 'ver_sirene',         true),
('team', 'analista', 'ver_dashboard',      true),
('team', 'analista', 'configurar_sla',     false),
('team', 'analista', 'convidar_usuarios',  false),
('team', 'analista', 'editar_instrucoes',  true),
('team', 'analista', 'vincular_cards',     true),
-- â”€â”€ Team / estagiario â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
('team', 'estagiario', 'criar_cards',        false),
('team', 'estagiario', 'mover_fase',         false),
('team', 'estagiario', 'arquivar_cards',     false),
('team', 'estagiario', 'finalizar_cards',    false),
('team', 'estagiario', 'criar_chamados',     true),
('team', 'estagiario', 'ver_sirene',         true),
('team', 'estagiario', 'ver_dashboard',      false),
('team', 'estagiario', 'configurar_sla',     false),
('team', 'estagiario', 'convidar_usuarios',  false),
('team', 'estagiario', 'editar_instrucoes',  false),
('team', 'estagiario', 'vincular_cards',     false),
-- â”€â”€ Frank / adm â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
('frank', 'adm', 'criar_chamados',  true),
('frank', 'adm', 'ver_dashboard',   true),
('frank', 'adm', 'criar_cards',     false),
('frank', 'adm', 'mover_fase',      false),
('frank', 'adm', 'arquivar_cards',  false),
('frank', 'adm', 'finalizar_cards', false),
('frank', 'adm', 'ver_sirene',      false),
-- â”€â”€ Frank / analista â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
('frank', 'analista', 'criar_chamados',  true),
('frank', 'analista', 'ver_dashboard',   false),
('frank', 'analista', 'criar_cards',     false),
('frank', 'analista', 'mover_fase',      false),
('frank', 'analista', 'arquivar_cards',  false),
('frank', 'analista', 'finalizar_cards', false),
('frank', 'analista', 'ver_sirene',      false),
-- â”€â”€ Frank / estagiario â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
('frank', 'estagiario', 'criar_chamados', false),
('frank', 'estagiario', 'ver_dashboard',  false),
-- â”€â”€ Parceiro â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
('parceiro', 'adm',       'criar_chamados', true),
('parceiro', 'analista',  'criar_chamados', true),
('parceiro', 'estagiario','criar_chamados', false),
-- â”€â”€ Fornecedor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
('fornecedor', 'adm',       'criar_chamados', true),
('fornecedor', 'analista',  'criar_chamados', true),
('fornecedor', 'estagiario','criar_chamados', false)
ON CONFLICT (role, cargo, permissao) DO NOTHING;

GRANT SELECT ON public.permissoes_perfil TO authenticated, anon;
-- Kanbans permitidos (Time + EstagiÃ¡rio): valores = public.kanbans.nome
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS funis_acesso TEXT[] DEFAULT NULL;

COMMENT ON COLUMN public.profiles.funis_acesso IS
  'Lista de kanbans.nome acessÃ­veis; usado para Time + estagiÃ¡rio. NULL = nÃ£o aplicÃ¡vel ou sem restriÃ§Ã£o por esta lista.';
-- ValidaÃ§Ã£o trimestral de dados (Frank) + vÃ­nculo perfil â†” rede_franqueados + RLS

-- â”€â”€â”€ 1. Tabela de validaÃ§Ãµes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.frank_validacoes_dados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  frank_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  periodo TEXT NOT NULL,
  validado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (frank_id, periodo)
);

COMMENT ON TABLE public.frank_validacoes_dados IS
  'ConfirmaÃ§Ã£o trimestral de dados do franqueado (periodo ex.: 2026-01, 2026-04, 2026-07, 2026-11).';

CREATE INDEX IF NOT EXISTS idx_frank_validacoes_frank ON public.frank_validacoes_dados (frank_id);
CREATE INDEX IF NOT EXISTS idx_frank_validacoes_periodo ON public.frank_validacoes_dados (periodo);

ALTER TABLE public.frank_validacoes_dados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "frank_validacoes_select_own" ON public.frank_validacoes_dados;
CREATE POLICY "frank_validacoes_select_own"
  ON public.frank_validacoes_dados FOR SELECT TO authenticated
  USING (frank_id = auth.uid());

DROP POLICY IF EXISTS "frank_validacoes_insert_own" ON public.frank_validacoes_dados;
CREATE POLICY "frank_validacoes_insert_own"
  ON public.frank_validacoes_dados FOR INSERT TO authenticated
  WITH CHECK (frank_id = auth.uid());

DROP POLICY IF EXISTS "frank_validacoes_update_own" ON public.frank_validacoes_dados;
CREATE POLICY "frank_validacoes_update_own"
  ON public.frank_validacoes_dados FOR UPDATE TO authenticated
  USING (frank_id = auth.uid())
  WITH CHECK (frank_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.frank_validacoes_dados TO authenticated;

-- â”€â”€â”€ 2. Perfil â†’ linha da rede (cadastro portal) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rede_franqueado_id UUID REFERENCES public.rede_franqueados(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.rede_franqueado_id IS
  'Linha em rede_franqueados associada ao franqueado (portal).';

CREATE INDEX IF NOT EXISTS idx_profiles_rede_franqueado_id ON public.profiles (rede_franqueado_id);

-- â”€â”€â”€ 3. Frank pode atualizar a prÃ³pria linha na rede â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DROP POLICY IF EXISTS "rede_franqueados_update_frank_own" ON public.rede_franqueados;
CREATE POLICY "rede_franqueados_update_frank_own"
  ON public.rede_franqueados FOR UPDATE TO authenticated
  USING (
    id IN (
      SELECT p.rede_franqueado_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.rede_franqueado_id IS NOT NULL
    )
  )
  WITH CHECK (
    id IN (
      SELECT p.rede_franqueado_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.rede_franqueado_id IS NOT NULL
    )
  );

-- â”€â”€â”€ 4. Convites Frank: admin ou time (legado consultor â†’ team na 132) â”€â”€â”€â”€â”€â”€â”€
DROP POLICY IF EXISTS "convites_frank_select_admin" ON public.convites_frank;
CREATE POLICY "convites_frank_select_admin"
  ON public.convites_frank FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'team', 'consultor')
    )
  );

DROP POLICY IF EXISTS "convites_frank_insert_admin" ON public.convites_frank;
CREATE POLICY "convites_frank_insert_admin"
  ON public.convites_frank FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'team', 'consultor')
    )
  );

DROP POLICY IF EXISTS "convites_frank_update_admin" ON public.convites_frank;
CREATE POLICY "convites_frank_update_admin"
  ON public.convites_frank FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'team', 'consultor')
    )
  );
ALTER TABLE public.rede_franqueados
  DROP COLUMN IF EXISTS data_kit_boas_vindas;
-- PARTE 1: Buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('chamados-attachments', 'chamados-attachments', false, 10485760, null),
  ('subchamados-attachments', 'subchamados-attachments', false, 10485760, null),
  ('rede-attachments', 'rede-attachments', false, 10485760, null)
ON CONFLICT (id) DO NOTHING;

-- PARTE 2: Anexos de chamados
CREATE TABLE IF NOT EXISTS public.chamado_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id UUID NOT NULL REFERENCES public.kanban_atividades(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  nome_original TEXT NOT NULL,
  tamanho INTEGER,
  tipo_mime TEXT,
  uploader_id UUID REFERENCES auth.users(id),
  uploader_nome TEXT,
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chamado_anexos_chamado
  ON public.chamado_anexos(chamado_id);

ALTER TABLE public.chamado_anexos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chamado_anexos_select" ON public.chamado_anexos;
CREATE POLICY "chamado_anexos_select" ON public.chamado_anexos
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'team'))
    OR uploader_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.kanban_atividades a
      WHERE a.id = chamado_id AND auth.uid() = ANY(COALESCE(a.responsaveis_ids, '{}'))
    )
  );

DROP POLICY IF EXISTS "chamado_anexos_insert" ON public.chamado_anexos;
CREATE POLICY "chamado_anexos_insert" ON public.chamado_anexos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "chamado_anexos_delete" ON public.chamado_anexos;
CREATE POLICY "chamado_anexos_delete" ON public.chamado_anexos
  FOR DELETE TO authenticated USING (
    uploader_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'team'))
  );

-- PARTE 3: Anexos de sub-chamados
CREATE TABLE IF NOT EXISTS public.subchamado_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subchamado_id BIGINT NOT NULL REFERENCES public.sirene_topicos(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  nome_original TEXT NOT NULL,
  tamanho INTEGER,
  tipo_mime TEXT,
  uploader_id UUID REFERENCES auth.users(id),
  uploader_nome TEXT,
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subchamado_anexos_subchamado
  ON public.subchamado_anexos(subchamado_id);

ALTER TABLE public.subchamado_anexos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subchamado_anexos_select" ON public.subchamado_anexos;
CREATE POLICY "subchamado_anexos_select" ON public.subchamado_anexos
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "subchamado_anexos_insert" ON public.subchamado_anexos;
CREATE POLICY "subchamado_anexos_insert" ON public.subchamado_anexos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "subchamado_anexos_delete" ON public.subchamado_anexos;
CREATE POLICY "subchamado_anexos_delete" ON public.subchamado_anexos
  FOR DELETE TO authenticated USING (
    uploader_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'team'))
  );

-- PARTE 4: Colunas de anexos na rede de franqueados
ALTER TABLE public.rede_franqueados
  ADD COLUMN IF NOT EXISTS anexo_cof_path TEXT,
  ADD COLUMN IF NOT EXISTS anexo_contrato_path TEXT;

COMMENT ON COLUMN public.rede_franqueados.anexo_cof_path IS
  'Caminho no bucket rede-attachments para o COF assinado';
COMMENT ON COLUMN public.rede_franqueados.anexo_contrato_path IS
  'Caminho no bucket rede-attachments para o Contrato assinado';

-- PARTE 5: Policies do storage
DROP POLICY IF EXISTS "chamados_attachments_select" ON storage.objects;
CREATE POLICY "chamados_attachments_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chamados-attachments');

DROP POLICY IF EXISTS "chamados_attachments_insert" ON storage.objects;
CREATE POLICY "chamados_attachments_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chamados-attachments');

DROP POLICY IF EXISTS "chamados_attachments_delete" ON storage.objects;
CREATE POLICY "chamados_attachments_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'chamados-attachments');

DROP POLICY IF EXISTS "subchamados_attachments_all" ON storage.objects;
CREATE POLICY "subchamados_attachments_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'subchamados-attachments')
  WITH CHECK (bucket_id = 'subchamados-attachments');

DROP POLICY IF EXISTS "rede_attachments_select" ON storage.objects;
CREATE POLICY "rede_attachments_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'rede-attachments');

DROP POLICY IF EXISTS "rede_attachments_insert" ON storage.objects;
CREATE POLICY "rede_attachments_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'rede-attachments'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'team'))
  );

DROP POLICY IF EXISTS "rede_attachments_delete" ON storage.objects;
CREATE POLICY "rede_attachments_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'rede-attachments'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'team'))
  );
-- Frank / criador do chamado: ver anexos e inserir sÃ³ nos chamados que criou (ou admin/team/responsÃ¡vel).

DROP POLICY IF EXISTS "chamado_anexos_select" ON public.chamado_anexos;
CREATE POLICY "chamado_anexos_select" ON public.chamado_anexos
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'team'))
    OR uploader_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.kanban_atividades a
      WHERE a.id = chamado_id AND auth.uid() = ANY(COALESCE(a.responsaveis_ids, '{}'))
    )
    OR EXISTS (
      SELECT 1 FROM public.kanban_atividades a
      WHERE a.id = chamado_id AND a.criado_por = auth.uid()
    )
  );

DROP POLICY IF EXISTS "chamado_anexos_insert" ON public.chamado_anexos;
CREATE POLICY "chamado_anexos_insert" ON public.chamado_anexos
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'team'))
    OR EXISTS (
      SELECT 1 FROM public.kanban_atividades a
      WHERE a.id = chamado_id
        AND (
          a.criado_por = auth.uid()
          OR auth.uid() = ANY(COALESCE(a.responsaveis_ids, '{}'))
        )
    )
  );
-- Documentos sensÃ­veis da rede: sÃ³ admin/team leem no storage (Frank autenticado nÃ£o baixa).

DROP POLICY IF EXISTS "rede_attachments_select" ON storage.objects;
CREATE POLICY "rede_attachments_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'rede-attachments'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'team', 'consultor')
    )
  );
-- Time interno pode atualizar linhas da rede (ex.: anexos COF / contrato assinado).

DROP POLICY IF EXISTS "rede_franqueados_update_team" ON public.rede_franqueados;
CREATE POLICY "rede_franqueados_update_team"
  ON public.rede_franqueados FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'team'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'team'));
-- Consultores tambÃ©m enviam documentos da rede (alinha ao UPDATE em rede_franqueados).

DROP POLICY IF EXISTS "rede_attachments_insert" ON storage.objects;
CREATE POLICY "rede_attachments_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'rede-attachments'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'team', 'consultor')
    )
  );

DROP POLICY IF EXISTS "rede_attachments_delete" ON storage.objects;
CREATE POLICY "rede_attachments_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'rede-attachments'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'team', 'consultor')
    )
  );
-- Tabela de menÃ§Ãµes vinculadas a comentÃ¡rios do Sirene
CREATE TABLE chamado_mencoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comentario_id BIGINT NOT NULL REFERENCES sirene_mensagens(id) ON DELETE CASCADE,
  mencionado_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chamado_id BIGINT NOT NULL REFERENCES sirene_chamados(id) ON DELETE CASCADE,
  lido BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE chamado_mencoes ENABLE ROW LEVEL SECURITY;

-- UsuÃ¡rio vÃª sÃ³ as prÃ³prias menÃ§Ãµes
DROP POLICY IF EXISTS "mencoes_select_proprio" ON chamado_mencoes;
CREATE POLICY "mencoes_select_proprio" ON chamado_mencoes
  FOR SELECT USING (mencionado_id = auth.uid());

-- Apenas autenticados inserem (Frank bloqueado via app, nÃ£o via RLS)
DROP POLICY IF EXISTS "mencoes_insert_autenticado" ON chamado_mencoes;
CREATE POLICY "mencoes_insert_autenticado" ON chamado_mencoes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Marcar como lido
DROP POLICY IF EXISTS "mencoes_update_proprio" ON chamado_mencoes;
CREATE POLICY "mencoes_update_proprio" ON chamado_mencoes
  FOR UPDATE USING (mencionado_id = auth.uid());

-- Ãndices
CREATE INDEX idx_mencoes_mencionado ON chamado_mencoes(mencionado_id);
CREATE INDEX idx_mencoes_comentario ON chamado_mencoes(comentario_id);
-- Estrutura padronizada para avisos (ex.: menÃ§Ã£o em comentÃ¡rio de chamado)
ALTER TABLE public.sirene_notificacoes
  ADD COLUMN IF NOT EXISTS titulo TEXT,
  ADD COLUMN IF NOT EXISTS mensagem TEXT,
  ADD COLUMN IF NOT EXISTS referencia_id BIGINT REFERENCES public.sirene_chamados(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.sirene_notificacoes.titulo IS 'TÃ­tulo curto do aviso (UI).';
COMMENT ON COLUMN public.sirene_notificacoes.mensagem IS 'Corpo do aviso; preferir este campo em novos tipos.';
COMMENT ON COLUMN public.sirene_notificacoes.referencia_id IS 'ReferÃªncia principal (ex.: id do chamado Sirene).';

CREATE INDEX IF NOT EXISTS idx_sirene_notificacoes_referencia
  ON public.sirene_notificacoes (referencia_id);
-- Checklist por card do kanban com visibilidade por responsÃ¡vel (Frank vÃª sÃ³ os prÃ³prios)

CREATE TABLE IF NOT EXISTS public.kanban_checklist_itens (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id       UUID        NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  texto         TEXT        NOT NULL,
  feito         BOOLEAN     NOT NULL DEFAULT FALSE,
  responsavel_id UUID       REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_por    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kanban_checklist_card       ON public.kanban_checklist_itens (card_id);
CREATE INDEX IF NOT EXISTS idx_kanban_checklist_responsavel ON public.kanban_checklist_itens (responsavel_id);

COMMENT ON TABLE public.kanban_checklist_itens IS
  'Itens de checklist por card do kanban; frank vÃª somente os itens em que Ã© responsÃ¡vel (RLS).';

ALTER TABLE public.kanban_checklist_itens ENABLE ROW LEVEL SECURITY;

-- Internos (nÃ£o frank/franqueado) veem todos os itens do card
DROP POLICY IF EXISTS "checklist_select_interno" ON public.kanban_checklist_itens;
CREATE POLICY "checklist_select_interno" ON public.kanban_checklist_itens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role NOT IN ('frank', 'franqueado')
    )
  );

-- Frank/franqueado vÃª somente os itens onde Ã© o responsÃ¡vel
DROP POLICY IF EXISTS "checklist_select_frank" ON public.kanban_checklist_itens;
CREATE POLICY "checklist_select_frank" ON public.kanban_checklist_itens
  FOR SELECT USING (responsavel_id = auth.uid());

-- Apenas internos criam itens
DROP POLICY IF EXISTS "checklist_insert_interno" ON public.kanban_checklist_itens;
CREATE POLICY "checklist_insert_interno" ON public.kanban_checklist_itens
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role NOT IN ('frank', 'franqueado')
    )
  );

-- Marcar feito: o prÃ³prio responsÃ¡vel OU um interno
DROP POLICY IF EXISTS "checklist_update" ON public.kanban_checklist_itens;
CREATE POLICY "checklist_update" ON public.kanban_checklist_itens
  FOR UPDATE USING (
    responsavel_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role NOT IN ('frank', 'franqueado')
    )
  );

-- Apenas internos deletam
DROP POLICY IF EXISTS "checklist_delete_interno" ON public.kanban_checklist_itens;
CREATE POLICY "checklist_delete_interno" ON public.kanban_checklist_itens
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role NOT IN ('frank', 'franqueado')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_checklist_itens TO authenticated;
CREATE TABLE IF NOT EXISTS public.kanban_aprovacoes_fase (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id        UUID        NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  solicitado_por UUID        NOT NULL REFERENCES auth.users(id),
  fase_destino   TEXT        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'pendente'
                             CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  aprovado_por   UUID        REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kanban_aprovacoes_card   ON public.kanban_aprovacoes_fase (card_id);
CREATE INDEX IF NOT EXISTS idx_kanban_aprovacoes_status ON public.kanban_aprovacoes_fase (status);

ALTER TABLE public.kanban_aprovacoes_fase ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aprovacoes_select" ON public.kanban_aprovacoes_fase;
CREATE POLICY "aprovacoes_select" ON public.kanban_aprovacoes_fase
  FOR SELECT USING (
    solicitado_por = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.sirene_papeis
      WHERE user_id = auth.uid() AND papel = 'bombeiro'
    )
  );

DROP POLICY IF EXISTS "aprovacoes_insert" ON public.kanban_aprovacoes_fase;
CREATE POLICY "aprovacoes_insert" ON public.kanban_aprovacoes_fase
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "aprovacoes_update_bombeiro" ON public.kanban_aprovacoes_fase;
CREATE POLICY "aprovacoes_update_bombeiro" ON public.kanban_aprovacoes_fase
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.sirene_papeis
      WHERE user_id = auth.uid() AND papel = 'bombeiro'
    )
  );
-- Chamados internos vs visÃ­veis para Frank/franqueado (RLS SELECT).
-- Internos: visivel_frank = FALSE (default). Abertos pelo prÃ³prio Frank/franqueado: TRUE.

ALTER TABLE public.sirene_chamados
  ADD COLUMN IF NOT EXISTS visivel_frank BOOLEAN NOT NULL DEFAULT FALSE;

-- Retroativo: quem abriu tem role frank ou franqueado
UPDATE public.sirene_chamados sc
SET visivel_frank = TRUE
FROM public.profiles p
WHERE p.id = sc.aberto_por
  AND p.role IN ('frank', 'franqueado');

CREATE INDEX IF NOT EXISTS idx_sirene_chamados_visivel_frank
  ON public.sirene_chamados (visivel_frank)
  WHERE visivel_frank = TRUE;

-- Substitui a policy de 037: internos veem tudo; Frank/franqueado sÃ³ linhas visivel_frank.
-- MantÃ©m sirene_chamados_hdm_team_select (035) como OR adicional para times HDM.
DROP POLICY IF EXISTS "sirene_chamados_select" ON public.sirene_chamados;
CREATE POLICY "sirene_chamados_select"
  ON public.sirene_chamados FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role NOT IN ('frank', 'franqueado')
    )
    OR (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role IN ('frank', 'franqueado')
      )
      AND visivel_frank = TRUE
    )
  );
-- 1) ReferÃªncia a card de kanban em notificaÃ§Ãµes.
--    `referencia_id` (BIGINT) continua a apontar para `sirene_chamados`; para cards usa-se UUID aqui.
ALTER TABLE public.sirene_notificacoes
  ADD COLUMN IF NOT EXISTS referencia_card_id UUID REFERENCES public.kanban_cards(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sirene_notificacoes_referencia_card
  ON public.sirene_notificacoes (referencia_card_id);

COMMENT ON COLUMN public.sirene_notificacoes.referencia_card_id IS
  'Card de kanban (ex.: rejeiÃ§Ã£o de aprovaÃ§Ã£o de fase). O pedido "referencia_id" para UUID usa esta coluna.';

-- 2) Bombeiro: ler cards com aprovaÃ§Ã£o de fase pendente
DROP POLICY IF EXISTS "kanban_cards_select_bombeiro_aprov" ON public.kanban_cards;
CREATE POLICY "kanban_cards_select_bombeiro_aprov" ON public.kanban_cards
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.sirene_papeis sp WHERE sp.user_id = auth.uid() AND sp.papel = 'bombeiro')
    AND EXISTS (
      SELECT 1 FROM public.kanban_aprovacoes_fase a
      WHERE a.card_id = kanban_cards.id
        AND a.status = 'pendente'
    )
  );

-- 3) Bombeiro: ver nome do Frank que solicitou a aprovaÃ§Ã£o
DROP POLICY IF EXISTS "profiles_select_bombeiro_aprov" ON public.profiles;
CREATE POLICY "profiles_select_bombeiro_aprov" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.sirene_papeis sp WHERE sp.user_id = auth.uid() AND sp.papel = 'bombeiro')
    AND EXISTS (
      SELECT 1 FROM public.kanban_aprovacoes_fase a
      WHERE a.solicitado_por = profiles.id
        AND a.status = 'pendente'
    )
  );

-- 4) Bombeiro: itens de checklist (contagem) para cards com aprovaÃ§Ã£o pendente
DROP POLICY IF EXISTS "checklist_select_bombeiro_aprov" ON public.kanban_checklist_itens;
CREATE POLICY "checklist_select_bombeiro_aprov" ON public.kanban_checklist_itens
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.sirene_papeis sp WHERE sp.user_id = auth.uid() AND sp.papel = 'bombeiro')
    AND EXISTS (
      SELECT 1 FROM public.kanban_aprovacoes_fase a
      WHERE a.card_id = kanban_checklist_itens.card_id
        AND a.status = 'pendente'
    )
  );
-- Funil Step One: nova fase "Dados do Candidato" antes de "Dados da Cidade".
-- Idempotente:
--   - Se jÃ¡ existir "Dados do Candidato", nÃ£o altera nada.
--   - Se existir o nome antigo de teste "DescriÃ§Ã£o do Candidato", renomeia para "Dados do Candidato" e ajusta o slug.
--   - Caso contrÃ¡rio: incrementa ordem das fases ativas e insere a nova fase em ordem 1.

DO $$
DECLARE
  v_kanban_id UUID;
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE nome = 'Funil Step One'
    AND ativo = true
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '148_stepone_fase_dados_candidato: kanban Funil Step One nÃ£o encontrado; pulando.';
  ELSIF EXISTS (
    SELECT 1
    FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id
      AND nome = 'Dados do Candidato'
  ) THEN
    RAISE NOTICE '148_stepone_fase_dados_candidato: fase jÃ¡ existe; pulando.';
  ELSIF EXISTS (
    SELECT 1
    FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id
      AND nome = 'DescriÃ§Ã£o do Candidato'
  ) THEN
    UPDATE public.kanban_fases
    SET
      nome = 'Dados do Candidato',
      slug = 'stepone_dados_candidato'
    WHERE kanban_id = v_kanban_id
      AND nome = 'DescriÃ§Ã£o do Candidato';
  ELSE
    UPDATE public.kanban_fases
    SET ordem = ordem + 1
    WHERE kanban_id = v_kanban_id
      AND ativo = true;

    INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo)
    VALUES (
      v_kanban_id,
      'Dados do Candidato',
      'stepone_dados_candidato',
      1,
      7,
      true
    );
  END IF;
END;
$$;

-- Cards automÃ¡ticos ao inserir franqueado: primeira fase ativa (menor ordem).
CREATE OR REPLACE FUNCTION public.fn_criar_card_funil_ao_inserir_franqueado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kanban_id  UUID;
  v_fase_id    UUID;
  v_titulo     TEXT;
  v_user_id    UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_kanban_id
  FROM public.kanbans
  WHERE nome = 'Funil Step One'
    AND ativo = true
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_fase_id
  FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id
    AND ativo = true
  ORDER BY ordem ASC
  LIMIT 1;

  IF v_fase_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_titulo := CONCAT_WS(
    ' - ',
    NULLIF(TRIM(COALESCE(NEW.n_franquia,        '')), ''),
    NULLIF(TRIM(COALESCE(NEW.cidade_casa_frank,  '')), ''),
    NULLIF(TRIM(COALESCE(NEW.area_atuacao,       '')), '')
  );

  IF v_titulo IS NULL OR v_titulo = '' THEN
    v_titulo := 'Novo Franqueado';
  END IF;

  INSERT INTO public.kanban_cards (kanban_id, fase_id, franqueado_id, titulo, status)
  VALUES (v_kanban_id, v_fase_id, v_user_id, v_titulo, 'ativo');

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'fn_criar_card_funil_ao_inserir_franqueado: erro ignorado â€” %', SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_criar_card_funil_ao_inserir_franqueado() IS
  'Cria automaticamente um card no kanban "Funil Step One" na primeira fase ativa (menor ordem) '
  'sempre que um novo franqueado Ã© inserido em rede_franqueados. '
  'TÃ­tulo: n_franquia - cidade_casa_frank - area_atuacao. '
  'Sem auth.uid() (backend/service role) ou sem kanban/fase cadastrado, pula silenciosamente.';
-- 149: Checklist estrutural por fase (itens configurÃ¡veis) + respostas por card
--      + bucket de templates + seed da fase "Dados do Candidato"

-- â”€â”€â”€ Itens de checklist por fase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE public.kanban_fase_checklist_itens (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  fase_id               UUID        NOT NULL REFERENCES public.kanban_fases(id) ON DELETE CASCADE,
  ordem                 INTEGER     NOT NULL DEFAULT 0,
  label                 TEXT        NOT NULL,
  tipo                  TEXT        NOT NULL DEFAULT 'texto_curto'
    CHECK (tipo IN (
      'texto_curto','texto_longo','email','telefone',
      'numero','anexo','anexo_template','checkbox'
    )),
  obrigatorio           BOOLEAN     DEFAULT TRUE,
  visivel_candidato     BOOLEAN     DEFAULT TRUE,
  template_storage_path TEXT,
  placeholder           TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fase_checklist_itens_fase ON public.kanban_fase_checklist_itens(fase_id);

ALTER TABLE public.kanban_fase_checklist_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fase_checklist_select_interno" ON public.kanban_fase_checklist_itens;
CREATE POLICY "fase_checklist_select_interno" ON public.kanban_fase_checklist_itens
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "fase_checklist_admin" ON public.kanban_fase_checklist_itens;
CREATE POLICY "fase_checklist_admin" ON public.kanban_fase_checklist_itens
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- â”€â”€â”€ Respostas por card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.kanban_fase_checklist_respostas (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id        UUID        NOT NULL REFERENCES public.kanban_fase_checklist_itens(id) ON DELETE CASCADE,
  card_id        UUID        NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  valor          TEXT,
  arquivo_path   TEXT,
  preenchido_por UUID        REFERENCES auth.users(id),
  preenchido_em  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(item_id, card_id)
);

CREATE INDEX IF NOT EXISTS idx_fase_checklist_respostas_card ON public.kanban_fase_checklist_respostas(card_id);
CREATE INDEX IF NOT EXISTS idx_fase_checklist_respostas_item ON public.kanban_fase_checklist_respostas(item_id);

ALTER TABLE public.kanban_fase_checklist_respostas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fase_checklist_resp_select" ON public.kanban_fase_checklist_respostas;
CREATE POLICY "fase_checklist_resp_select" ON public.kanban_fase_checklist_respostas
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "fase_checklist_resp_upsert" ON public.kanban_fase_checklist_respostas;
CREATE POLICY "fase_checklist_resp_upsert" ON public.kanban_fase_checklist_respostas
  FOR ALL USING (auth.role() = 'authenticated');

-- â”€â”€â”€ Bucket de templates de documentos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos-templates', 'documentos-templates', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "templates_select_auth" ON storage.objects;
CREATE POLICY "templates_select_auth" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'documentos-templates');

DROP POLICY IF EXISTS "templates_insert_admin" ON storage.objects;
CREATE POLICY "templates_insert_admin" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos-templates'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- â”€â”€â”€ Seed: fase "Dados do Candidato" â€” SLA, instruÃ§Ãµes e itens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_id   UUID;
BEGIN
  SELECT id INTO v_kanban_id FROM public.kanbans WHERE nome = 'Funil Step One' LIMIT 1;
  SELECT id INTO v_fase_id   FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND nome = 'Dados do Candidato' LIMIT 1;

  IF v_fase_id IS NULL THEN
    RAISE NOTICE '149: fase "Dados do Candidato" nÃ£o encontrada; pulando seed.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases SET sla_dias = 1 WHERE id = v_fase_id;

  UPDATE public.kanban_fases SET instrucoes =
    '1. Preencher itens abaixo
2. Baixar documentos
3. Assinar documentos
4. Subir documentos assinados'
  WHERE id = v_fase_id;

  INSERT INTO public.kanban_fase_checklist_itens
    (fase_id, ordem, label, tipo, visivel_candidato, placeholder)
  SELECT * FROM (VALUES
    (v_fase_id,  1, 'Nome',                                          'texto_curto',   true,  'Nome completo'),
    (v_fase_id,  2, 'E-mail',                                        'email',         false, 'seu@email.com'),
    (v_fase_id,  3, 'Telefone',                                      'telefone',      false, '(11) 99999-9999'),
    (v_fase_id,  4, 'Idade',                                         'numero',        true,  'Ex: 35'),
    (v_fase_id,  5, 'ProfissÃ£o',                                     'texto_curto',   true,  ''),
    (v_fase_id,  6, 'ExperiÃªncias profissionais relevantes',         'texto_longo',   true,  ''),
    (v_fase_id,  7, 'TrajetÃ³ria e aprendizados mais importantes',    'texto_longo',   true,  ''),
    (v_fase_id,  8, 'Por que acredita que seria um bom franqueado MonÃ­', 'texto_longo', true, ''),
    (v_fase_id,  9, 'Termo de Confidencialidade e NÃ£o-DivulgaÃ§Ã£o',   'anexo_template', true, ''),
    (v_fase_id, 10, 'Termo de AutorizaÃ§Ã£o para Consulta de InformaÃ§Ãµes', 'anexo_template', true, '')
  ) AS t(fase_id, ordem, label, tipo, visivel_candidato, placeholder)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens WHERE fase_id = v_fase_id
  );
END $$;
-- 150: Tokens de formulÃ¡rio pÃºblico para candidatos (por card + fase)

CREATE TABLE IF NOT EXISTS public.kanban_card_form_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id    UUID        NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  fase_id    UUID        NOT NULL REFERENCES public.kanban_fases(id) ON DELETE CASCADE,
  token      TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  usado_em   TIMESTAMPTZ,
  created_by UUID        REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_card_form_tokens_card  ON public.kanban_card_form_tokens(card_id);
CREATE INDEX IF NOT EXISTS idx_card_form_tokens_token ON public.kanban_card_form_tokens(token);

ALTER TABLE public.kanban_card_form_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "form_tokens_select_interno" ON public.kanban_card_form_tokens;
CREATE POLICY "form_tokens_select_interno" ON public.kanban_card_form_tokens
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "form_tokens_insert_interno" ON public.kanban_card_form_tokens;
CREATE POLICY "form_tokens_insert_interno" ON public.kanban_card_form_tokens
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

GRANT ALL ON public.kanban_card_form_tokens TO authenticated;

NOTIFY pgrst, 'reload schema';
-- 151: Colunas de e-mail e controle de cobranÃ§a em kanban_card_form_tokens

ALTER TABLE public.kanban_card_form_tokens
  ADD COLUMN IF NOT EXISTS email_candidato     TEXT,
  ADD COLUMN IF NOT EXISTS nome_candidato      TEXT,
  ADD COLUMN IF NOT EXISTS cobranca_enviada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cobrancas_enviadas  INTEGER DEFAULT 0;
-- Nome do responsÃ¡vel escolhido no modal de novo chamado (lista fixa por time).
ALTER TABLE public.sirene_chamados
  ADD COLUMN IF NOT EXISTS abertura_responsavel_nome TEXT;

COMMENT ON COLUMN public.sirene_chamados.abertura_responsavel_nome IS
  'ResponsÃ¡vel indicado na abertura do chamado (texto; catÃ¡logo Sirene por time).';
-- Nome do responsÃ¡vel em texto (catÃ¡logo MonÃ­ / externo) quando nÃ£o hÃ¡ match em profiles.
ALTER TABLE public.kanban_atividades
  ADD COLUMN IF NOT EXISTS responsavel_nome_texto TEXT;

COMMENT ON COLUMN public.kanban_atividades.responsavel_nome_texto IS
  'ResponsÃ¡vel por nome (ex.: catÃ¡logo TIMES_MONI) quando responsaveis_ids nÃ£o resolve para perfil.';
-- Prevenir duplicatas em kanban_fase_checklist_itens
DELETE FROM public.kanban_fase_checklist_itens a
USING public.kanban_fase_checklist_itens b
WHERE a.id > b.id
  AND a.fase_id = b.fase_id
  AND a.ordem = b.ordem
  AND a.label = b.label;

ALTER TABLE public.kanban_fase_checklist_itens
  DROP CONSTRAINT IF EXISTS kanban_fase_checklist_itens_fase_ordem_unique;

ALTER TABLE public.kanban_fase_checklist_itens
  ADD CONSTRAINT kanban_fase_checklist_itens_fase_ordem_unique
  UNIQUE (fase_id, ordem, label);
CREATE TABLE public.repositorio_secoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.repositorio_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secao_id UUID NOT NULL REFERENCES public.repositorio_secoes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  storage_path TEXT NOT NULL,
  bucket TEXT NOT NULL DEFAULT 'documentos-templates',
  criado_por UUID REFERENCES auth.users(id),
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.repositorio_secoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repositorio_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "repositorio_select" ON public.repositorio_secoes
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "repositorio_admin" ON public.repositorio_secoes
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "repositorio_docs_select" ON public.repositorio_documentos
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "repositorio_docs_admin" ON public.repositorio_documentos
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

GRANT ALL ON public.repositorio_secoes TO authenticated;
GRANT ALL ON public.repositorio_documentos TO authenticated;

-- Seed: seÃ§Ã£o PrÃ© QualificaÃ§Ã£o
INSERT INTO public.repositorio_secoes (nome, ordem)
VALUES ('PrÃ© QualificaÃ§Ã£o', 1);
-- 157: Checklist estrutural â€” demais fases do Funil Step One (itens por fase).
-- Idempotente: alinha slug canÃ³nico + INSERT com WHERE NOT EXISTS (fase_id + label).

DO $$
DECLARE
  v_kanban_id UUID;
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE nome = 'Funil Step One'
    AND COALESCE(ativo, true) = true
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '157: kanban Funil Step One nÃ£o encontrado; pulando.';
    RETURN;
  END IF;

  -- Slugs canÃ³nicos (pedido do produto); idempotente por nome da fase.
  UPDATE public.kanban_fases SET slug = 'dados_cidade'
    WHERE kanban_id = v_kanban_id AND nome = 'Dados da Cidade';
  UPDATE public.kanban_fases SET slug = 'lista_condominios'
    WHERE kanban_id = v_kanban_id AND nome = 'Lista de CondomÃ­nios';
  UPDATE public.kanban_fases SET slug = 'dados_condominios'
    WHERE kanban_id = v_kanban_id AND nome = 'Dados dos CondomÃ­nios';
  UPDATE public.kanban_fases SET slug = 'lotes_disponiveis'
    WHERE kanban_id = v_kanban_id AND nome = 'Lotes disponÃ­veis';
  UPDATE public.kanban_fases SET slug = 'mapa_competidores'
    WHERE kanban_id = v_kanban_id AND nome = 'Mapa de Competidores';
  UPDATE public.kanban_fases SET slug = 'bca_batalha_casas'
    WHERE kanban_id = v_kanban_id AND nome = 'BCA + Batalha de Casas';
  UPDATE public.kanban_fases SET slug = 'hipoteses'
    WHERE kanban_id = v_kanban_id AND nome = 'HipÃ³teses';
END;
$$;

-- â”€â”€â”€ Dados da Cidade (slug: dados_cidade) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
SELECT f.id, v.ordem, v.label, v.tipo, true, true, v.placeholder
FROM public.kanban_fases f
JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
CROSS JOIN (VALUES
  (1, 'Cidade de interesse',       'texto_curto', NULL::text),
  (2, 'Estado',                    'texto_curto', NULL),
  (3, 'PopulaÃ§Ã£o estimada',        'numero',      NULL),
  (4, 'Renda mÃ©dia per capita',    'texto_curto', NULL),
  (5, 'ObservaÃ§Ãµes sobre a praÃ§a', 'texto_longo', NULL)
) AS v(ordem, label, tipo, placeholder)
WHERE f.slug = 'dados_cidade'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id AND i.label = v.label
  );

-- â”€â”€â”€ Lista de CondomÃ­nios (slug: lista_condominios) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
SELECT f.id, v.ordem, v.label, v.tipo, true, true, v.placeholder
FROM public.kanban_fases f
JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
CROSS JOIN (VALUES
  (1, 'Nome do condomÃ­nio',    'texto_curto', NULL::text),
  (2, 'EndereÃ§o',              'texto_curto', NULL),
  (3, 'NÃºmero de unidades',    'numero',      NULL),
  (4, 'Contato do sÃ­ndico',    'texto_curto', NULL),
  (5, 'Status de interesse',   'texto_curto', NULL)
) AS v(ordem, label, tipo, placeholder)
WHERE f.slug = 'lista_condominios'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id AND i.label = v.label
  );

-- â”€â”€â”€ Dados dos CondomÃ­nios (slug: dados_condominios) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
SELECT f.id, v.ordem, v.label, v.tipo, true, true, v.placeholder
FROM public.kanban_fases f
JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
CROSS JOIN (VALUES
  (1, 'Nome do condomÃ­nio',                 'texto_curto', NULL::text),
  (2, 'CNPJ do condomÃ­nio',                 'texto_curto', NULL),
  (3, 'Ãrea total do terreno mÂ²',           'numero',      NULL),
  (4, 'Ãrea disponÃ­vel para construÃ§Ã£o mÂ²', 'numero',      NULL),
  (5, 'DocumentaÃ§Ã£o regularizada',          'checkbox',    NULL),
  (6, 'ObservaÃ§Ãµes',                        'texto_longo', NULL)
) AS v(ordem, label, tipo, placeholder)
WHERE f.slug = 'dados_condominios'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id AND i.label = v.label
  );

-- â”€â”€â”€ Lotes disponÃ­veis (slug: lotes_disponiveis) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
SELECT f.id, v.ordem, v.label, v.tipo, true, true, v.placeholder
FROM public.kanban_fases f
JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
CROSS JOIN (VALUES
  (1, 'IdentificaÃ§Ã£o do lote',  'texto_curto', NULL::text),
  (2, 'Ãrea mÂ²',                 'numero',      NULL),
  (3, 'Valor estimado',          'texto_curto', NULL),
  (4, 'SituaÃ§Ã£o documental',     'texto_curto', NULL),
  (5, 'Fotos do lote',           'anexo',       NULL)
) AS v(ordem, label, tipo, placeholder)
WHERE f.slug = 'lotes_disponiveis'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id AND i.label = v.label
  );

-- â”€â”€â”€ Mapa de Competidores (slug: mapa_competidores) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
SELECT f.id, v.ordem, v.label, v.tipo, true, true, v.placeholder
FROM public.kanban_fases f
JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
CROSS JOIN (VALUES
  (1, 'Nome do competidor',          'texto_curto', NULL::text),
  (2, 'DistÃ¢ncia km',                'numero',      NULL),
  (3, 'Produto/serviÃ§o oferecido',   'texto_curto', NULL),
  (4, 'NÃ­vel de ameaÃ§a',             'texto_curto', NULL),
  (5, 'ObservaÃ§Ãµes',                 'texto_longo', NULL)
) AS v(ordem, label, tipo, placeholder)
WHERE f.slug = 'mapa_competidores'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id AND i.label = v.label
  );

-- â”€â”€â”€ BCA + Batalha de Casas (slug: bca_batalha_casas) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
SELECT f.id, v.ordem, v.label, v.tipo, true, true, v.placeholder
FROM public.kanban_fases f
JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
CROSS JOIN (VALUES
  (1, 'BCA elaborado',                   'checkbox',    NULL::text),
  (2, 'Link do BCA',                     'texto_curto', NULL),
  (3, 'Resultado da batalha de casas',   'texto_longo', NULL),
  (4, 'Aprovado pelo comitÃª',            'checkbox',    NULL)
) AS v(ordem, label, tipo, placeholder)
WHERE f.slug = 'bca_batalha_casas'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id AND i.label = v.label
  );

-- â”€â”€â”€ HipÃ³teses (slug: hipoteses) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, placeholder)
SELECT f.id, v.ordem, v.label, v.tipo, true, true, v.placeholder
FROM public.kanban_fases f
JOIN public.kanbans k ON k.id = f.kanban_id AND k.nome = 'Funil Step One'
CROSS JOIN (VALUES
  (1, 'HipÃ³tese principal',   'texto_longo', NULL::text),
  (2, 'Premissas assumidas',  'texto_longo', NULL),
  (3, 'Riscos identificados', 'texto_longo', NULL),
  (4, 'PrÃ³ximos passos',      'texto_longo', NULL)
) AS v(ordem, label, tipo, placeholder)
WHERE f.slug = 'hipoteses'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens i
    WHERE i.fase_id = f.id AND i.label = v.label
  );
-- 158: Kanban "Funil MonÃ­ INC" â€” cÃ³pia das fases do Funil Step One + checklist por fase.

INSERT INTO public.kanbans (nome, descricao, ordem, ativo)
SELECT 'Funil MonÃ­ INC', 'Funil de qualificaÃ§Ã£o MonÃ­ INC', 1, true
WHERE NOT EXISTS (SELECT 1 FROM public.kanbans WHERE nome = 'Funil MonÃ­ INC');

INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo, instrucoes, materiais)
SELECT
  (SELECT id FROM public.kanbans WHERE nome = 'Funil MonÃ­ INC' LIMIT 1),
  kf.nome,
  CASE
    WHEN kf.slug IS NOT NULL AND btrim(kf.slug::text) <> '' THEN btrim(kf.slug::text) || '_moni_inc'
    ELSE 'fase_' || kf.ordem::text || '_moni_inc'
  END,
  kf.ordem,
  kf.sla_dias,
  kf.ativo,
  kf.instrucoes,
  COALESCE(kf.materiais, '[]'::jsonb)
FROM public.kanban_fases kf
JOIN public.kanbans k ON k.id = kf.kanban_id
WHERE k.nome = 'Funil Step One'
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases f2
    JOIN public.kanbans k2 ON k2.id = f2.kanban_id
    WHERE k2.nome = 'Funil MonÃ­ INC'
      AND f2.ordem = kf.ordem
  );

INSERT INTO public.kanban_fase_checklist_itens
  (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, template_storage_path, placeholder)
SELECT
  (
    SELECT f2.id
    FROM public.kanban_fases f2
    JOIN public.kanbans k2 ON k2.id = f2.kanban_id
    WHERE k2.nome = 'Funil MonÃ­ INC'
      AND f2.ordem = kf.ordem
    LIMIT 1
  ),
  ci.ordem,
  ci.label,
  ci.tipo,
  ci.obrigatorio,
  ci.visivel_candidato,
  ci.template_storage_path,
  ci.placeholder
FROM public.kanban_fase_checklist_itens ci
JOIN public.kanban_fases kf ON kf.id = ci.fase_id
JOIN public.kanbans k ON k.id = kf.kanban_id
WHERE k.nome = 'Funil Step One'
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_fase_checklist_itens ci2
    JOIN public.kanban_fases f2 ON f2.id = ci2.fase_id
    JOIN public.kanbans k2 ON k2.id = f2.kanban_id
    WHERE k2.nome = 'Funil MonÃ­ INC'
      AND ci2.label = ci.label
      AND f2.ordem = kf.ordem
  );
-- 159: Funil MonÃ­ INC â€” substituir todas as fases atuais pelas fases do fluxo MonÃ­ INC.
-- Remove qualquer cÃ³pia do Step One (slugs com sufixo _moni_inc ou legado) sem depender da lista exacta.
-- AtenÃ§Ã£o: FK em kanban_cards(fase_id) com ON DELETE CASCADE remove cards que estavam nessas fases.

DELETE FROM public.kanban_fases
WHERE kanban_id = (SELECT id FROM public.kanbans WHERE nome = 'Funil MonÃ­ INC' LIMIT 1);

INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo, instrucoes, materiais)
SELECT
  k.id,
  f.nome,
  f.slug,
  f.ordem,
  7,
  true,
  NULL,
  '[]'::jsonb
FROM public.kanbans k
CROSS JOIN (
  VALUES
    ('Primeiro Contato', 'primeiro_contato_moni_inc', 1),
    ('R1 Executada: "Conceito"', 'r1_conceito_moni_inc', 2),
    ('R2 Apresentar Plano TeÃ³rico', 'r2_plano_teorico_moni_inc', 3),
    ('R3 Ajustes Finais nas Propostas', 'r3_ajustes_finais_moni_inc', 4),
    ('Fechar Contrato', 'fechar_contrato_moni_inc', 5)
) AS f(nome, slug, ordem)
WHERE k.nome = 'Funil MonÃ­ INC'
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases kf
    WHERE kf.kanban_id = k.id
      AND kf.slug = f.slug
  );
-- 160: Checklist por fase â€” Funil MonÃ­ INC (idempotente por fase_id + label).
-- Tipos `data` / `hora` (alinhado Ã  161 em bases que jÃ¡ aplicaram apenas a 160 antiga).

ALTER TABLE public.kanban_fase_checklist_itens
  DROP CONSTRAINT IF EXISTS kanban_fase_checklist_itens_tipo_check;

ALTER TABLE public.kanban_fase_checklist_itens
  ADD CONSTRAINT kanban_fase_checklist_itens_tipo_check
  CHECK (tipo IN (
    'texto_curto',
    'texto_longo',
    'email',
    'telefone',
    'numero',
    'anexo',
    'anexo_template',
    'checkbox',
    'data',
    'hora'
  ));

DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_id UUID;
BEGIN
  SELECT id INTO v_kanban_id FROM public.kanbans WHERE nome = 'Funil MonÃ­ INC' LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '160_checklist_fases_moni_inc: kanban Funil MonÃ­ INC nÃ£o encontrado; pulando.';
    RETURN;
  END IF;

  -- Primeiro Contato
  SELECT id INTO v_fase_id FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'primeiro_contato_moni_inc'
  LIMIT 1;
  IF v_fase_id IS NOT NULL THEN
    INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
    SELECT v_fase_id, 1, 'Data da ReuniÃ£o', 'data', true, true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.kanban_fase_checklist_itens
      WHERE fase_id = v_fase_id AND label = 'Data da ReuniÃ£o'
    );
    INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
    SELECT v_fase_id, 2, 'HorÃ¡rio da ReuniÃ£o', 'hora', true, true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.kanban_fase_checklist_itens
      WHERE fase_id = v_fase_id AND label = 'HorÃ¡rio da ReuniÃ£o'
    );
  END IF;

  -- R2 Apresentar Plano TeÃ³rico
  SELECT id INTO v_fase_id FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'r2_plano_teorico_moni_inc'
  LIMIT 1;
  IF v_fase_id IS NOT NULL THEN
    INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
    SELECT v_fase_id, v.ordem, v.label, 'anexo', true, true
    FROM (VALUES (1, 'Ficha de Cadastro'), (2, 'Calculadora BCA'), (3, '1Âº Acoplamento')) AS v(ordem, label)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.kanban_fase_checklist_itens
      WHERE fase_id = v_fase_id AND label = v.label
    );
  END IF;

  -- R3 Ajustes Finais nas Propostas
  SELECT id INTO v_fase_id FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'r3_ajustes_finais_moni_inc'
  LIMIT 1;
  IF v_fase_id IS NOT NULL THEN
    INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
    SELECT v_fase_id, 1, 'EmoU', 'anexo', true, true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.kanban_fase_checklist_itens
      WHERE fase_id = v_fase_id AND label = 'EmoU'
    );
  END IF;

  -- Fechar Contrato
  SELECT id INTO v_fase_id FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'fechar_contrato_moni_inc'
  LIMIT 1;
  IF v_fase_id IS NOT NULL THEN
    INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
    SELECT v_fase_id, 1, 'Contrato', 'anexo', true, true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.kanban_fase_checklist_itens
      WHERE fase_id = v_fase_id AND label = 'Contrato'
    );
  END IF;
END $$;
-- 161: Tipos checklist `data` / `hora` + substituir item Ãºnico por dois campos (Funil MonÃ­ INC â€” Primeiro Contato).

ALTER TABLE public.kanban_fase_checklist_itens
  DROP CONSTRAINT IF EXISTS kanban_fase_checklist_itens_tipo_check;

ALTER TABLE public.kanban_fase_checklist_itens
  ADD CONSTRAINT kanban_fase_checklist_itens_tipo_check
  CHECK (tipo IN (
    'texto_curto',
    'texto_longo',
    'email',
    'telefone',
    'numero',
    'anexo',
    'anexo_template',
    'checkbox',
    'data',
    'hora'
  ));

DO $$
DECLARE
  v_kanban_id UUID;
  v_fase_id UUID;
BEGIN
  SELECT id INTO v_kanban_id FROM public.kanbans WHERE nome = 'Funil MonÃ­ INC' LIMIT 1;
  IF v_kanban_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_fase_id FROM public.kanban_fases
  WHERE kanban_id = v_kanban_id AND slug = 'primeiro_contato_moni_inc'
  LIMIT 1;
  IF v_fase_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.kanban_fase_checklist_itens
  WHERE fase_id = v_fase_id AND label = 'Data e HorÃ¡rio da ReuniÃ£o';

  INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
  SELECT v_fase_id, 1, 'Data da ReuniÃ£o', 'data', true, true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_id AND label = 'Data da ReuniÃ£o'
  );

  INSERT INTO public.kanban_fase_checklist_itens (fase_id, ordem, label, tipo, obrigatorio, visivel_candidato)
  SELECT v_fase_id, 2, 'HorÃ¡rio da ReuniÃ£o', 'hora', true, true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens
    WHERE fase_id = v_fase_id AND label = 'HorÃ¡rio da ReuniÃ£o'
  );
END $$;
-- 162: sirene_chamados â€” vÃ­nculo opcional a card do kanban + prazo para ordenaÃ§Ã£o na lista.
-- Expande CHECK de tipo em kanban_atividades para incluir chamados Sirene espelhados na board.

ALTER TABLE public.sirene_chamados
  ADD COLUMN IF NOT EXISTS card_id UUID REFERENCES public.kanban_cards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS card_kanban_nome TEXT,
  ADD COLUMN IF NOT EXISTS card_titulo TEXT,
  ADD COLUMN IF NOT EXISTS data_vencimento DATE;

COMMENT ON COLUMN public.sirene_chamados.card_id IS 'Card de kanban (nativo) vinculado ao chamado, se houver.';
COMMENT ON COLUMN public.sirene_chamados.card_kanban_nome IS 'Nome do kanban em kanbans.nome (para rota do funil).';
COMMENT ON COLUMN public.sirene_chamados.card_titulo IS 'TÃ­tulo do card no momento do vÃ­nculo.';
COMMENT ON COLUMN public.sirene_chamados.data_vencimento IS 'Prazo exibido na ordenaÃ§Ã£o da lista de chamados (opcional).';

CREATE INDEX IF NOT EXISTS idx_sirene_chamados_card_id
  ON public.sirene_chamados(card_id)
  WHERE card_id IS NOT NULL;

ALTER TABLE public.kanban_atividades DROP CONSTRAINT IF EXISTS kanban_atividades_tipo_check;

ALTER TABLE public.kanban_atividades
  ADD CONSTRAINT kanban_atividades_tipo_check
  CHECK (tipo IN ('atividade', 'duvida', 'chamado_padrao', 'chamado_hdm'));

NOTIFY pgrst, 'reload schema';
-- 163: kanban_cards â€” garantir concluido/arquivado NOT NULL DEFAULT false
--      + policy SELECT para admin/team verem todos os cards (alÃ©m do dono).
--
-- Contexto: listagens usam .eq('concluido', false); valores NULL nÃ£o passam.
-- RLS: team precisa de ramo explÃ­cito; sÃ³ INSERT/UPDATE/DELETE tinham sido alargados na 162.

-- â”€â”€â”€ 1) Normalizar nulos (antes de NOT NULL) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
UPDATE public.kanban_cards SET concluido = false WHERE concluido IS NULL;
UPDATE public.kanban_cards SET arquivado = false WHERE arquivado IS NULL;

-- â”€â”€â”€ 2) Defaults e NOT NULL (idempotente se jÃ¡ estiver correto) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.kanban_cards
  ALTER COLUMN concluido SET DEFAULT false,
  ALTER COLUMN concluido SET NOT NULL;

ALTER TABLE public.kanban_cards
  ALTER COLUMN arquivado SET DEFAULT false,
  ALTER COLUMN arquivado SET NOT NULL;

-- â”€â”€â”€ 3) SELECT: visÃ£o ampla (admin, team â€” pedido 163) + consultor/supervisor
--     para alinhar a `visaoAmplaCards` em funil-moni-inc/page.tsx e Step One.
DROP POLICY IF EXISTS "kanban_cards_select" ON public.kanban_cards;

CREATE POLICY "kanban_cards_select"
  ON public.kanban_cards
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'team', 'consultor', 'supervisor')
    )
    OR franqueado_id = auth.uid()
  );
-- Liga cada linha origem=sirene em kanban_atividades ao sirene_chamados correspondente
-- (backfill alinhado Ã  migration 120: criado_por + created_at).

ALTER TABLE public.kanban_atividades
  ADD COLUMN IF NOT EXISTS sirene_chamado_id BIGINT REFERENCES public.sirene_chamados(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.kanban_atividades.sirene_chamado_id IS
  'Quando origem = sirene, aponta para o registro em sirene_chamados (lista unificada / painel).';

CREATE UNIQUE INDEX IF NOT EXISTS idx_kanban_atividades_sirene_chamado_id_unique
  ON public.kanban_atividades (sirene_chamado_id)
  WHERE sirene_chamado_id IS NOT NULL;

UPDATE public.kanban_atividades ka
SET sirene_chamado_id = sc.id
FROM public.sirene_chamados sc
WHERE ka.origem = 'sirene'
  AND ka.sirene_chamado_id IS NULL
  AND ka.criado_por IS NOT DISTINCT FROM sc.aberto_por
  AND ka.created_at = sc.created_at;

NOTIFY pgrst, 'reload schema';
-- ClassificaÃ§Ã£o do sub-chamado (paridade com formulÃ¡rio kanban / Sirene Chamados).

ALTER TABLE public.sirene_topicos
  ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'atividade';

UPDATE public.sirene_topicos
SET tipo = 'atividade'
WHERE tipo IS NULL OR tipo NOT IN ('atividade', 'duvida', 'chamado');

ALTER TABLE public.sirene_topicos
  ALTER COLUMN tipo SET DEFAULT 'atividade',
  ALTER COLUMN tipo SET NOT NULL;

ALTER TABLE public.sirene_topicos DROP CONSTRAINT IF EXISTS sirene_topicos_tipo_check;
ALTER TABLE public.sirene_topicos
  ADD CONSTRAINT sirene_topicos_tipo_check
  CHECK (tipo IN ('atividade', 'duvida', 'chamado'));

COMMENT ON COLUMN public.sirene_topicos.tipo IS
  'Sub-chamado: atividade | duvida | chamado (UI alinhada ao kanban).';

NOTIFY pgrst, 'reload schema';
ALTER TABLE processo_step_one ADD COLUMN IF NOT EXISTS quadra text;
-- Adiciona item "Tabela de CondomÃ­nios" (tipo tabela) na fase "Dados da Cidade" do Funil Step One.
-- Ordem 10 porque os itens 6â€“9 jÃ¡ foram inseridos diretamente no PROD via SQL.
INSERT INTO kanban_fase_checklist_itens (fase_id, label, tipo, ordem, obrigatorio, visivel_candidato, placeholder)
VALUES (
  'cd8c2bc6-ea2e-4d38-8425-d39ae648b014',
  'Tabela de CondomÃ­nios',
  'tabela',
  10,
  true,
  true,
  'Preencha os dados dos condomÃ­nios do seu perÃ­metro'
);
ALTER TABLE kanban_fase_checklist_itens
DROP CONSTRAINT IF EXISTS kanban_fase_checklist_itens_tipo_check;

ALTER TABLE kanban_fase_checklist_itens
ADD CONSTRAINT kanban_fase_checklist_itens_tipo_check
CHECK (tipo = ANY (ARRAY[
  'texto_curto', 'texto_longo', 'email', 'telefone', 'numero',
  'anexo', 'anexo_template', 'checkbox', 'data', 'hora', 'tabela'
]));
-- Autor pode editar apenas o prÃ³prio comentÃ¡rio (RLS + grant).

DROP POLICY IF EXISTS "kanban_card_comentarios_update_autor" ON public.kanban_card_comentarios;
CREATE POLICY "kanban_card_comentarios_update_autor"
  ON public.kanban_card_comentarios
  FOR UPDATE
  TO authenticated
  USING (autor_id = auth.uid())
  WITH CHECK (autor_id = auth.uid());

GRANT UPDATE ON public.kanban_card_comentarios TO authenticated;
-- Tags por kanban e vÃ­nculo por card

CREATE TABLE IF NOT EXISTS public.kanban_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kanban_id uuid NOT NULL REFERENCES public.kanbans(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cor text NOT NULL DEFAULT '#F5A623',
  created_at timestamptz DEFAULT now(),
  UNIQUE(kanban_id, nome)
);

CREATE TABLE IF NOT EXISTS public.kanban_card_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.kanban_tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(card_id, tag_id)
);

-- Autor pode excluir apenas o prÃ³prio comentÃ¡rio (RLS + grant).

DROP POLICY IF EXISTS "kanban_card_comentarios_delete_autor" ON public.kanban_card_comentarios;
CREATE POLICY "kanban_card_comentarios_delete_autor"
  ON public.kanban_card_comentarios
  FOR DELETE
  TO authenticated
  USING (autor_id = auth.uid());

GRANT DELETE ON public.kanban_card_comentarios TO authenticated;
-- Dados de negÃ³cio (condomÃ­nio / quadra / lote) em cards nativos sem processo vinculado.

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS nome_condominio TEXT,
  ADD COLUMN IF NOT EXISTS quadra TEXT,
  ADD COLUMN IF NOT EXISTS lote TEXT;

COMMENT ON COLUMN public.kanban_cards.nome_condominio IS 'Nome do condomÃ­nio (dados do negÃ³cio no card nativo).';
COMMENT ON COLUMN public.kanban_cards.quadra IS 'Quadra (dados do negÃ³cio no card nativo).';
COMMENT ON COLUMN public.kanban_cards.lote IS 'Lote (dados do negÃ³cio no card nativo).';
-- Datas de reuniÃ£o e follow-up em cards nativos e processos (legado via view).

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS data_reuniao date,
  ADD COLUMN IF NOT EXISTS data_followup date;

COMMENT ON COLUMN public.kanban_cards.data_reuniao IS 'Data planejada de reuniÃ£o (card nativo).';
COMMENT ON COLUMN public.kanban_cards.data_followup IS 'Data de follow-up (card nativo).';

ALTER TABLE public.processo_step_one
  ADD COLUMN IF NOT EXISTS data_reuniao date,
  ADD COLUMN IF NOT EXISTS data_followup date;

COMMENT ON COLUMN public.processo_step_one.data_reuniao IS 'Data planejada de reuniÃ£o (processo / card legado).';
COMMENT ON COLUMN public.processo_step_one.data_followup IS 'Data de follow-up (processo / card legado).';

CREATE OR REPLACE VIEW public.v_processo_como_kanban_cards AS
SELECT
  p.id,
  kf.kanban_id,
  kf.id          AS fase_id,
  COALESCE(
    NULLIF(TRIM(CONCAT_WS(' - ', p.numero_franquia, p.nome_condominio)), ''),
    'Sem tÃ­tulo'
  )              AS titulo,
  p.status,
  p.created_at   AS criado_em,
  p.updated_at,
  p.user_id      AS responsavel_id,
  p.etapa_painel AS etapa_slug,
  p.data_reuniao,
  p.data_followup,
  NULL::date     AS data_prazo_sla,
  'legado'       AS origem
FROM public.processo_step_one p
JOIN public.kanban_fases kf ON kf.slug = p.etapa_painel
JOIN public.kanbans k       ON k.id   = kf.kanban_id
WHERE k.nome IN ('Funil PortfÃ³lio', 'Funil OperaÃ§Ãµes', 'Funil Contabilidade', 'Funil CrÃ©dito')
  AND p.cancelado_em IS NULL
  AND p.removido_em  IS NULL;

GRANT SELECT ON public.v_processo_como_kanban_cards TO authenticated, anon;
-- Arquivamento administrativo de chamados Sirene (lista unificada / painel).

ALTER TABLE public.sirene_chamados
  ADD COLUMN IF NOT EXISTS arquivado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS arquivado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arquivado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo_arquivamento_sirene TEXT;

COMMENT ON COLUMN public.sirene_chamados.arquivado IS 'Chamado oculto da lista padrÃ£o; visÃ­vel com â€œMostrar arquivadosâ€ (admin/team).';
COMMENT ON COLUMN public.sirene_chamados.motivo_arquivamento_sirene IS 'Motivo obrigatÃ³rio informado ao arquivar.';

CREATE INDEX IF NOT EXISTS idx_sirene_chamados_arquivado
  ON public.sirene_chamados (arquivado)
  WHERE arquivado = true;
-- Arquivamento de interaÃ§Ãµes (kanban_atividades) e sub-interaÃ§Ãµes (sirene_topicos)

ALTER TABLE public.kanban_atividades
  ADD COLUMN IF NOT EXISTS arquivado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS arquivado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arquivado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo_arquivamento TEXT;

COMMENT ON COLUMN public.kanban_atividades.arquivado IS 'InteraÃ§Ã£o arquivada; oculta no modal atÃ© nova polÃ­tica de exibiÃ§Ã£o.';

CREATE INDEX IF NOT EXISTS idx_kanban_atividades_arquivado
  ON public.kanban_atividades (arquivado)
  WHERE arquivado = true;

ALTER TABLE public.sirene_topicos
  ADD COLUMN IF NOT EXISTS arquivado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS arquivado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arquivado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo_arquivamento TEXT;

COMMENT ON COLUMN public.sirene_topicos.arquivado IS 'Sub-chamado arquivado; oculto nas listas ativas.';

CREATE INDEX IF NOT EXISTS idx_sirene_topicos_arquivado
  ON public.sirene_topicos (arquivado)
  WHERE arquivado = true;
-- Garante o time MonÃ­ "Produto" em kanban_times (novo chamado / interaÃ§Ãµes usam UUID desta tabela).
INSERT INTO public.kanban_times (id, nome)
SELECT gen_random_uuid(), 'Produto'
WHERE NOT EXISTS (SELECT 1 FROM public.kanban_times WHERE nome = 'Produto');
-- 177: Funil PortfÃ³lio â€” coluna "CaptaÃ§Ã£o MonÃ­ Capital" entre Contrato (step_7) e Passagem para Wayser.
-- Idempotente: nÃ£o duplica se o slug jÃ¡ existir nesse kanban.

DO $$
DECLARE
  v_kanban_id uuid;
BEGIN
  SELECT id INTO v_kanban_id
  FROM public.kanbans
  WHERE nome = 'Funil PortfÃ³lio' AND ativo = true
  ORDER BY id
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '177: kanban Funil PortfÃ³lio nÃ£o encontrado.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.kanban_fases
    WHERE kanban_id = v_kanban_id AND slug = 'captacao_moni_capital'
  ) THEN
    RETURN;
  END IF;

  UPDATE public.kanban_fases
  SET ordem = ordem + 1
  WHERE kanban_id = v_kanban_id
    AND ordem >= 9;

  INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, ativo)
  VALUES (
    v_kanban_id,
    'CaptaÃ§Ã£o MonÃ­ Capital',
    'captacao_moni_capital',
    9,
    true
  );
END $$;

COMMENT ON COLUMN public.processo_step_one.etapa_painel IS
  'Etapa no Painel Novos NegÃ³cios: step_1, step_2, aprovacao_moni_novo_negocio, step_3, step_4, acoplamento, step_5, step_6, step_7, captacao_moni_capital, passagem_wayser, planialtimetrico, sondagem, projeto_legal, aprovacao_condominio, aprovacao_prefeitura, revisao_bca, processos_cartorarios, aguardando_credito, em_obra, moni_care, contabilidade_incorporadora, contabilidade_spe, contabilidade_gestora, credito_terreno, credito_obra';
-- Universidade MonÃ­: casas e mÃ³dulos do tabuleiro
-- (numeraÃ§Ã£o 178+ â€” evita colisÃ£o com migrations legadas 016*.)

create table if not exists public.uni_casas (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  numero      int not null,
  titulo      text not null,
  descricao   text,
  cor_tema    text,
  ativa       boolean default true,
  criado_em   timestamptz default now()
);

create table if not exists public.uni_modulos (
  id          uuid primary key default gen_random_uuid(),
  casa_id     uuid not null references public.uni_casas(id) on delete cascade,
  tipo        text not null check (tipo in ('video','checklist','quiz','template','leitura')),
  titulo      text not null,
  conteudo    jsonb,
  ordem       int not null,
  obrigatorio boolean default true,
  criado_em   timestamptz default now()
);

create index if not exists idx_uni_modulos_casa_ordem on public.uni_modulos (casa_id, ordem);
create index if not exists idx_uni_casas_numero on public.uni_casas (numero);
create index if not exists idx_uni_casas_ativa on public.uni_casas (ativa) where ativa = true;
-- Texto opcional por item de progresso (ex.: score 0â€“100 em item_id quiz_score na Casa 1).
-- SÃ³ roda se a tabela jÃ¡ existir (pode ser criada por migration posterior com timestamp em clones novos).
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'franqueado_onboarding_progresso'
  ) then
    alter table public.franqueado_onboarding_progresso
      add column if not exists conteudo text;
    comment on column public.franqueado_onboarding_progresso.conteudo is
      'Valor textual por item (ex.: quiz_score com nota do quiz no onboarding Casa 1).';
  end if;
end $$;
-- Universidade MonÃ­: progresso, entregas, biblioteca e certificados

create table if not exists public.uni_progresso (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  modulo_id    uuid not null references public.uni_modulos(id) on delete cascade,
  casa_id      uuid references public.uni_casas(id),
  status       text not null default 'pendente' check (status in ('pendente','em_progresso','concluido')),
  dados        jsonb,
  nota         int check (nota between 0 and 100),
  concluido_em timestamptz,
  criado_em    timestamptz default now(),
  unique(user_id, modulo_id)
);

create table if not exists public.uni_entregas (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  casa_id      uuid references public.uni_casas(id),
  modulo_id    uuid references public.uni_modulos(id),
  tipo         text check (tipo in ('arquivo','link','texto')),
  valor        text,
  aprovado     boolean,
  aprovado_por uuid references auth.users(id),
  criado_em    timestamptz default now()
);

create table if not exists public.uni_biblioteca (
  id           uuid primary key default gen_random_uuid(),
  categoria    text not null,
  titulo       text not null,
  descricao    text,
  tipo         text check (tipo in ('arquivo','link','video')),
  url          text,
  tags         text[],
  visivel_para text[] default '{frank,team,admin}',
  criado_em    timestamptz default now()
);

create table if not exists public.uni_certificados (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  nivel       int not null check (nivel between 1 and 5),
  titulo      text not null,
  emitido_em  timestamptz default now(),
  unique(user_id, nivel)
);

create index if not exists idx_uni_progresso_user on public.uni_progresso (user_id);
create index if not exists idx_uni_progresso_modulo on public.uni_progresso (modulo_id);
create index if not exists idx_uni_entregas_user on public.uni_entregas (user_id);
create index if not exists idx_uni_entregas_aprovado_null on public.uni_entregas (aprovado) where aprovado is null;
create index if not exists idx_uni_biblioteca_categoria on public.uni_biblioteca (categoria);
create index if not exists idx_uni_certificados_user on public.uni_certificados (user_id);
