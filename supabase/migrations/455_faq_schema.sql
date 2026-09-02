-- 455_faq_schema.sql
-- FAQ da Universidade Moní — estrutura de dados PRÓPRIA (independente de cursos/casas/módulos).
-- A FAQ NÃO é conteúdo acadêmico: não tem progresso, quiz, nota, conclusão ou certificado.
-- Idempotente.

create extension if not exists unaccent;

-- Categorias da FAQ
create table if not exists public.faq_categories (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text unique not null,
  description   text,
  icon          text,
  display_order int not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Artigos (perguntas e respostas)
create table if not exists public.faq_articles (
  id             uuid primary key default gen_random_uuid(),
  question       text not null,
  slug           text unique not null,
  short_answer   text,
  answer         text not null,
  category_id    uuid references public.faq_categories(id) on delete set null,
  keywords       text[] not null default '{}',
  synonyms       text[] not null default '{}',
  visibility     text[] not null default array['frank','team','admin']::text[],
  status         text not null default 'published' check (status in ('draft','published','archived')),
  is_featured    boolean not null default false,
  display_order  int not null default 0,
  view_count     int not null default 0,
  responsible_area text,
  owner_user_id  uuid references public.profiles(id) on delete set null,
  reviewed_at    timestamptz,
  review_due_at  timestamptz,
  created_by     uuid references public.profiles(id) on delete set null,
  updated_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  archived_at    timestamptz
);

create index if not exists idx_faq_articles_category on public.faq_articles (category_id);
create index if not exists idx_faq_articles_status on public.faq_articles (status);
create index if not exists idx_faq_articles_featured on public.faq_articles (is_featured) where is_featured = true;
create index if not exists idx_faq_articles_order on public.faq_articles (display_order);
create index if not exists idx_faq_categories_order on public.faq_categories (display_order);

-- Perguntas relacionadas (grafo simples, bidirecional pela aplicação)
create table if not exists public.faq_related_articles (
  article_id         uuid not null references public.faq_articles(id) on delete cascade,
  related_article_id uuid not null references public.faq_articles(id) on delete cascade,
  primary key (article_id, related_article_id),
  constraint faq_related_no_self check (article_id <> related_article_id)
);

-- Feedback do usuário sobre um artigo (independente do progresso da Universidade)
create table if not exists public.faq_feedback (
  id            uuid primary key default gen_random_uuid(),
  article_id    uuid references public.faq_articles(id) on delete cascade,
  user_id       uuid references public.profiles(id) on delete set null,
  was_helpful   boolean,
  needs_support boolean not null default false,
  comment       text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_faq_feedback_article on public.faq_feedback (article_id);

-- Registro de buscas (métricas independentes)
create table if not exists public.faq_searches (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references public.profiles(id) on delete set null,
  query               text not null,
  result_count        int not null default 0,
  selected_article_id uuid references public.faq_articles(id) on delete set null,
  created_at          timestamptz not null default now()
);
create index if not exists idx_faq_searches_created on public.faq_searches (created_at desc);
create index if not exists idx_faq_searches_zero on public.faq_searches (result_count) where result_count = 0;

-- updated_at automático
create or replace function public.faq_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tr_faq_articles_updated on public.faq_articles;
create trigger tr_faq_articles_updated before update on public.faq_articles
  for each row execute procedure public.faq_set_updated_at();

drop trigger if exists tr_faq_categories_updated on public.faq_categories;
create trigger tr_faq_categories_updated before update on public.faq_categories
  for each row execute procedure public.faq_set_updated_at();

-- Incremento de visualizações (RLS de escrita é staff-only; contador via definer para leitores)
create or replace function public.faq_increment_view(p_article_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.faq_articles
     set view_count = view_count + 1
   where id = p_article_id and status = 'published';
end;
$$;
grant execute on function public.faq_increment_view(uuid) to authenticated;

-- RLS
alter table public.faq_categories enable row level security;
alter table public.faq_articles enable row level security;
alter table public.faq_related_articles enable row level security;
alter table public.faq_feedback enable row level security;
alter table public.faq_searches enable row level security;

-- Categorias: leitura para autenticados (ativas); staff enxerga inativas; escrita só staff
drop policy if exists faq_categories_select on public.faq_categories;
create policy faq_categories_select on public.faq_categories for select to authenticated
  using (is_active = true or public.get_my_role() in ('admin','team'));

drop policy if exists faq_categories_write_staff on public.faq_categories;
create policy faq_categories_write_staff on public.faq_categories for all to authenticated
  using (public.get_my_role() in ('admin','team'))
  with check (public.get_my_role() in ('admin','team'));

-- Artigos: usuário comum só vê publicados e dentro da visibilidade; staff vê tudo; escrita só staff
drop policy if exists faq_articles_select on public.faq_articles;
create policy faq_articles_select on public.faq_articles for select to authenticated
  using (
    public.get_my_role() in ('admin','team')
    or (status = 'published' and public.get_my_role()::text = any (coalesce(visibility, array[]::text[])))
  );

drop policy if exists faq_articles_write_staff on public.faq_articles;
create policy faq_articles_write_staff on public.faq_articles for all to authenticated
  using (public.get_my_role() in ('admin','team'))
  with check (public.get_my_role() in ('admin','team'));

-- Relacionadas: leitura autenticada; escrita staff
drop policy if exists faq_related_select on public.faq_related_articles;
create policy faq_related_select on public.faq_related_articles for select to authenticated using (true);

drop policy if exists faq_related_write_staff on public.faq_related_articles;
create policy faq_related_write_staff on public.faq_related_articles for all to authenticated
  using (public.get_my_role() in ('admin','team'))
  with check (public.get_my_role() in ('admin','team'));

-- Feedback: inserção do próprio usuário; leitura só staff
drop policy if exists faq_feedback_insert_own on public.faq_feedback;
create policy faq_feedback_insert_own on public.faq_feedback for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists faq_feedback_select_staff on public.faq_feedback;
create policy faq_feedback_select_staff on public.faq_feedback for select to authenticated
  using (public.get_my_role() in ('admin','team'));

-- Buscas: inserção do próprio usuário (ou anônima nula); leitura só staff
drop policy if exists faq_searches_insert_own on public.faq_searches;
create policy faq_searches_insert_own on public.faq_searches for insert to authenticated
  with check (user_id = auth.uid() or user_id is null);

drop policy if exists faq_searches_select_staff on public.faq_searches;
create policy faq_searches_select_staff on public.faq_searches for select to authenticated
  using (public.get_my_role() in ('admin','team'));

grant select, insert, update, delete on public.faq_categories to authenticated;
grant select, insert, update, delete on public.faq_articles to authenticated;
grant select, insert, update, delete on public.faq_related_articles to authenticated;
grant select, insert, update, delete on public.faq_feedback to authenticated;
grant select, insert, update, delete on public.faq_searches to authenticated;

notify pgrst, 'reload schema';
