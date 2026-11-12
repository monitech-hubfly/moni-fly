-- Adiciona campos para o Livro do Empreendimento na tabela condominios.
-- Estes campos armazenam conteúdo extraído do site do condomínio (scraping pré-cacheado).
-- Aplicado em DEV em 2026-11-05 via MCP Supabase.

ALTER TABLE condominios
  ADD COLUMN IF NOT EXISTS site_url                  text,
  ADD COLUMN IF NOT EXISTS livro_foto_principal       text,
  ADD COLUMN IF NOT EXISTS livro_foto_secundaria      text,
  ADD COLUMN IF NOT EXISTS livro_frase_principal      text,
  ADD COLUMN IF NOT EXISTS livro_frase_secundaria     text,
  ADD COLUMN IF NOT EXISTS livro_subtitulo            text,
  ADD COLUMN IF NOT EXISTS livro_vantagens_localizacao jsonb DEFAULT '[]'::jsonb;

-- livro_vantagens_localizacao: array de { icone: string, texto: string }
-- Exemplo: [{"icone":"pin","texto":"Próximo ao centro comercial"}]

NOTIFY pgrst, 'reload schema';
