-- Adiciona item "Tabela de Condomínios" (tipo tabela) na fase "Dados da Cidade" do Funil Step One.
-- Ordem 10 porque os itens 6–9 já foram inseridos diretamente no PROD via SQL.
INSERT INTO kanban_fase_checklist_itens (fase_id, label, tipo, ordem, obrigatorio, visivel_candidato, placeholder)
VALUES (
  'cd8c2bc6-ea2e-4d38-8425-d39ae648b014',
  'Tabela de Condomínios',
  'tabela',
  10,
  true,
  true,
  'Preencha os dados dos condomínios do seu perímetro'
);
