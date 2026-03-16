# Passo a passo: configurar RESEND_API_KEY no projeto

Siga estes passos para colocar a chave do Resend no projeto e fazer os e-mails de mudança de status do jurídico funcionarem.

---

## 1. Localizar a raiz do projeto

- A **raiz do projeto** é a pasta que contém os arquivos `package.json`, `next.config.js` (ou `next.config.ts`) e as pastas `src`, `supabase`, etc.
- No seu caso, é a pasta **VIABILIDADE** (por exemplo: `C:\Users\apsou\OneDrive\Área de Trabalho\VIABILIDADE`).
- No Cursor ou VS Code: se você abriu a pasta VIABILIDADE como workspace, a raiz é a primeira pasta que aparece no explorador de arquivos (sidebar esquerda).

---

## 2. Abrir ou criar o arquivo `.env.local`

### Opção A: O arquivo `.env.local` já existe

1. No **explorador de arquivos** do Cursor/VS Code (barra lateral esquerda), procure na **raiz** do projeto (mesmo nível que `package.json`).
2. Procure o arquivo **`.env.local`**.
   - Se não aparecer, pode ser que arquivos que começam com ponto estejam ocultos. No explorador, verifique se não há filtro ocultando “dotfiles”.
3. Clique duas vezes em **`.env.local`** para abrir no editor.

### Opção B: O arquivo `.env.local` não existe — criar

1. Na raiz do projeto, clique com o **botão direito** na área do explorador (ou no ícone de arquivo com “+”).
2. Escolha **New File** (ou “Novo arquivo”).
3. Digite exatamente o nome: **`.env.local`** (com o ponto no início).
4. Confirme (Enter). O arquivo será criado e aberto.

**No Windows:** se o editor não deixar criar arquivo começando com ponto, você pode:
- Criar primeiro como `env.local` e depois renomear para `.env.local`, ou
- No terminal, na raiz do projeto, rodar:  
  `echo. > .env.local`  
  (depois abra o arquivo no editor).

---

## 3. Adicionar a chave no arquivo

1. Com o **`.env.local`** aberto no editor:
2. Vá até o final do arquivo (ou em uma linha em branco).
3. Digite ou cole **uma** das opções abaixo.

   **Se o arquivo estiver vazio ou você for adicionar só o Resend:**

   ```env
   RESEND_API_KEY=re_sua_chave_aqui
   ```

   **Substitua `re_sua_chave_aqui`** pela API key que você copiou do painel do Resend (ex.: `re_1a2b3c4d5e6f...`).

   **Se já existirem outras variáveis** (ex.: Supabase), adicione em uma **nova linha**:

   ```env
   RESEND_API_KEY=re_1a2b3c4d5e6f...
   ```

4. **Regras importantes:**
   - Não coloque aspas em volta da chave (evite `"re_..."`).
   - Não deixe espaços antes ou depois do `=` (use `RESEND_API_KEY=re_...`).
   - Uma variável por linha.
   - Não coloque ponto e vírgula no final.

5. Salve o arquivo: **Ctrl + S** (Windows/Linux) ou **Cmd + S** (Mac).

---

## 4. Reiniciar o servidor (Next.js)

O Next.js lê o `.env.local` só quando inicia. Por isso é preciso **reiniciar** o servidor depois de alterar.

1. No **terminal** onde o `npm run dev` (ou `yarn dev`) está rodando:
2. Pare o servidor: **Ctrl + C**.
3. Suba de novo:

   ```bash
   npm run dev
   ```

4. Espere aparecer a mensagem de que o servidor está rodando (ex.: “Ready on http://localhost:3000”).

A partir daí, a aplicação passa a usar `RESEND_API_KEY` para enviar os e-mails de mudança de status do jurídico.

---

## 5. Não commitar e não expor a chave

- O arquivo **`.env.local`** não deve ser enviado para o Git (não deve ser commitado), pois contém dados sensíveis.
- No Next.js, o **`.gitignore`** costuma incluir `.env*.local`. Confira:
  1. Abra o arquivo **`.gitignore`** na raiz do projeto.
  2. Verifique se existe uma linha como **`.env.local`** ou **`.env*.local`**.
  3. Se não existir, adicione uma linha: **`.env.local`** e salve.

- **Não:**
  - Enviar o `.env.local` para repositórios (GitHub, etc.).
  - Colar a API key em prints, documentos públicos ou em código commitado.
  - Compartilhar a chave por e-mail ou chat.

- **Em produção** (Vercel, etc.): configure **RESEND_API_KEY** nas variáveis de ambiente do painel do provedor, e não no repositório.

---

## Resumo rápido

| Passo | Ação |
|-------|------|
| 1 | Abrir a pasta raiz do projeto (VIABILIDADE). |
| 2 | Abrir ou criar o arquivo **`.env.local`** na raiz. |
| 3 | Adicionar a linha: `RESEND_API_KEY=re_sua_chave_aqui` (com sua chave). |
| 4 | Salvar (Ctrl+S) e reiniciar o servidor (`Ctrl+C` e depois `npm run dev`). |
| 5 | Garantir que `.env.local` está no `.gitignore` e não commitar o arquivo. |

Depois disso, os e-mails de mudança de status do ticket jurídico serão enviados quando a chave estiver correta e a migração 012 estiver aplicada.
