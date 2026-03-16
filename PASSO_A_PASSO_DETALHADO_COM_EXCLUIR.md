# Passo a passo detalhado — O que fazer (incluindo excluir ou substituir)

Este guia explica **exatamente** o que executar, **em que ordem**, e **o que excluir ou substituir** se você já rodou migrações antigas ou se algo der errado.

---

## Antes de começar: qual é a sua situação?

Escolha **uma** das opções abaixo. O passo a passo depende disso.

| Situação | O que fazer |
|----------|-------------|
| **A)** Nunca rodei nenhuma migração do projeto (banco novo ou projeto novo) | Siga a **Ordem recomendada** na seção 1. |
| **B)** Já rodei as migrações 001, 002, 003, 004 e 005 (e talvez 006) | Você **não** precisa excluir nada à mão. Rode só a **007** (ela remove a tabela antiga `casas_escolhidas` e cria `catalogo_escolhidos`). Siga a partir do **Passo 1.2**. |
| **C)** Já rodei a 007 e quero só conferir o fluxo na tela | Vá direto para a **Seção 2** (subir o sistema e testar). |
| **D)** Deu erro e quero saber o que excluir ou substituir | Veja a **Seção 4** (Excluir ou substituir) e depois repita o passo que falhou. |

---

## 1. Migrações no Supabase — Ordem e o que NÃO rodar

### Ordem recomendada (se estiver aplicando tudo do zero)

Rode **nesta ordem** no SQL Editor do Supabase (cada arquivo em uma execução):

1. **001_initial_schema.sql**
2. **002_idempotent_schema.sql**
3. **003_fix_rls_recursion_profiles.sql**
4. **004_sprint4_listings_catalogo_lote.sql**
5. **005_batalhas_etapa8.sql**
6. **007_catalogo_escolhidos.sql**

**Importante:** **NÃO** rode o arquivo **006_casas_escolhidas.sql**. A lógica mudou: em vez de “3 casas ZAP” usamos “3 modelos do catálogo”. A **007** já faz o que precisamos (e remove a tabela da 006, se existir). Ou seja:

- **Substituir:** a ideia da **006** (escolher 3 casas ZAP) foi **substituída** pela **007** (escolher 3 modelos do catálogo). Use só a **007**.

---

### Passo 1.1 — Abrir o SQL Editor no Supabase

1. Acesse **https://supabase.com** e faça login.
2. Abra o **projeto** do Viabilidade.
3. No menu da esquerda, clique em **SQL Editor**.
4. Clique em **+** (Nova consulta).

---

### Passo 1.2 — Rodar a migração 007 (obrigatória para a Etapa 8)

A 007 **exclui** a tabela antiga `casas_escolhidas` (se existir) e **cria** a tabela `catalogo_escolhidos`.

1. No seu PC, abra a pasta do projeto:
   - **Explorador de Arquivos** → **OneDrive** → **Área de Trabalho** → **VIABILIDADE** → **supabase** → **migrations**
2. Abra o arquivo **007_catalogo_escolhidos.sql** (botão direito → **Abrir com** → **Bloco de notas**).
3. Selecione **todo** o conteúdo (**Ctrl+A**) e copie (**Ctrl+C**).
4. No **SQL Editor** do Supabase, apague qualquer texto na caixa e **cole** (**Ctrl+V**).
5. Clique em **Run**.
6. Confira: deve aparecer mensagem em **verde** (ex.: **Success**).

**Se você já tinha rodado a 006:**

- A 007 executa `DROP TABLE IF EXISTS public.casas_escolhidas;` → a tabela **casas_escolhidas** é **excluída**.
- Em seguida cria **catalogo_escolhidos**. Não é preciso excluir `casas_escolhidas` manualmente.

**Se der erro “relation catalogo_escolhidos already exists”:**

- A tabela já existe. Você pode **ignorar** e seguir para a Seção 2, ou **substituir** tudo: veja a **Seção 4.1** (como dropar e rodar de novo).

---

## 2. Subir o sistema e testar no navegador

### Passo 2.1 — Subir o servidor

1. Abra o **PowerShell** na pasta **VIABILIDADE**:
   - **Explorador de Arquivos** → OneDrive → Área de Trabalho → **VIABILIDADE**
   - Clique na **barra de endereço**, digite **powershell** e aperte **Enter**
