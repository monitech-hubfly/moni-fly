alter table public.processo_step_one
  add column if not exists previsao_aprovacao_condominio text,
  add column if not exists previsao_aprovacao_prefeitura text,
  add column if not exists previsao_emissao_alvara text,
  add column if not exists previsao_liberacao_credito_obra text,
  add column if not exists previsao_inicio_obra text;

comment on column public.processo_step_one.previsao_aprovacao_condominio is 'Dados Pré Obra: previsão de aprovação no condomínio';
comment on column public.processo_step_one.previsao_aprovacao_prefeitura is 'Dados Pré Obra: previsão de aprovação na prefeitura';
comment on column public.processo_step_one.previsao_emissao_alvara is 'Dados Pré Obra: previsão de emissão do alvará';
comment on column public.processo_step_one.previsao_liberacao_credito_obra is 'Dados Pré Obra: previsão de liberação do crédito para obra';
comment on column public.processo_step_one.previsao_inicio_obra is 'Dados Pré Obra: previsão de início de obra';
