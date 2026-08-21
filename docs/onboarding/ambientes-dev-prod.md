# Ambientes DEV e PROD

> Domínio: onboarding

## Supabase

| | DEV | PROD |
|---|-----|------|
| Host | `bgaadvfucnrkpimaszjv.supabase.co` | `aydryzoxqnwnbybvgiug.supabase.co` |
| Uso | Desenvolvimento, migrations novas | Franqueados reais |
| Regra | Pode resetar dados de teste | **Nunca alterar sem confirmação explícita** |

## Migrations

1. Escrever SQL idempotente em `supabase/migrations/`
2. Aplicar em DEV
3. `NOTIFY pgrst, 'reload schema'`
4. PR + revisão → aplicar em PROD sob controle

## Variáveis

Ver `.env.local.example` — Supabase, Resend, Autentique, Apify (quando usado).