2. Digite:
   ```text
   npm run dev
   ```
   e aperte **Enter**.
3. Espere aparecer **"✓ Ready"** e o endereço (ex.: **http://localhost:3000**).
4. Deixe a janela do PowerShell **aberta**.

---

### Passo 2.2 — Login e Estado (UF)

1. No navegador, acesse **http://localhost:3000** (ou a porta que apareceu).
2. Clique em **Entrar** e informe **e-mail** e **senha**.
3. Ao **criar um novo processo** (Iniciar Step One):
   - **Cidade:** nome do município (ex.: Campinas).
   - **Estado (UF):** escolha na **lista** (ex.: **SP — São Paulo**). Não digite à mão; use o dropdown para o IBGE funcionar na Etapa 1.

---

### Passo 2.3 — Etapa 1 (dados do IBGE)

1. **Meus processos** → abra um processo.
2. Clique em **Etapa 1 — Análise da praça**.
3. Clique em **"Buscar dados do IBGE"**.
4. Confira se aparecem **Município**, **Região**, **Microrregião**, etc.
5. (Opcional) Preencha a **narrativa** e clique em **Salvar**.

Se der “Município não encontrado”, veja **Seção 4.2** (ajustar estado/cidade).

---

### Passo 2.4 — Etapas 4 e 5 (só conferir texto)

1. **Etapa 4:** confira se aparece o texto sobre listagem manual e Apify em breve.
2. **Etapa 5:** idem.

Nada para excluir ou substituir aqui; é só conferência.

---

### Passo 2.5 — Etapa 8 (3 modelos do catálogo e batalhas)

1. Tenha **pelo menos uma casa** na **Etapa 4** (todas as casas ZAP entram nas batalhas).
2. Tenha **pelo menos 3 modelos** no catálogo (Etapa 6 / tabela **catalogo_casas** no Supabase). Se tiver só 2, **adicione mais um modelo** no Supabase.
3. Abra **Etapa 8 — Batalhas**.
4. **Se aparecer a tela “Escolha 3 modelos do catálogo Moní”:**
   - Selecione **Modelo 1**, **Modelo 2** e **Modelo 3** nos dropdowns (cada um diferente).
   - Clique em **"Salvar 3 modelos escolhidos"**.
5. Depois disso devem aparecer **todas as casas ZAP**; para cada uma, 3 blocos (um por modelo escolhido) com Preço, Produto e Localização (-2 a +2). Preencha; as notas **salvam sozinhas**.

Se a Etapa 8 der erro de tabela, veja **Seção 4.1**. Se faltar modelo no catálogo, veja **Seção 4.3**.

---

## 3. Resumo em tabela (ordem de execução)

| Ordem | O que fazer |
|-------|-------------|
| 1 | **Supabase** → SQL Editor → colar e rodar **007_catalogo_escolhidos.sql**. **Não** rodar 006. |
| 2 | **PowerShell** na pasta VIABILIDADE → `npm run dev` → deixar aberto. |
| 3 | **Navegador** → localhost:3000 → **Entrar**. |
| 4 | **Iniciar processo** → Cidade + **Estado (UF)** pela lista. |
| 5 | **Etapa 1** → **Buscar dados do IBGE** → Salvar (e narrativa se quiser). |
| 6 | **Etapa 4** e **5** → conferir texto Apify. **Etapa 4** → ter pelo menos 1 casa. |
| 7 | **Etapa 6** → ter pelo menos 3 modelos no catálogo. |
| 8 | **Etapa 8** → escolher 3 modelos do catálogo → Salvar → preencher batalhas (todas as casas ZAP × 3 modelos). |

---

## 4. Excluir ou substituir — Quando e como

### 4.1 — Excluir a tabela catalogo_escolhidos para rodar a 007 de novo

Use só se a 007 já foi aplicada e você quer **recriar** a tabela (por exemplo, depois de alterar o arquivo 007).

1. No Supabase, abra **SQL Editor** → Nova consulta.
2. Cole e execute:
   ```sql
   DROP TABLE IF EXISTS public.catalogo_escolhidos;
   ```
3. Depois rode de novo **todo** o conteúdo do arquivo **007_catalogo_escolhidos.sql**.

**Atenção:** isso **apaga** todas as escolhas de “3 modelos” já salvas. Os usuários terão de escolher de novo na Etapa 8.

---

### 4.2 — Substituir o Estado (UF) de processos já criados

Se o processo foi criado com estado em texto (ex.: “São Paulo”) e o IBGE não encontra o município:

1. No Supabase, vá em **Table Editor** → **processo_step_one**.
2. Localize a linha do processo (pela cidade ou pelo id).
3. Na coluna **estado**, **substitua** o valor por a **sigla** (ex.: **SP**, **RJ**, **MG**).
4. Salve (se o editor tiver botão Save/Apply).

Ou, em **SQL Editor**, execute (troque **SP** e o **id** do processo pelos corretos):

```sql
UPDATE public.processo_step_one
SET estado = 'SP'
WHERE id = 'uuid-do-processo';
```

---

### 4.3 — Incluir mais modelos no catálogo (para poder escolher 3 na Etapa 8)

Se aparecer “O catálogo Moní precisa ter pelo menos 3 modelos”:

1. No Supabase, **Table Editor** → **catalogo_casas**.
2. Clique em **Insert row** (ou **Add row**).
3. Preencha pelo menos: **nome**, **ativo = true**. Opcional: area_m2, quartos, preco_venda, etc.
4. Salve.

Ou use o **SQL Editor** com um INSERT (ajuste os valores):

```sql
INSERT INTO public.catalogo_casas (nome, area_m2, quartos, preco_venda, ativo)
VALUES ('Modelo C', 200, 4, 1800000, true);
```

Assim você **adiciona** um modelo; não precisa excluir nada.

---

### 4.4 — Excluir a tabela antiga casas_escolhidas à mão (só se a 007 falhar no DROP)

Se por algum motivo a 007 não rodar e der erro em cima de `casas_escolhidas`:

1. **SQL Editor** → Nova consulta.
2. Execute:
   ```sql
   DROP TABLE IF EXISTS public.casas_escolhidas;
   ```
3. Depois rode de novo **todo** o **007_catalogo_escolhidos.sql**.

---

### 4.5 — Limpar as escolhas dos 3 modelos (só os dados, mantendo a tabela)

Para um processo específico “esquecer” os 3 modelos escolhidos (e voltar à tela de seleção na Etapa 8):

1. **SQL Editor**:
   ```sql
   DELETE FROM public.catalogo_escolhidos
   WHERE processo_id = 'uuid-do-processo';
   ```
   Troque `uuid-do-processo` pelo **id** real do processo.

A tabela **catalogo_escolhidos** continua existindo; só os registros daquele processo são **excluídos**.

---

## 5. Erros comuns e o que fazer

| Erro ou situação | O que fazer |
|------------------|-------------|
| **"relation catalogo_escolhidos does not exist"** | Rodar a **007** no SQL Editor (Passo 1.2). |
| **"relation casas_escolhidas does not exist"** | Normal se você **nunca** rodou a 006. Ignore e use só a 007. Se a 007 falhar, veja **4.4**. |
| **Etapa 1 — "Município não encontrado"** | Ajustar **Estado** para **UF** (2 letras) no processo. Ver **4.2**. |
| **Etapa 8 — "Nenhuma casa listada na Etapa 4"** | Cadastrar pelo menos **uma** casa na Etapa 4. |
| **Etapa 8 — "O catálogo Moní precisa ter pelo menos 3 modelos"** | Incluir mais modelos em **catalogo_casas**. Ver **4.3**. |
| **Etapa 8 — Erro ao salvar os 3 modelos** | Confirmar que a **007** foi aplicada e que está logado no sistema. |
| **Quero refazer a tabela catalogo_escolhidos** | Ver **4.1** (DROP e rodar 007 de novo). |

---

## 6. Checklist final

- [ ] Migração **007** rodada no Supabase (e **006** não usada).
- [ ] `npm run dev` rodando e tela abrindo no navegador.
- [ ] Login feito.
- [ ] Processo criado com **Estado (UF)** escolhido na lista.
- [ ] Etapa 1 — **Buscar dados do IBGE** funcionando.
- [ ] Etapa 4 com pelo menos 1 casa; Etapa 6 com pelo menos 3 modelos.
- [ ] Etapa 8 — 3 modelos do catálogo escolhidos e salvos; batalhas aparecendo (todas as casas ZAP × 3 modelos).

Quando todos os itens estiverem marcados, o fluxo está completo e você não precisa excluir nem substituir nada além do que está neste guia.
