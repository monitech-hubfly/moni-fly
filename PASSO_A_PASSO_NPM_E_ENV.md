# Passo a passo: npm install e arquivo .env.local

Siga na ordem. Cada passo diz exatamente onde clicar e o que digitar.

---

## Parte 1 — Rodar o npm install

### Passo 1 — Abrir o PowerShell na pasta do projeto

**Opção A — Pelo Explorador de Arquivos (mais fácil)**

1. Pressione a tecla **Windows** do teclado (ou clique no ícone do Windows na barra de tarefas).
2. Digite **Explorador de Arquivos** e aperte **Enter**.
3. No Explorador, no painel da esquerda, clique em **OneDrive**.
4. Depois clique em **Área de Trabalho**.
5. Depois clique na pasta **VIABILIDADE** (duplo clique para entrar nela).
6. Você deve estar **dentro** da pasta VIABILIDADE (o nome “VIABILIDADE” aparece na barra de endereço no topo).
7. **Clique uma vez** na barra de endereço (onde está escrito o caminho da pasta). O caminho fica selecionado.
8. Digite **powershell** (tudo junto, minúsculo).
9. Aperte **Enter**.
10. Vai abrir uma janela azul/preta (PowerShell) **já dentro da pasta VIABILIDADE**. Não feche essa janela.

**Opção B — Pelo menu Executar**

1. Pressione **Windows + R** (segure a tecla Windows e aperte R).
2. Na caixinha que abrir, digite: **powershell**
3. Aperte **Enter**.
4. Na janela do PowerShell que abrir, digite o comando abaixo **exatamente** (pode copiar e colar) e aperte **Enter**:

   ```
   cd "C:\Users\apsou\OneDrive\Área de Trabalho\VIABILIDADE"
   ```

   (Se o seu usuário do Windows for outro, troque **apsou** pelo nome da sua pasta de usuário.)

5. Aperte **Enter**. O “cursor” do PowerShell deve aparecer algo como `PS ...\VIABILIDADE>` — ou seja, você está na pasta certa.

---

### Passo 2 — Digitar o comando npm install

1. Na mesma janela do PowerShell (com o cursor piscando no final da linha),
2. Digite **exatamente** (ou copie e cole):

   ```
   npm install
   ```

3. Aperte **Enter**.

---

### Passo 3 — Esperar terminar

1. O PowerShell vai mostrar várias linhas de texto (nome de pacotes, “added … packages”, etc.). **Isso é normal.**
2. **Não feche a janela** e **não digite mais nada** até terminar.
3. Pode levar de **1 a 5 minutos** (ou um pouco mais na primeira vez).
4. Terminou quando:
   - as linhas param de aparecer,
   - o cursor volta a piscar no final de uma linha que termina com algo como `\VIABILIDADE>`,
   - e não aparece a palavra **“Error”** em vermelho.
5. Se aparecer algo como **“added 300 packages”** (o número pode ser outro), está certo.
6. **Pode deixar a janela do PowerShell aberta** para os próximos passos (ou fechar, tanto faz para a Parte 2).

---

## Parte 2 — Copiar .env.local.example para .env.local

### Passo 4 — Abrir a pasta VIABILIDADE no Explorador

1. Abra o **Explorador de Arquivos** (Windows + E ou pelo menu Iniciar).
2. Vá em **OneDrive** → **Área de Trabalho** → **VIABILIDADE**.
3. Você deve ver vários arquivos e pastas, por exemplo: **.env.local.example**, **package.json**, **README.md**, pasta **src**, pasta **supabase**, etc.

---

### Passo 5 — Ver o arquivo .env.local.example

1. O arquivo **.env.local.example** pode aparecer com o nome **.env.local** na frente e **.example** depois (ou só “.env.local.example”).
2. Se **não aparecer** nenhum arquivo começando com **.env**:
   - No topo do Explorador, clique na aba **Exibir** (ou **View**).
   - Marque a opção **“Extensões de nomes de arquivos”** (ou “File name extensions”).
   - Procure de novo; o arquivo pode se chamar **.env.local.example** (e a “extensão” é .example).
3. **Clique uma vez** no arquivo **.env.local.example** para selecioná-lo.

---

### Passo 6 — Copiar o arquivo

1. Com o **.env.local.example** selecionado, aperte **Ctrl + C** (copiar)
   **ou** clique com o **botão direito** no arquivo e escolha **Copiar**.
2. Depois, **clique com o botão direito** em um espaço vazio **dentro da mesma pasta** (por exemplo ao lado dos outros arquivos) e escolha **Colar**.
3. Deve aparecer um **novo arquivo**. O nome pode ser:
   - **.env.local.example - Cópia**, ou
   - **.env.local** (dependendo do Windows).

---

### Passo 7 — Garantir que o novo arquivo se chame .env.local

