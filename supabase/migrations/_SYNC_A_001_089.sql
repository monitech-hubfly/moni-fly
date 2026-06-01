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
