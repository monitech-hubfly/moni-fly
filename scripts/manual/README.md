# Execução manual — migrations 263–266 (sem timeout)

Use este guia **agora** no **Supabase SQL Editor** quando arquivos inteiros derem *"Connection terminated due to connection timeout"*.

Cada arquivo em `scripts/manual/` contém **exatamente 1 statement** (< 2 s em condições normais).

**Status atual (você):**
- ✅ **265c / vínculos** — concluído (`pendentes_vinculos = 0`)
- ⏳ **264** — fases Moní Capital
- ⏳ **Reparo franqueado** — origem + processo_step_one
- ⏳ **263** — portfólio (opcional)

---

## Regras de ouro

1. **1 arquivo = 1 clique em Run** (não cole vários arquivos juntos).
2. Rode **fora do horário de pico** se possível.
3. Se der timeout, espere 1–2 min e repita o **mesmo** arquivo.
4. **Nunca** misture 264 + reparo franqueado no mesmo Run.

---

## Passo 0 — Diagnóstico (antes da 264)

Abra `diag_antes_264.sql`, cole no SQL Editor e execute:

```sql
-- trecho principal (arquivo completo tem também pg_stat_activity)
SELECT count(*) AS fases_moni_capital
FROM public.kanban_fases
WHERE kanban_id = '724aef36-37de-4454-bf6f-ec481693aeeb';
```

- Se `pg_stat_activity` mostrar queries longas em `kanban_fases`, **aguarde** ou rode fora do pico.
- Anote o `count` — após a 264 deve ser **8**.

---

## Passo 1 — Migration 264 (Funil Moní Capital)

Execute **na ordem**, um arquivo por vez:

| # | Arquivo | O que faz |
|---|---------|-----------|
| 1 | `264_part_01.sql` | Cria kanban se não existir |
| 2 | `264_part_02.sql` | `capital_elegibilidade` → `_tmp_…` |
| 3 | `264_part_03.sql` | `capital_estruturacao` → `_tmp_…` |
| 4 | `264_part_04.sql` | `capital_ativo` → `_tmp_…` |
| 5 | `264_part_05.sql` | `_tmp_elegibilidade` → `capital_abertura_spe` |
| 6 | `264_part_06.sql` | `_tmp_estruturacao` → `capital_cadastro_plataforma` |
| 7 | `264_part_07.sql` | `_tmp_ativo` → `capital_materiais_projeto` |
| 8–10 | `264_part_08.sql` … `10.sql` | Idempotente (pule se 02–07 OK) |
| 11–18 | `264_part_11.sql` … `18.sql` | Nome, ordem e SLA (1 fase cada) |
| 19–20 | `264_part_19.sql`, `20.sql` | Insere fases novas se faltarem |
| 21–28 | `264_part_21.sql` … `28.sql` | Placeholder `—` nas instruções |

**Conferência:** execute `diag_conferir_264.sql` — 8 fases `capital_*` com ordem 1–8.

### Instruções completas (opcional, depois)

Se parts 21–28 rodaram, complete o texto quando quiser (1 arquivo = 1 fase):

| Arquivo |
|---------|
| `264_instrucoes_01_recebimento.sql` |
| `264_instrucoes_02_abertura_spe.sql` |
| `264_instrucoes_03_cadastro_plataforma.sql` |
| `264_instrucoes_04_materiais_projeto.sql` |
| `264_instrucoes_05_informacoes_obrigatorias.sql` |
| `264_instrucoes_06_formalizacao.sql` |
| `264_instrucoes_07_concluido.sql` |
| `264_instrucoes_08_nao_elegivel.sql` |

---

## Passo 2 — Índice (acelera reparo origem)

| Onde | Arquivo |
|------|---------|
| **SQL Editor** | `266_index.sql` (`CREATE INDEX IF NOT EXISTS`, sem CONCURRENTLY) |
| **psql / DATABASE_URL** | `266_index_concurrently.sql` — **fora de transação**; pule se `266_index.sql` já rodou |

