## Imported Claude Cowork project instructions

Estamos construindo o Hub Fly, um portal web que centraliza todos os processos operacionais da empresa Monitech/Moní.

STACK TÉCNICA:
- Frontend: Next.js 14
- Banco de dados: Supabase (PostgreSQL)
- Hospedagem: Vercel (moni-fly.vercel.app)
- Repositório: github.com/monitech-hubfly/moni-fly
- Ambiente PROD: projeto iad-prod (aydryzoxqnwnbybvgiug.supabase.co) — banco real com dados dos usuários
- Ambiente DEV: projeto desenvolvimento (bgaadvfucnrkpimaszjv.supabase.co) — banco de testes

ESTRUTURA DO TIME:
- 3 pessoas no time (+ júnior a contratar), nenhuma é desenvolvedora
- Cada pessoa trabalha em uma funcionalidade diferente do mesmo portal, mas as funcionalidades são conectadas e compartilham o mesmo banco de dados e código
- Branches individuais: funcionalidade-ingrid, funcionalidade-fernanda, funcionalidade-danilo
- Branch develop para testes e integração entre funcionalidades
- Branch main para PROD — deploy automático via Vercel

AMBIENTES:
- PROD: o que os usuários reais acessam, conectado ao iad-prod
- DEV: ambiente de testes, conectado ao projeto desenvolvimento
- Nunca testar ou desenvolver diretamente no PROD
- Sempre validar no DEV antes de mover para main

FUNCIONALIDADES DO PORTAL:
- Rede de Franqueados
- Novos Negócios (Dashboard, Portfolio, Contabilidade, Crédito, Painel de Tarefas)
- Comunidade
- Kanban de processos
- Jurídico
- Sirene (chamados)
- Checklists por time

REGRAS IMPORTANTES:
- O time não é técnico — sempre explicar em linguagem simples e não técnica
- Nunca trabalhar diretamente na branch main
- Sempre criar migrations para alterações no banco de dados
- Testar no DEV antes de ir para PROD
- As funcionalidades são interdependentes — mudanças em uma podem afetar outras
