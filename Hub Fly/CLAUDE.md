AMBIENTE LOCAL — CONFIGURAÇÃO DO DEV
Branch de trabalho da Ingrid: funcionalidade-ingrid
Projeto local: C:\Dev\moni-fly (Windows/PowerShell)
Banco DEV: bgaadvfucnrkpimaszjv.supabase.co (projeto "viabilidade-dev" na org Monitech Hubfly)
Banco PROD: aydryzoxqnwnbybvgiug.supabase.co (projeto "viabilidade-prod")
.env.local deve apontar para DEV:

NEXT_PUBLIC_SUPABASE_URL=https://bgaadvfucnrkpimaszjv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY= (chave anon do projeto DEV)

Para rodar localmente: npm install → npm run dev → http://localhost:3000
Quando um novo usuário for configurar o DEV pela primeira vez:

Inserir perfil manualmente na tabela profiles do banco DEV (a tabela começa vazia)
Rodar no SQL Editor do Supabase DEV: GRANT USAGE ON SCHEMA public TO authenticated, anon; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated; GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

