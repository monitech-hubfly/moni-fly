# Passo a passo — Ajuste da migração 002 (evitar recursão em profiles)

Este guia explica **como aplicar** o ajuste que evita o erro *"infinite recursion detected in policy for relation 'profiles'"*. Há **duas situações**; escolha a que vale para você.

---

## O que foi ajustado

- **Antes:** As policies "Admin can read all profiles" e "Consultor can read Franks in portfolio" faziam `EXISTS (SELECT 1 FROM public.profiles ...)`. Ao avaliar quem pode ler `profiles`, o banco lia `profiles` de novo → **recursão infinita**.
- **Depois:** Foi criada a função **`get_my_role()`** (SECURITY DEFINER), que lê o `role` do usuário **sem** passar pelo RLS. As duas policies passaram a usar **`get_my_role()`** em vez de consultar `profiles` dentro da policy → **sem recursão**.

O arquivo **002_idempotent_schema.sql** no projeto já foi alterado para incluir essa lógica. Falta só **aplicar** no Supabase de uma das formas abaixo.

---

## Situação A — Você ainda vai rodar as migrações do zero (ou só rodou a 001)

Use esta opção se você **ainda não** rodou a 002, ou se está montando o banco do zero.

### Passo a passo

1. **Abra o Supabase**
   - Acesse **https://supabase.com** no navegador.
   - Faça login e abra o **projeto** do Viabilidade.

2. **Abra o SQL Editor**
   - No menu da esquerda, clique em **SQL Editor**.
   - Clique no botão **+** (Nova consulta) para abrir uma nova aba.

3. **Abra a pasta das migrações no seu PC**
   - **Explorador de Arquivos** → **OneDrive** → **Área de Trabalho** → **VIABILIDADE** → **supabase** → **migrations**

4. **Rode as migrações nesta ordem** (uma por vez):

   **4.1 — Migração 001**
   - Abra o arquivo **001_initial_schema.sql** (botão direito → Abrir com → Bloco de notas).
   - Selecione todo o conteúdo (**Ctrl+A**) e copie (**Ctrl+C**).
   - No SQL Editor do Supabase, cole (**Ctrl+V**) e clique em **Run**.
   - Espere a mensagem em verde (Success). Se der "relation already exists", pode ter sido aplicada antes; siga para a próxima.

   **4.2 — Migração 002 (já com o ajuste de recursão)**
   - Abra o arquivo **002_idempotent_schema.sql**.
   - **Ctrl+A** e **Ctrl+C**.
   - No SQL Editor, **apague** o que estiver na caixa, cole o conteúdo da 002 e clique em **Run**.
   - Essa 002 já cria a função **get_my_role()** e as policies de **profiles** que usam ela (sem recursão).

   **4.3 — Migração 003**
   - Abra **003_fix_rls_recursion_profiles.sql**, copie tudo, no Editor apague, cole e **Run**.

   **4.4 — Migração 004**
   - Abra **004_sprint4_listings_catalogo_lote.sql**, copie tudo, no Editor apague, cole e **Run**.

   **4.5 — Migração 005**
   - Abra **005_batalhas_etapa8.sql**, copie tudo, no Editor apague, cole e **Run**.

   **4.6 — Migração 007**
   - Abra **007_catalogo_escolhidos.sql**, copie tudo, no Editor apague, cole e **Run**.
   - **Não** rode o **006_casas_escolhidas.sql**.

5. **Conferir**
   - No Supabase, vá em **Table Editor** e confira se as tabelas existem (ex.: **profiles**, **processo_step_one**).
   - Abra o app (Iniciar Processo Step One), preencha cidade e estado e clique em **Iniciar processo**. **Não** deve aparecer o erro de recursão em profiles.

---

## Situação B — Você já rodou a 002 antiga e está com o erro de recursão

Use esta opção se você **já** aplicou a 001 e a 002 (na versão antiga, sem `get_my_role()`) e ao clicar em **Iniciar processo** aparece *"infinite recursion detected in policy for relation 'profiles'"*.

Aqui você **não** precisa rodar a 002 inteira de novo. Só precisa **corrigir** a tabela **profiles**: criar a função e trocar as duas policies.

### Passo a passo

1. **Abra o Supabase**
   - Acesse **https://supabase.com** e abra o **projeto** do Viabilidade.

2. **Abra o SQL Editor**
   - Menu da esquerda → **SQL Editor** → **+** (Nova consulta).

3. **Abra o script de correção no seu PC**
   - **Explorador de Arquivos** → **OneDrive** → **Área de Trabalho** → **VIABILIDADE** → **supabase**
   - Abra o arquivo **CORRIGIR_RECURSAO_PROFILES.sql** (botão direito → Abrir com → Bloco de notas).

4. **Copie todo o conteúdo**
   - **Ctrl+A** e **Ctrl+C**.

5. **Cole no SQL Editor e execute**
   - No SQL Editor do Supabase, apague qualquer texto na caixa.
   - **Ctrl+V** para colar.
   - Clique em **Run** (ou use o atalho indicado na tela).

6. **Confirme o resultado**
   - Deve aparecer mensagem em **verde** (ex.: Success). Isso significa que:
     - A função **get_my_role()** foi criada (ou atualizada).
     - As policies "Admin can read all profiles" e "Consultor can read Franks in portfolio" foram recriadas usando **get_my_role()**, sem leitura direta em **profiles** na policy.

7. **Teste no app**
   - Volte à aba do sistema (Iniciar Processo Step One).
   - Dê **F5** para recarregar a página.
   - Preencha **Cidade** e **Estado (UF)** e clique em **Iniciar processo**.
   - O erro de recursão **não** deve mais aparecer.

---

## Resumo

| Situação | O que fazer |
|----------|-------------|
| **A** — Ainda vai rodar migrações (ou só rodou 001) | Rodar **001**, depois **002** (já ajustada no projeto), depois **003**, **004**, **005**, **007**, nessa ordem. A 002 já inclui `get_my_role()` e as policies sem recursão. |
| **B** — Já rodou 002 antiga e está com erro de recursão | Rodar **só** o conteúdo do arquivo **supabase/CORRIGIR_RECURSAO_PROFILES.sql** no SQL Editor. Depois recarregar a página e testar "Iniciar processo". |

Em ambos os casos, o ajuste consiste em: **criar `get_my_role()`** e **usar essa função** nas duas policies de **profiles** ("Admin can read all profiles" e "Consultor can read Franks in portfolio") em vez de `EXISTS (SELECT ... FROM profiles ...)`.
