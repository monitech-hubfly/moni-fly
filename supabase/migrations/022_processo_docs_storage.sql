-- Bucket para PDFs Score & Batalha (Etapa 7).
-- Path: {processo_id}/score-batalha.pdf
-- Usuários autenticados podem fazer upload, ler, atualizar e deletar.
--
-- Se CREATE POLICY falhar (ex.: "must be owner of table objects"),
-- crie as 4 políticas pelo Dashboard: Storage → processo-docs → Policies.
-- Ver: docs/STORAGE_PROCESSO_DOCS_POLICIES.md

-- Criar bucket se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('processo-docs', 'processo-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Política de upload para usuários autenticados
CREATE POLICY "Usuários autenticados podem fazer upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'processo-docs');

-- Política de leitura para usuários autenticados
CREATE POLICY "Usuários autenticados podem ler"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'processo-docs');

-- Política de update (para sobrescrever o PDF ao gerar novamente)
CREATE POLICY "Usuários autenticados podem atualizar"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'processo-docs');

-- Política de delete para usuários autenticados
CREATE POLICY "Usuários autenticados podem deletar"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'processo-docs');
