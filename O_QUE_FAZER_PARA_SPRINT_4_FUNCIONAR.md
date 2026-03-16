# O que fazer para a Sprint 4 funcionar — Passo a passo detalhado

A Sprint 4 entrega as **Etapas 4, 5, 6 e 7**: casas à venda, lotes à venda, catálogo Moní e lote escolhido. Para tudo funcionar, você precisa **rodar um novo SQL no Supabase** e, em seguida, usar o sistema como de costume.

---

## Passo 1 — Rodar a migração SQL da Sprint 4 no Supabase

Sem este passo, as telas das etapas 4 a 7 vão dar erro ou não vão salvar.

1. Abra o navegador e vá em **https://supabase.com**. Faça login e abra o **projeto** do Viabilidade.
2. No menu da esquerda, clique em **SQL Editor**.
3. Clique no **+** (nova consulta) para abrir uma nova aba.
4. No seu computador, abra a pasta do projeto:
   - **Explorador de Arquivos** → **OneDrive** → **Área de Trabalho** → **VIABILIDADE** → **supabase** → **migrations**
5. Abra o arquivo **004_sprint4_listings_catalogo_lote.sql** (botão direito → **Abrir com** → **Bloco de notas**).
6. Selecione **todo** o conteúdo (**Ctrl+A**) e copie (**Ctrl+C**).
7. Volte ao **SQL Editor** do Supabase, apague qualquer texto na caixa e **cole** o que você copiou (**Ctrl+V**).
8. Clique em **Run** (ou **Run CTRL+↵**).
9. Deve aparecer mensagem em **verde**, por exemplo **"Success. No rows returned"** ou **"Success"**.

**Pronto:** as tabelas **listings_casas**, **listings_lotes**, **catalogo_casas** e **lote_escolhido** foram criadas, com regras de acesso (RLS). Dois modelos de exemplo (Modelo A e Modelo B) foram inseridos no catálogo Moní.

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
3. **Deixe a janela do PowerShell aberta.**

---

## Passo 3 — Abrir o sistema no navegador e fazer login

1. No navegador, acesse **http://localhost:3000** (ou **http://localhost:3001** se for o seu caso).
2. Se não estiver logada, clique em **Entrar** e informe e-mail e senha.

---

## Passo 4 — Abrir um processo e testar a Etapa 4 (casas à venda)

1. Na home, clique em **Meus processos** e depois em **um processo** (ou crie um novo em **Iniciar Step One**).
2. Na lista das **11 etapas**, clique em **Etapa 4 — Listagem casas à venda (ZAP)**.
3. Você deve ver:
   - Texto explicando que pode adicionar casas manualmente (ZAP/Apify em breve).
   - Lista **"Casas cadastradas"** (vazia no início).
   - Formulário **"Adicionar casa"** com: Condomínio, Área casa (m²), Quartos, Preço (R$), Link anúncio, checkbox Piscina.
4. Preencha pelo menos **Condomínio** e **Preço** (ex.: Condomínio **Residencial X**, Preço **1500000**) e clique em **Adicionar casa**.
5. Deve aparecer a casa na lista acima e os campos do formulário devem limpar. Se aparecer, a **Etapa 4** está funcionando.

---

## Passo 5 — Testar a Etapa 5 (lotes à venda)

1. Use o link **Próxima etapa** ou, na lista das 11 etapas, clique em **Etapa 5 — Listagem lotes à venda**.
2. Você deve ver:
   - Lista **"Lotes cadastrados"** (vazia no início).
   - Formulário **"Adicionar lote"** com: Condomínio, Área (m²), Preço (R$), Link.
3. Preencha e clique em **Adicionar lote**. O lote deve aparecer na lista. **Etapa 5** ok.

---

## Passo 6 — Testar a Etapa 6 (catálogo Moní)

1. Vá para **Etapa 6 — Catálogo casas Moní**.
2. Você deve ver uma **tabela** com os modelos do catálogo (pelo menos **Modelo A** e **Modelo B**), com colunas: Nome, Área (m²), Quartos, Preço venda (R$), R$/m².
3. Se a tabela aparecer com dados, a **Etapa 6** está funcionando (os modelos vêm do SQL que você rodou no Passo 1).

---

## Passo 7 — Testar a Etapa 7 (lote escolhido)

1. Vá para **Etapa 7 — Lote escolhido pelo franqueado**.
2. Você deve ver um **formulário** com: Condomínio, Recuos permitidos, Localização no condomínio, Área do lote (m²), Topografia (plano/aclive/declive), Frente (m), Fundo (m), Preço oferta (R$), Preço/m² (R$). A **Praça** (cidade, estado) aparece no topo.
3. Preencha alguns campos (ex.: Condomínio, Área, Preço) e clique em **Salvar lote escolhido**.
4. Deve aparecer **"Salvo com sucesso."** e, ao reabrir a Etapa 7, os dados devem continuar lá. **Etapa 7** ok.

---

## Resumo — O que você fez para a Sprint 4 funcionar

| Ordem | O que fazer |
|-------|--------------|
| 1 | No **Supabase** → **SQL Editor** → **+** (nova consulta) → abrir o arquivo **004_sprint4_listings_catalogo_lote.sql** no PC → copiar todo o conteúdo → colar no Editor → **Run**. |
| 2 | No **PowerShell**, na pasta VIABILIDADE, rodar **npm run dev** (se o servidor não estiver rodando) e deixar a janela aberta. |
| 3 | No **navegador**, abrir **http://localhost:3000** (ou 3001) e **fazer login**. |
| 4 | **Meus processos** → abrir um processo → **Etapa 4** → adicionar pelo menos uma casa (formulário + botão Adicionar casa). |
| 5 | **Etapa 5** → adicionar pelo menos um lote. |
| 6 | **Etapa 6** → conferir a tabela do catálogo Moní (Modelo A e B). |
| 7 | **Etapa 7** → preencher e **Salvar lote escolhido** e conferir se aparece "Salvo com sucesso." e os dados ao reabrir. |

---

## Se algo der errado

- **Erro ao rodar o SQL (ex.: "relation already exists")**  
  As tabelas já existem. Você pode ignorar ou, se quiser refazer, apagar as tabelas no Supabase (Table Editor → apagar tabelas listings_casas, listings_lotes, catalogo_casas, lote_escolhido) e rodar o SQL de novo. Cuidado: isso apaga os dados dessas tabelas.

- **Etapa 4 ou 5: "Adicionar" não faz nada ou dá erro**  
  Confirme que você rodou o **004_sprint4_listings_catalogo_lote.sql** no Supabase (Passo 1). Veja no **Table Editor** se existem as tabelas **listings_casas** e **listings_lotes**.

- **Etapa 6: tabela vazia ou "Nenhum modelo no catálogo"**  
  O SQL da Sprint 4 insere dois modelos (Modelo A e B). Se a tabela **catalogo_casas** existir mas estiver vazia, rode de novo só a parte do script que faz **INSERT** nos modelos (as duas linhas que começam com **INSERT INTO public.catalogo_casas**).

- **Etapa 7: "Salvar" dá erro**  
  Verifique se a tabela **lote_escolhido** existe no Supabase e se você está logada no sistema.

Quando todos os passos acima derem certo, a **Sprint 4** está funcionando no seu ambiente.
