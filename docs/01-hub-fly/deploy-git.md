# Deploy, Git e Workflow

> Domínio: 01-hub-fly

## Funcionalidade

Fluxo de desenvolvimento com branches por feature, PRs para revisão e deploy Next.js + Supabase.

## Objetivo

Integrar mudanças com segurança (DEV primeiro, PROD sob controle).

## Onde funciona

| Contexto | Detalhe |
|----------|---------|
| Branch de trabalho | `funcionalidade-danilo` / `funcionalidade-ingrid` (ver regras ativas) |
| PRs | Revisão Ingrid antes de merge em `main` |
| App | `npm run dev` local; deploy conforme pipeline do projeto |

## Setup local

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Variáveis: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `RESEND_API_KEY` (e-mail).

## Commits

- Mensagens em português ou inglês conforme padrão do PR
- Não commitar `.env` ou secrets

## Próximas melhorias

- [ ] Documentar pipeline CI/CD e URLs de preview
<!-- TODO: URLs Vercel / ambiente staging -->


