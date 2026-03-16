# Passo a passo detalhado — Etapa 8 (Batalhas) funcionando

A **Etapa 8** compara cada **casa listada na ZAP** (Etapa 4) com cada **casa do catálogo Moní** (Etapa 6) em três frentes: **preço**, **produto** e **localização**, com notas de -2 a +2. Este guia explica como aplicar a migração e testar tudo.

---

## Pré-requisitos

- **Sprint 4** já aplicada: tabelas `listings_casas`, `listings_lotes`, `catalogo_casas` e `lote_escolhido` existem no Supabase (se ainda não fez, siga o arquivo **O_QUE_FAZER_PARA_SPRINT_4_FUNCIONAR.md**).
- Projeto com **variáveis de ambiente** do Supabase configuradas (`.env.local` com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`).

---

## Passo 1 — Rodar a migração SQL da Etapa 8 no Supabase

Sem este passo, a Etapa 8 vai dar erro ao abrir ou ao salvar notas.

1. Abra o navegador e vá em **https://supabase.com**. Faça login e abra o **projeto** do Viabilidade.
2. No menu da esquerda, clique em **SQL Editor**.
3. Clique no **+** (Nova consulta) para abrir uma nova aba.
4. No seu computador, abra a pasta do projeto:
   - **Explorador de Arquivos** → **OneDrive** → **Área de Trabalho** → **VIABILIDADE** → **supabase** → **migrations**
5. Abra o arquivo **005_batalhas_etapa8.sql** (botão direito → **Abrir com** → **Bloco de notas** ou outro editor).
6. Selecione **todo** o conteúdo (**Ctrl+A**) e copie (**Ctrl+C**).
7. Volte ao **SQL Editor** do Supabase, apague qualquer texto na caixa e **cole** o que você copiou (**Ctrl+V**).
8. Clique em **Run** (ou **Run** com atalho indicado).
9. Deve aparecer mensagem em **verde**, por exemplo **"Success. No rows returned"** ou **"Success"**.

**Pronto:** a tabela **batalhas** foi criada, com regras de acesso (RLS). Cada linha guarda as três notas (preço, produto, localização) de um par: uma casa da Etapa 4 × um modelo do catálogo.

---

## Passo 2 — Subir o sistema no seu computador (se ainda não estiver rodando)

1. Abra o **PowerShell** na pasta **VIABILIDADE**:
   - **Explorador de Arquivos** → OneDrive → Área de Trabalho → **VIABILIDADE**
   - Clique na **barra de endereço**, digite **powershell** e aperte **Enter**
2. Se o servidor **não** estiver rodando, digite:
   ```text
   npm run dev
   ```
   e aperte **Enter**. Espere aparecer **"✓ Ready"** e **"Local: http://localhost:3000"** (ou 3001).
3. **Deixe a janela do PowerShell aberta** enquanto usar o sistema.

---

## Passo 3 — Abrir o sistema no navegador e fazer login

1. No navegador, acesse **http://localhost:3000** (ou **http://localhost:3001** se for o seu caso).
2. Se não estiver logada, clique em **Entrar** e informe e-mail e senha.

---

## Passo 4 — Garantir que existem casas na Etapa 4 e modelos no catálogo (Etapa 6)

A Etapa 8 precisa de **pelo menos uma casa** cadastrada na **Etapa 4** e de **pelo menos um modelo** no **catálogo Moní** (Etapa 6).

1. Clique em **Meus processos** e abra **um processo** (ou crie um novo em **Iniciar Step One**).
2. Vá na **Etapa 4 — Listagem casas à venda (ZAP)**.
   - Se já houver casas na lista, está ok.
   - Se não houver: preencha o formulário (ex.: Condomínio **Residencial X**, Preço **1500000**) e clique em **Adicionar casa**. Cadastre pelo menos **uma** casa.
3. Vá na **Etapa 6 — Catálogo casas Moní**.
   - Você deve ver uma tabela com pelo menos **Modelo A** e **Modelo B** (inseridos pela migração da Sprint 4). Se a tabela estiver vazia, confira no Supabase se a tabela **catalogo_casas** tem registros com **ativo = true**.

---

## Passo 5 — Abrir a Etapa 8 e preencher as batalhas

1. Na lista das 11 etapas do processo, clique em **Etapa 8 — Batalhas (preço, produto, localização)**  
   (ou use o link **Próxima etapa** a partir da Etapa 7).
2. Você deve ver:
   - Um texto explicando que, para cada casa listada (ZAP) vs. cada casa do catálogo Moní, deve atribuir uma nota de **-2 a +2** em preço, produto e localização, e que **as alterações são salvas automaticamente**.
   - Para **cada casa ZAP** (da Etapa 4): um bloco com o nome/condomínio da casa e, para **cada modelo do catálogo**, um card com três menus:
     - **Preço** (-2 a +2)
     - **Produto** (-2 a +2)
     - **Local.** (Localização, -2 a +2)
   - Em cada card, ao escolher uma nota, deve aparecer **"Salvando…"** e, em seguida, os dados ficam gravados (sem botão "Salvar").
   - No final de cada bloco de casa ZAP, a **média** dessa casa vs. catálogo (quando houver notas preenchidas).
3. Preencha algumas notas (ex.: Preço **1**, Produto **0**, Localização **-1** em um dos pares). Troque de campo ou de select; a tela deve salvar sozinha e, ao recarregar a Etapa 8, as notas devem continuar lá.

**Se isso acontecer, a Etapa 8 está funcionando.**

---

## Resumo — O que fazer para a Etapa 8 funcionar

| Ordem | O que fazer                                                                                                                                                        |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | No **Supabase** → **SQL Editor** → **+** (nova consulta) → abrir o arquivo **005_batalhas_etapa8.sql** no PC → copiar todo o conteúdo → colar no Editor → **Run**. |
| 2     | No **PowerShell**, na pasta VIABILIDADE, rodar **npm run dev** (se o servidor não estiver rodando) e deixar a janela aberta.                                       |
| 3     | No **navegador**, abrir **http://localhost:3000** (ou 3001) e **fazer login**.                                                                                     |
| 4     | **Meus processos** → abrir um processo → conferir **Etapa 4** (pelo menos uma casa) e **Etapa 6** (catálogo com modelos).                                          |
| 5     | Abrir **Etapa 8** → preencher notas de preço, produto e localização nos selects → conferir que salva sozinho e que os dados permanecem ao reabrir.                 |

---

## Se algo der errado

- **Erro ao rodar o SQL (ex.: "relation already exists")**  
  A tabela **batalhas** já existe. Você pode ignorar o erro ou, se quiser refazer do zero, apagar a tabela **batalhas** no Supabase (Table Editor → tabela **batalhas** → excluir) e rodar o **005_batalhas_etapa8.sql** de novo. Cuidado: isso apaga todas as notas já preenchidas.

- **Erro ao rodar o SQL (ex.: "relation listings_casas does not exist")**  
  A migração da **Sprint 4** ainda não foi aplicada. Rode primeiro o arquivo **004_sprint4_listings_catalogo_lote.sql** no SQL Editor (veja **O_QUE_FAZER_PARA_SPRINT_4_FUNCIONAR.md**).

- **Etapa 8: "Nenhuma casa listada na Etapa 4"**  
  Cadastre pelo menos uma casa na **Etapa 4** do mesmo processo e volte à Etapa 8.

- **Etapa 8: "Nenhum modelo no catálogo Moní"**  
  Confira no Supabase (Table Editor → **catalogo_casas**) se existem linhas com **ativo = true**. Se a tabela existir mas estiver vazia, use o SQL da Sprint 4 que insere **Modelo A** e **Modelo B** (ou insira manualmente um modelo).

- **Etapa 8: ao mudar uma nota dá erro ou não salva**  
  Verifique se a tabela **batalhas** existe no Supabase (Passo 1). Confirme também que está logada no sistema e que o processo pertence ao seu usuário.

- **Erro de permissão (RLS) ao salvar**  
  As políticas da tabela **batalhas** permitem acesso apenas ao dono do processo. Confirme que o **user_id** do **processo_step_one** é o mesmo usuário logado (auth.uid()).

Quando todos os passos acima derem certo, a **Etapa 8 (Batalhas)** está funcionando no seu ambiente.
