-- 665: ajusta a pergunta e a resposta da entrada de até 30% na aquisição de terreno.
-- Idempotente. DEV primeiro. PROD somente com confirmação explícita.

UPDATE public.faq_articles
SET
  question = 'Como funcionam a entrada de até 30%, o saldo de 70% e a remuneração de 15% ao ano em uma aquisição de terreno?',
  answer = 'Em uma das estruturas possíveis de aquisição, até 30% do Valor Base do Lote são pagos na escritura, e o saldo de 70% restantes são quitados na venda do imóvel ou até o prazo máximo contratual, de 24 meses no exemplo apresentado. Sobre o saldo devedor incidem juros compostos de 15% ao ano desde o marco estabelecido no contrato até a quitação. Se houver pagamento antecipado, os juros deixam de incidir sobre a parcela quitada. Trata-se de uma estrutura negociável, não de uma regra obrigatória para todas as operações.'
WHERE question = 'Como funcionam a entrada de 30%, o saldo de 70% e a remuneração de 15% ao ano em uma aquisição de terreno?'
   OR question = 'Como funcionam a entrada de até 30%, o saldo de 70% e a remuneração de 15% ao ano em uma aquisição de terreno?';

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('665', 'faq_entrada_ate_30')
ON CONFLICT (version) DO NOTHING;
