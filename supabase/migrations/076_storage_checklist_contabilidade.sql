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
