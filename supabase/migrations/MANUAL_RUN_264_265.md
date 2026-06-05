# Execução manual — migrations 264–266 (Supabase SQL Editor)

Use este guia quando o SQL Editor encerrar com **"Connection terminated due to connection timeout"**.

## Por que estoura timeout?

| Migration | Causa provável |
|-----------|----------------|
| **264** | Poucas linhas (~8 fases), mas **locks** em `kanban_fases` (app em uso) ou script **264+265 colados juntos**. Texto das instruções **não** é o gargalo. |
| **265 (antiga)** | `DO $$ … LOOP` em `kanban_cards` (tabela grande) + joins em `kanban_card_vinculos` + `processo_step_one` numa única conexão. |
| **265b–d** | Menor, mas ainda pode precisar **re-executar** várias vezes. |
| **266** | **Recomendado no editor:** 1 UPDATE = 1 clique em Run, sem loops. |

**Regras gerais**

1. Rode **fora do horário de pico** se possível.
2. **Nunca** cole 264 + 265 no mesmo Run.
3. Prefira **Run selected** (bloco `-- PART`) em vez de Run no arquivo inteiro.
4. Cada Run = transação curta; se travar, espere 1–2 min e tente de novo.

---

## Ordem — Migration 264 (Funil Moní Capital)

Arquivo: `264_funil_moni_capital_fases_instrucoes.sql`

| Passo | Bloco | O que faz |
|-------|-------|-----------|
| 1 | **PART 1** | Cria kanban se não existir |
| 2 | **PART 2a** | Slugs legados → temporários `_tmp_*` |
| 3 | **PART 2b** | `_tmp_*` → slugs finais |
| 4 | **PART 2c** | Idempotente (pule se 2a/2b já rodaram) |
| 5 | **PART 3** | Nomes, ordem, SLA |
| 6 | **PART 4** | Insere fases novas (informações + formalização) |
| 7 | **PART 5a–5h** | Uma instrução por fase (8 UPDATEs separados) |

**Conferência rápida após 264:**

```sql
SELECT kf.slug, kf.nome, kf.ordem, kf.sla_dias,
       left(kf.instrucoes, 40) AS instrucoes_preview
FROM public.kanban_fases kf
JOIN public.kanbans k ON k.id = kf.kanban_id
WHERE k.nome = 'Funil Moní Capital'
ORDER BY kf.ordem;
```

Deve listar 8 fases com slugs `capital_*` e instruções preenchidas.

---

## Ordem — Migration 265 / 266 (reparo `rede_franqueado_id`)

### Opção A — Ultra-leve (recomendada no SQL Editor)

Arquivo: `266_reparar_franqueado_ultra_light.sql`

| Passo | Bloco | Ação |
|-------|-------|------|
| 1 | **266a** | Índice parcial (1×) |
| 2 | **266b** | Run → verificação `pendentes_origem` → **repita 266b** até **0** |
| 3 | **266c1** e **266c2** | Alterne Run até `pendentes_vinculos` = **0** |
| 4 | **266d** | Run → verificação `pendentes_processo` → **repita** até **0** |

### Opção B — DO com lotes de 100 (menos cliques, mais risco de timeout)

| Arquivo | Ação |
|---------|------|
| `265_reparar_franqueado_batched_idempotent.sql` | Índice (1×) |
| `265b_reparar_franqueado_origem_card.sql` | Re-execute **PART A** até `pendentes_origem = 0` |
| `265c_reparar_franqueado_vinculos.sql` | Re-execute **PART B** até `pendentes_vinculos = 0` |
| `265d_reparar_franqueado_processo_step_one.sql` | Re-execute **PART C** até `pendentes_processo = 0` |

Todas são **idempotentes** (não sobrescrevem `rede_franqueado_id` já preenchido).

---

## Ordem completa sugerida

1. Concluir **264** (PART 1 → 5h).
2. **266a** (índice).
3. **266b** em loop até `pendentes_origem = 0`.
4. **266c1/266c2** em loop até `pendentes_vinculos = 0`.
5. **266d** em loop até `pendentes_processo = 0`.

Se a 262 antiga parou no meio, pode pular etapas já concluídas — as verificações indicam o que falta.

---

## Registro no histórico Supabase (opcional)

Após aplicar manualmente em produção, marque no dashboard ou via CLI para o próximo `db push` não reexecutar:

```sql
INSERT INTO supabase_migrations.schema_migrations (version)
VALUES
  ('264'),
  ('265'),
  ('266')
ON CONFLICT DO NOTHING;
```

(Ajuste conforme versões já registradas no projeto.)