> `CREATE INDEX CONCURRENTLY` **não** funciona no SQL Editor (roda em transação). Use `266_index.sql` no dashboard.

---

## Passo 3 — Reparo franqueado (265b + 265d / 266b + 266d)

**Vínculos (265c): já feito — não rode de novo.**

### 3a — Cadeia `origem_card_id`

1. Execute `count_pendentes_origem.sql` → anote `pendentes_origem`.
2. Enquanto **> 0**:
   - Run `repair_franqueado_origem.sql` (atualiza **até 25** linhas)
   - Run `count_pendentes_origem.sql` de novo
3. Meta: `pendentes_origem = 0`.

### 3b — `processo_step_one`

1. Execute `count_pendentes_processo.sql`.
2. Enquanto **> 0**:
   - Run `repair_franqueado_processo.sql` (até **25** linhas)
   - Run `count_pendentes_processo.sql`
3. Meta: `pendentes_processo = 0`.

Todos os UPDATEs são **idempotentes** (não sobrescrevem valor já preenchido).

---

## Passo 4 — Migration 263 portfólio (opcional)

Se nomes/SLA do Funil Portfólio ainda não foram aplicados, rode na ordem:

`263_portfolio_part_01.sql` → … → `263_portfolio_part_10.sql`

(1 fase por arquivo.)

---

## Alternativa — CLI / psql (sem SQL Editor)

### Supabase CLI

Na raiz do repo, com projeto linkado:

```bash
npx supabase db push
```

Isso aplica migrations pendentes com timeout maior que o SQL Editor. **Cuidado em produção** — teste em staging primeiro se possível.

### psql com DATABASE_URL

Connection string em *Project Settings → Database*:

```bash
# Windows PowerShell — exemplo: um arquivo
$env:DATABASE_URL = "postgresql://postgres.[ref]:[SENHA]@aws-0-[regiao].pooler.supabase.com:6543/postgres"
psql $env:DATABASE_URL -f scripts/manual/264_part_01.sql
```

Rodar a 264 inteira em sequência (PowerShell):

```powershell
1..28 | ForEach-Object { $n = "{0:D2}" -f $_; psql $env:DATABASE_URL -f "scripts/manual/264_part_$n.sql" }
Get-ChildItem scripts/manual/264_instrucoes_*.sql | Sort-Object Name | ForEach-Object { psql $env:DATABASE_URL -f $_.FullName }
```

Loop reparo origem:

```powershell
while ($true) {
  psql $env:DATABASE_URL -f scripts/manual/repair_franqueado_origem.sql
  $c = psql $env:DATABASE_URL -t -c "SELECT count(*) FROM kanban_cards f INNER JOIN kanban_cards p ON f.origem_card_id = p.id WHERE f.rede_franqueado_id IS NULL AND p.rede_franqueado_id IS NOT NULL"
  if ([int]$c.Trim() -eq 0) { break }
}
```

---

## Registrar no histórico Supabase (opcional)

Após aplicar manualmente em produção, evite reexecução no próximo `db push`:

```sql
INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('263'), ('264'), ('265'), ('266')
ON CONFLICT DO NOTHING;
```

(Ajuste conforme versões já registradas no projeto.)

---

## Ordem resumida (copiar checklist)

- [ ] `diag_antes_264.sql`
- [ ] `264_part_01.sql` … `264_part_28.sql` (em ordem)
- [ ] `diag_conferir_264.sql`
- [ ] `264_instrucoes_*.sql` (opcional)
- [ ] `266_index.sql`
- [ ] `repair_franqueado_origem.sql` em loop + `count_pendentes_origem.sql` → **0**
- [ ] `repair_franqueado_processo.sql` em loop + `count_pendentes_processo.sql` → **0**
- [ ] `263_portfolio_part_*.sql` (opcional)
- [ ] `schema_migrations` (opcional)

Guia legado (blocos no arquivo único): `supabase/migrations/MANUAL_RUN_264_265.md`
