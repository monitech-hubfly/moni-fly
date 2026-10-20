-- Carga de public.customizacao_itens (gerado por scripts/gerar-sql-customizacao-itens.ts)
-- Origem: Itens_customizacao_casas.xlsx
-- Gerado em: 2026-10-20T21:49:19.582Z
-- Itens: 8 (8 ativos)
-- Modelos com preço próprio: Moní Gal L™, Moní Cissa L™, Moní Lena™
-- Idempotente: upsert por item. Itens fora da planilha não são apagados.
-- Requer a migration 639_customizacao_itens.sql.

BEGIN;

INSERT INTO public.customizacao_itens
  (item, descricao, valor_padrao, valores_por_modelo, ativo, ordem)
VALUES
  ('Kit Moní', 'Inclui revestimentos, louças e metais e iluminação no padrão Moní', NULL, '{"Moní Gal L™":555664.58,"Moní Cissa L™":183527.1,"Moní Lena™":641295.07}'::jsonb, true, 1),
  ('Marcenaria', 'Marcenaria planejada em todos os ambientes da casa — de armários embutidos nos quartos aos gabinetes da cozinha, gourmet e banheiros. Cada espaço pensado sob medida para unir organização, estética e praticidade no seu dia a dia.', 350000.00, '{}'::jsonb, true, 2),
  ('Eletrodomésticos', 'Kit Eletrodomésticos - Valor estimado para geladeira side by side, geladeira secundária, microondas, forno elétrico embutido, forno combinado, cooktop, coifa de ilha, lava louças, triturador de alimentos, cervejeira, adega climatizada, frigobar, máquina de lavar roupas, secadora, televisão 55"', 83000.00, '{}'::jsonb, true, 3),
  ('Aquecimento de água com boiler', 'Boiler elétrico de 1.000L com pressurizador, indicado para residências com mais de 4 duchas. Garante pressão e temperatura estáveis em toda a casa.', 29620.00, '{}'::jsonb, true, 4),
  ('Aspiração Central', 'Sistema completo de aspiração central com infraestrutura, equipamentos e mangueira padrão, cobrindo até 7 pontos. Limpeza sem ruído no ambiente e sem recirculação de poeira.', 17680.63, '{}'::jsonb, true, 5),
  ('Sistema Fotovoltaico', 'Geração solar on-grid de até 1.500 KWh por mês, dimensionada para cobrir o consumo da residência e gerar créditos na conta de energia. Sustentabilidade com retorno real.', 42900.00, '{}'::jsonb, true, 6),
  ('Churrasqueira', 'Churrasqueira com coifa em pintura eletrostática preta. Funcionalidade e estética alinhadas para quem quer o churrasco integrado ao projeto.', 12836.00, '{}'::jsonb, true, 7),
  ('Piscina Pré Moldada 3x7m (casco com revestimento, instalação e itens adicionais)', 'Piscina Pré Moldada (casco 3x7m com revestimento, instalação e itens adicionais)', 137058.08, '{}'::jsonb, true, 8)
ON CONFLICT (item) DO UPDATE SET
  descricao          = EXCLUDED.descricao,
  valor_padrao       = EXCLUDED.valor_padrao,
  valores_por_modelo = EXCLUDED.valores_por_modelo,
  ativo              = EXCLUDED.ativo,
  ordem              = EXCLUDED.ordem;

COMMIT;

SELECT item, valor_padrao, valores_por_modelo, ativo, ordem
FROM public.customizacao_itens
ORDER BY ordem, item;
