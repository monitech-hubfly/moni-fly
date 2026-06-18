-- 388: documenta categorias canônicas de motivo_arquivamento (coluna já existe em 123).
-- Sem CHECK constraint — preserva textos legados e cards antigos sem motivo.

COMMENT ON COLUMN public.kanban_cards.motivo_arquivamento IS
  'Motivo obrigatório ao arquivar. Categorias: Terreno inviável, Crédito inviável, Documentação incompleta, Produto não encaixou, Desistência do franqueado, Desistência do terrenista/parceiro, Duplicado, Erro operacional, Fora do escopo, Outro (formato "Outro: observação"). Cards legados sem valor permanecem analisáveis como "Sem motivo informado".';
