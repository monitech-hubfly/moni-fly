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
