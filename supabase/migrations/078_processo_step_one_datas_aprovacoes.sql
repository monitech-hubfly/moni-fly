alter table public.processo_step_one
add column if not exists data_aprovacao_condominio date;

alter table public.processo_step_one
add column if not exists data_aprovacao_prefeitura date;

alter table public.processo_step_one
add column if not exists data_emissao_alvara date;
