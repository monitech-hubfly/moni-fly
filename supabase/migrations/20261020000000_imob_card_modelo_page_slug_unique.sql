-- Garante unicidade do slug de jornada pública por empreendimento.
-- Constraint já aplicada em DEV e PROD via MCP em 2026-10-20;
-- este arquivo registra a migration no repositório para rastreabilidade.
ALTER TABLE imob_card_modelo
  ADD CONSTRAINT imob_card_modelo_page_slug_unique UNIQUE (page_slug);
