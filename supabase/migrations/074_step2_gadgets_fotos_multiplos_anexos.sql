alter table public.processo_card_documentos
  add column if not exists texto_livre text,
  add column if not exists anexos_json jsonb not null default '[]'::jsonb;

comment on column public.processo_card_documentos.texto_livre is 'Campo de texto livre para documentos específicos (ex.: Gadgets no Step 2)';
comment on column public.processo_card_documentos.anexos_json is 'Lista de anexos extras por documento: [{storage_path,nome_original}]';
