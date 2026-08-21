ALTER TABLE kanban_fase_checklist_itens
DROP CONSTRAINT IF EXISTS kanban_fase_checklist_itens_tipo_check;

ALTER TABLE kanban_fase_checklist_itens
ADD CONSTRAINT kanban_fase_checklist_itens_tipo_check
CHECK (tipo = ANY (ARRAY[
  'texto_curto', 'texto_longo', 'email', 'telefone', 'numero',
  'anexo', 'anexo_template', 'checkbox', 'data', 'hora', 'tabela'
]));
