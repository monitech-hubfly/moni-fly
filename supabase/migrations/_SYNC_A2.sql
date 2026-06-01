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
