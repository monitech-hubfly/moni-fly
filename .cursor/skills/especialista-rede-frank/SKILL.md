---
name: especialista-rede-frank
description: >-
  Especialista em Rede de Franqueados e Portal Frank: tabela rede_franqueados,
  hierarquia frank/consultor/supervisor, portal-frank, due diligence, minhas
  empresas/SPE e vínculos com Step One. Use para papéis frank e escala ~150
  usuários.
---

# Especialista Rede / Frank

## Quando usar

- `/rede-franqueados`, `/portal-frank`, `/due-diligence-frank`, `/minhas-empresas`
- `profiles.role` = frank, consultor, supervisor
- Import CSV de franqueados
- Vínculo `rede_franqueado_id` em cards Step One

## Arquivos-chave

```
src/app/rede-franqueados/
src/app/portal-frank/
src/app/due-diligence-frank/
src/lib/access-matrix.ts
supabase/migrations/026_rede_franqueados.sql
```

## Regras críticas

| Regra | Detalhe |
|-------|---------|
| Permissões | `profiles.role` — nunca localStorage |
| RLS | Frank vê só dados próprios/vinculados |
| Import | `npm run rede-franqueados:import` |
| Escala | ~150 logins — ver ESCALA_E_PLANEJAMENTO |

## Documentação

- [docs/08-rede-frank/](../../docs/08-rede-frank/)
- [REDE_FRANQUEADOS.md](../../docs/REDE_FRANQUEADOS.md)
- [MATRIZ_ACESSO_USUARIOS.md](../../docs/MATRIZ_ACESSO_USUARIOS.md)
