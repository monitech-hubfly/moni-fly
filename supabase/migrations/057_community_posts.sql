-- Community Timeline (Sino Virtual + interações)

create table if not exists community_posts (
  id uuid primary key default gen_random_uuid(),
  author_type text default 'moni',
  tipo text,
  titulo text,
  conteudo text,
  sino_html text,
  -- No projeto atual a tabela se chama rede_franqueados (não "franqueados")
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

