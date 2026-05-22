-- 1. Tabela areas (rode primeiro)
create table areas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean default true,
  criado_em timestamptz default now()
);

-- 2. Tabela trimestres (rode segundo)
create table trimestres (
  id uuid primary key default gen_random_uuid(),
  ano int not null,
  trimestre int not null check (trimestre between 1 and 4),
  data_inicio date not null,
  data_fim date not null,
  ativo boolean default true,
  criado_em timestamptz default now(),
  unique(ano, trimestre)
);

-- 3. Tabela objetivos (rode terceiro)
create table objetivos (
  id uuid primary key default gen_random_uuid(),
  area_id uuid references areas(id) on delete cascade,
  trimestre_id uuid references trimestres(id) on delete cascade,
  descricao text not null,
  meta_valor numeric null,
  meta_unidade text null,
  ordem int default 0,
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- 4. Tabela tarefas (rode quarto)
create table tarefas (
  id uuid primary key default gen_random_uuid(),
  area_id uuid references areas(id) on delete cascade,
  nome text not null,
  descricao text null,
  tempo_estimado_minutos int null,
  ordem int default 0,
  criado_em timestamptz default now()
);

-- 5. Tabela acoes (rode quinto)
create table acoes (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid references tarefas(id) on delete cascade,
  nome text not null,
  tempo_estimado_minutos int null,
  ordem int default 0,
  criado_em timestamptz default now()
);

-- 6. Tabela cronograma (rode sexto)
create table cronograma (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid references tarefas(id) on delete cascade,
  acao_id uuid references acoes(id) on delete cascade,
  data_inicio_prevista date null,
  data_fim_prevista date null,
  data_inicio_real date null,
  data_fim_real date null,
  status text default 'pendente' check (status in ('pendente', 'em_andamento', 'concluido', 'atrasado')),
  observacao text null,
  criado_em timestamptz default now(),
  constraint cronograma_tarefa_ou_acao check (
    (tarefa_id is not null and acao_id is null) or
    (tarefa_id is null and acao_id is not null)
  )
);

-- 7. Tabela carometro (rode sétimo)
create table carometro (
  id uuid primary key default gen_random_uuid(),
  area_id uuid references areas(id) on delete cascade,
  trimestre_id uuid references trimestres(id) on delete cascade,
  tarefa_id uuid references tarefas(id) on delete set null,
  nome_comportamento text not null,
  emoji_chave text null,
  ordem int default 0,
  ativo boolean default true,
  criado_em timestamptz default now()
);

-- 8. Tabela registros_resultado (rode por último)
create table registros_resultado (
  id uuid primary key default gen_random_uuid(),
  objetivo_id uuid references objetivos(id) on delete cascade,
  data_referencia date not null,
  valor numeric not null,
  observacao text null,
  criado_em timestamptz default now()
);
