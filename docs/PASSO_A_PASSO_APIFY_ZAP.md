# Passo a passo: configurar Apify para Varrer ZAP (Etapa 4)

Este guia explica como configurar o token do Apify para que o botão **"Varrer ZAP"** na Etapa 4 funcione.

---

## 1. Obter o token da API do Apify

1. Acesse o site do Apify: **https://apify.com**
2. Faça **login** na sua conta (ou crie uma se ainda não tiver).
3. No canto superior direito, clique no **ícone do seu perfil** (avatar ou nome).
4. No menu, clique em **"Settings"** (Configurações).
5. No menu lateral esquerdo, vá em **"Integrations"** (Integrações).
   - Ou acesse direto: **https://console.apify.com/account/integrations**
6. Na seção **"API tokens"**, clique em **"Create new token"** (Criar novo token).
7. Dê um nome para o token (ex.: `VIABILIDADE ZAP`).
8. Marque as permissões necessárias (geralmente **"Full access"** ou as que o Actor ZAP precisar).
9. Clique em **"Create"**.
10. **Copie o token** que aparece na tela (ele só é mostrado uma vez). Guarde em um lugar seguro.

---

## 2. Criar ou editar o arquivo `.env.local` no projeto

1. Abra a **pasta raiz do seu projeto** no computador (a pasta onde estão os arquivos `package.json`, `next.config.js`, etc.).
   - No seu caso, algo como:  
     `C:\Users\apsou\OneDrive\Área de Trabalho\VIABILIDADE`
2. Verifique se existe um arquivo chamado **`.env.local`** nessa pasta.
   - Se **não existir**, crie um novo arquivo com exatamente esse nome: `.env.local`
   - Se **existir**, abra esse arquivo no editor (Cursor, Notepad, etc.).
3. **Importante:** O nome do arquivo deve ser exatamente `.env.local` (começa com ponto, sem espaço, extensão `.local`).
4. Dentro do arquivo, adicione ou edite a linha do token:

   ```env
   VITE_APIFY_TOKEN=cole_seu_token_aqui_sem_aspas
  # ou: APIFY_API_TOKEN=cole_seu_token_aqui_sem_aspas
   ```

   - Substitua `cole_seu_token_aqui_sem_aspas` pelo token que você copiou no passo 1.
   - **Não use aspas** em volta do token.
   - **Não coloque espaços** antes ou depois do `=`.
   - Pode ter outras variáveis no mesmo arquivo (ex.: `NEXT_PUBLIC_SUPABASE_URL=...`). Deixe cada variável em uma linha.

5. **Opcional** — Se quiser usar um Actor ZAP diferente do padrão, adicione também:

   ```env
   APIFY_ACTOR_ZAP_ID=fatihtahta/zap-imoveis-scraper
   ```

   (O valor acima já é o padrão; só precisa dessa linha se for outro actor.)

6. **Salve o arquivo** (Ctrl+S).

---

## 3. Garantir que o `.env.local` está na raiz (e não dentro de outra pasta)

A estrutura deve ficar assim:

```
VIABILIDADE/
├── .env.local          ← arquivo aqui (raiz do projeto)
├── package.json
├── next.config.js
├── src/
├── supabase/
└── ...
```

O arquivo `.env.local` **não** deve estar dentro de `src/`, nem em `supabase/`, nem em outra subpasta.

---

## 4. Reiniciar o servidor do Next.js

O Next.js só lê o `.env.local` quando o servidor **inicia**. Por isso, depois de criar ou alterar o arquivo:

1. No terminal onde o projeto está rodando (`npm run dev` ou `yarn dev`), pressione **Ctrl+C** para parar o servidor.
2. Inicie de novo:
   ```bash
   npm run dev
   ```
   ou
   ```bash
   yarn dev
   ```
3. Espere a mensagem de que o servidor está rodando (ex.: "Ready on http://localhost:3000").

---

## 5. Testar na Etapa 4

1. Abra o navegador e acesse sua aplicação (ex.: **http://localhost:3000**).
2. Faça login e vá até um processo do **Step One**.
3. Abra a **Etapa 4 — Listagem casas à venda (ZAP)**.
4. Preencha:
   - **Cidade** (ex.: Campinas)
   - **Estado** (ex.: SP)
   - **Condomínio** (ex.: Loteamento Artesano ou Genesis II)
5. Clique em **"Varrer ZAP"**.
6. Se o token estiver correto e o arquivo `.env.local` tiver sido lido:
   - A mensagem vermelha **"APIFY_API_TOKEN não configurada"** não deve mais aparecer.
   - A ferramenta vai disparar a varredura no Apify e, após alguns segundos, atualizar a tabela com os anúncios encontrados (ou exibir outra mensagem de sucesso/erro do Apify).

---

## 6. Se ainda aparecer "APIFY_API_TOKEN não configurada"

- Confirme que o **nome da variável** está exatamente assim: `VITE_APIFY_TOKEN` ou `APIFY_API_TOKEN` (tudo em maiúsculas). A linha **não** pode começar com `#`.
- Confirme que o arquivo está salvo na **raiz do projeto** e se chama **`.env.local`**.
- Reinicie o servidor de novo (parar com Ctrl+C e rodar `npm run dev` outra vez).
- Se o seu editor tiver salvado o arquivo com outro nome (ex.: `.env.local.txt`), renomeie para `.env.local` (sem extensão extra).
- No Windows, se não conseguir criar arquivo começando com ponto: abra o Prompt de Comando ou PowerShell na pasta do projeto e rode:
  ```bash
  echo VITE_APIFY_TOKEN=seu_token_aqui > .env.local
  ```
  (substitua `seu_token_aqui` pelo token real.)

---

## 7. Deploy (Vercel ou outro provedor)

Em produção, o `.env.local` do seu computador **não** é usado. É preciso configurar a variável no painel do provedor:

1. Acesse o painel do seu deploy (ex.: **Vercel** → seu projeto).
2. Vá em **Settings** → **Environment Variables** (ou equivalente).
3. Adicione:
   - **Name:** `VITE_APIFY_TOKEN` ou `APIFY_API_TOKEN`
   - **Value:** o mesmo token que você usou no `.env.local`
4. Salve e faça um **novo deploy** do projeto.

Depois disso, o "Varrer ZAP" também funcionará em produção.
