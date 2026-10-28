-- 633: GBOX Ozempic deixa de ser obrigatório em qualquer funil.
-- Só altera o flag. Respostas e o link já gravado permanecem.

UPDATE public.kanban_fase_checklist_itens
SET obrigatorio = false
WHERE COALESCE(obrigatorio, false) = true
  AND (
    campo_slug = 'link_gbox_ozempic'
    OR chave_compartilhada = 'negocio:link_gbox_ozempic'
    OR regexp_replace(lower(trim(label)), '[—–-]', '-', 'g') IN (
      'gbox - versão ozempic',
      'gbox ozempic'
    )
  );

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('633', 'gbox_ozempic_opcional')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
