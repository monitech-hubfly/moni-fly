-- 340: Funil Loteadores — metadados de checklist (campo_slug, config_json) e novos tipos.

ALTER TABLE public.kanban_fase_checklist_itens
  ADD COLUMN IF NOT EXISTS campo_slug TEXT;

ALTER TABLE public.kanban_fase_checklist_itens
  ADD COLUMN IF NOT EXISTS config_json JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_fase_checklist_itens_campo_slug
  ON public.kanban_fase_checklist_itens (fase_id, campo_slug)
  WHERE campo_slug IS NOT NULL;

COMMENT ON COLUMN public.kanban_fase_checklist_itens.campo_slug IS
  'Identificador estável do campo (ex.: preco_atratividade) para automações e score.';
COMMENT ON COLUMN public.kanban_fase_checklist_itens.config_json IS
  'Configuração do campo: opções de select, faixas, flags calculado, etc.';

ALTER TABLE public.kanban_fase_checklist_itens
  DROP CONSTRAINT IF EXISTS kanban_fase_checklist_itens_tipo_check;

ALTER TABLE public.kanban_fase_checklist_itens
  ADD CONSTRAINT kanban_fase_checklist_itens_tipo_check
  CHECK (tipo IN (
    'texto_curto',
    'texto_longo',
    'email',
    'telefone',
    'numero',
    'url',
    'anexo',
    'anexo_multiplo',
    'anexo_template',
    'checkbox',
    'data',
    'hora',
    'select',
    'usuario',
    'cnpj',
    'catalog_casa',
    'calculado',
    'faixa_moeda',
    'faixa_numero',
    'tabela',
    'condominio',
    'pesquisa_condominio',
    'lotes_condominio',
    'listagem_casas_zap',
    'dados_cidade_ibge',
    'mapa_praca',
    'configurador_casas_ranking',
    'bca_simulador',
    'bca_condominio',
    'rede_loteador'
  ));