1. Se o nome do novo arquivo for **“.env.local.example - Cópia”** (ou algo parecido):
   - **Clique com o botão direito** nesse novo arquivo.
   - Escolha **Renomear**.
   - Apague o nome todo e digite **exatamente**: **.env.local**
   - Aperte **Enter**.
   - Se o Windows avisar “Se você alterar a extensão…”, clique em **Sim** (queremos que vire .local mesmo).
2. No final, você deve ter **dois** arquivos na pasta VIABILIDADE:
   - **.env.local.example** (o original; não mexa)
   - **.env.local** (a cópia que você vai editar)

---

## Parte 3 — Abrir .env.local no Bloco de notas e trocar os valores

### Passo 8 — Abrir o .env.local no Bloco de notas

1. Na pasta **VIABILIDADE**, localize o arquivo **.env.local**.
2. **Clique com o botão direito** em **.env.local**.
3. No menu, escolha **“Abrir com”** (ou “Open with”).
4. Clique em **Bloco de notas** (ou “Notepad”).
   - Se **não aparecer** Bloco de notas: clique em **“Outro aplicativo”** ou **“Escolher outro app”**, role a lista e clique em **Bloco de notas**.
5. O Bloco de notas abre com **duas linhas** (ou um pouco mais), parecidas com:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
   ```

   Pode ter linhas em branco ou comentários (# …); o importante são essas duas.

---

### Passo 9 — Trocar a URL do Supabase

1. Você já deve ter anotado a **Project URL** do Supabase (ex.: `https://abcdefghijk.supabase.co`). Se não tiver, pegue de novo em: Supabase → engrenagem (Project Settings) → **API** → **Project URL** → copiar.
2. No Bloco de notas, na **primeira linha**:
   - **Apague** só a parte depois do **=** (ou seja, apague `https://seu-projeto.supabase.co`).
   - **Não apague** `NEXT_PUBLIC_SUPABASE_URL=`.
3. Depois do **=**, **cole** a URL que você copiou do Supabase (Ctrl + V). Não coloque espaço antes nem depois.
4. A linha deve ficar assim (com a sua URL):

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
   ```

   (no lugar de **xxxxxxxx** vem o código do seu projeto no Supabase).

---

### Passo 10 — Trocar a chave anon (public)

1. Você já deve ter anotado a **chave anon (public)** do Supabase. Se não tiver: Supabase → Project Settings → **API** → em **Project API keys** copie a chave **anon** / **anon public** (não a service_role).
2. No Bloco de notas, na **segunda linha**:
   - **Apague** só a parte depois do **=** (ou seja, apague `sua-anon-key`).
   - **Não apague** `NEXT_PUBLIC_SUPABASE_ANON_KEY=`.
3. Depois do **=**, **cole** a chave que você copiou (Ctrl + V). Não coloque espaço antes nem depois; a chave é longa (várias linhas de letras e números).
4. A linha deve ficar assim (com a sua chave):

   ```
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOi...
   ```

   (a sua chave será diferente, mas costuma começar com **eyJ**).

---

### Passo 11 — Conferir antes de salvar

1. Confira se **não sobrou**:
   - `https://seu-projeto.supabase.co`
   - `sua-anon-key`
2. Confira se **não tem espaço** antes ou depois do **=** em cada linha.
3. Cada variável deve estar em **uma linha só** (a chave anon inteira na mesma linha, mesmo sendo longa).

---

### Passo 12 — Salvar o arquivo

1. No Bloco de notas, no menu **Arquivo**, clique em **Salvar**
   **ou** aperte **Ctrl + S**.
2. Feche o Bloco de notas (pode fechar normalmente).
3. O arquivo **.env.local** na pasta VIABILIDADE agora está com a **URL** e a **chave anon** do seu projeto Supabase.

---

## Resumo rápido

| O que fazer                           | Como                                                                                                                  |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Abrir PowerShell na pasta VIABILIDADE | Explorador → OneDrive → Área de Trabalho → VIABILIDADE → clicar na barra de endereço → digitar **powershell** → Enter |
| Rodar npm install                     | No PowerShell: digitar **npm install** → Enter → esperar terminar (1–5 min)                                           |
| Copiar .env                           | Na pasta VIABILIDADE: selecionar **.env.local.example** → Ctrl+C → clicar em espaço vazio → Ctrl+V                    |
| Renomear a cópia                      | Botão direito na cópia → Renomear → nome: **.env.local**                                                              |
| Editar .env.local                     | Botão direito em **.env.local** → Abrir com → Bloco de notas                                                          |
| Trocar URL                            | Na 1ª linha, apagar só o que está depois do **=** e colar a **Project URL** do Supabase                               |
| Trocar chave                          | Na 2ª linha, apagar só o que está depois do **=** e colar a chave **anon (public)** do Supabase                       |
| Salvar                                | Ctrl+S (ou Arquivo → Salvar) e fechar o Bloco de notas                                                                |

Depois disso, você pode rodar **npm run dev** no PowerShell (na pasta VIABILIDADE) e abrir **http://localhost:3000** no navegador para ver o projeto.
