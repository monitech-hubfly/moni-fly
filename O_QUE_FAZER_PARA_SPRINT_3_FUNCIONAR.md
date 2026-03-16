# O que fazer para a Sprint 3 funcionar — Passo a passo detalhado

Este guia diz **exatamente** o que você precisa fazer no seu computador para a Sprint 3 (Meus processos + Etapa 1) funcionar e poder ser testada. Siga na ordem.

---

## Antes de começar

- O projeto **VIABILIDADE** já deve estar na sua Área de Trabalho (pasta **VIABILIDADE**).
- As alterações da Sprint 3 já estão nos arquivos (página Meus processos, formulário da Etapa 1, etc.). Se alguém te passou o projeto de outro computador, use essa pasta atualizada.
- Você já configurou o **.env.local** com a URL e a chave do Supabase (Sprint 2).
- Você já rodou no Supabase os SQLs das migrações (001 ou 002, e 003 da correção de RLS).

Se algo disso não estiver feito, use antes os guias **GUIA_PASSOS_NAO_DEV.md** e **PASSO_A_PASSO_NPM_E_ENV.md**.

---

## Passo 1 — Abrir a pasta do projeto no PowerShell

1. Pressione a tecla **Windows** do teclado (ou clique no ícone do Windows na barra de tarefas).
2. Digite **Explorador de Arquivos** e aperte **Enter**.
3. No Explorador de Arquivos:
   - Clique em **OneDrive** (painel da esquerda).
   - Depois em **Área de Trabalho**.
   - Depois na pasta **VIABILIDADE** (duplo clique para **entrar** na pasta).
4. Confira que você está **dentro** da pasta VIABILIDADE: o nome **VIABILIDADE** deve aparecer na barra de endereço no topo.
5. **Clique uma vez** nessa barra de endereço (onde está o caminho da pasta). O texto do caminho fica selecionado.
6. Digite **powershell** (tudo junto, minúsculo) e aperte **Enter**.
7. Vai abrir uma janela azul/preta (PowerShell) **já dentro da pasta VIABILIDADE**. Não feche essa janela.

**Resumo:** Você precisa do PowerShell aberto **dentro** da pasta VIABILIDADE para os próximos passos.

---

## Passo 2 — Instalar dependências (só se ainda não fez)

1. Na janela do PowerShell (com o cursor piscando no final da linha), digite:
   ```text
   npm install
   ```
2. Aperte **Enter**.
3. Espere terminar (pode levar 1 a 3 minutos). Quando o cursor voltar a piscar e aparecer algo como “added … packages”, está pronto.
4. Se você **já rodou** `npm install` antes neste projeto, pode pular este passo e ir direto ao Passo 3.

---

## Passo 3 — Subir o servidor do sistema

1. No **mesmo** PowerShell (ainda na pasta VIABILIDADE), digite:
   ```text
   npm run dev
   ```
2. Aperte **Enter**.
3. Espere aparecer algo como:
   ```text
   ✓ Ready in ...
   - Local: http://localhost:3000
   ```
   (Se aparecer “Port 3000 is in use, trying 3001”, anote: você usará **3001** no navegador.)
4. **Deixe essa janela do PowerShell aberta.** Enquanto ela estiver aberta, o sistema está no ar. Se fechar, o site para.

---

## Passo 4 — Abrir o sistema no navegador e fazer login

1. Abra o **Chrome** ou **Edge**.
2. Na barra de endereço digite:
   - **http://localhost:3000**  
   ou, se o PowerShell mostrou porta 3001:
   - **http://localhost:3001**
3. Aperte **Enter**.
4. Deve abrir a **página inicial** do Viabilidade Moní.
5. Se você **não** estiver logada, clique em **Entrar**, digite seu **e-mail** e **senha** e clique em **Entrar**.
6. Depois do login, você deve voltar para a home ou para a tela **Iniciar Step One**.

**Resumo:** Sistema aberto no navegador e você **logada**.

---

## Passo 5 — Verificar se “Meus processos” aparece (Sprint 3)

1. Na página inicial, olhe o **canto superior direito** da tela.
2. Você deve ver, da esquerda para a direita:
   - **Meus processos**
   - **Iniciar Step One**
   - **Sair**
3. Se esses três itens aparecem, a parte de **Meus processos** da Sprint 3 está disponível.

**Se não aparecer:** confira que você está logada (faça login de novo se precisar). Se ainda não aparecer, pode ser que o projeto não tenha a alteração no menu; nesse caso, peça a quem alterou o código para conferir o arquivo `src/components/AuthHeader.tsx`.

---

## Passo 6 — Testar a página Meus processos

1. **Clique** em **Meus processos** (no menu).
2. A URL deve mudar para **http://localhost:3000/meus-processos** (ou 3001/meus-processos).
3. A página deve mostrar:
   - Título **Meus processos**
   - Texto: “Clique em um processo para continuar ou ver as etapas.”
   - Se você **não tem** nenhum processo: a mensagem “Você ainda não tem nenhum processo.” e o link **Iniciar novo processo**.
   - Se você **já tem** processos: uma **lista** com cada processo (cidade, estado, status, etapa X/11, data de atualização).
4. Se aparecer lista, **clique** em **uma linha** (um processo). Deve abrir a tela daquele processo com as **11 etapas**.

**Resumo:** A página Meus processos abre e, se houver processos, você consegue entrar em um processo por ali.

---

## Passo 7 — Criar um processo (se ainda não tiver)

1. No menu, clique em **Iniciar Step One**.
2. No campo **Cidade**, digite por exemplo **Campinas**.
3. No campo **Estado (UF)**, digite **SP**.
4. Clique em **Iniciar processo**.
5. A tela deve mudar e mostrar a **lista das 11 etapas** (Etapa 1, Etapa 2, etc.). Isso indica que o processo foi criado e a Sprint 3 pode usar esse processo para testar a Etapa 1.

---

## Passo 8 — Abrir a Etapa 1 e ver o formulário (Sprint 3)

1. Na tela que lista as **11 etapas**, clique na **primeira**: **Etapa 1 — Análise da praça**.
2. A URL deve ser algo como **http://localhost:3000/step-one/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/etapa/1**.
3. A página deve mostrar:
   - Título **Etapa 1 — Análise da praça**
   - Texto explicando a etapa
   - **Praça:** nome da cidade e estado (ex.: Campinas, SP)
   - Um **campo grande de texto** (área de texto) com o rótulo **Análise da praça (narrativa)** e uma dica sobre o que escrever
   - Um **checkbox**: “Marcar etapa 1 como concluída”
   - Botão **Salvar**
   - Botão **Próxima etapa**
4. Se tudo isso aparece, a **Etapa 1 com formulário** da Sprint 3 está funcionando.

---

## Passo 9 — Salvar a análise da praça

1. No campo **Análise da praça (narrativa)**, digite qualquer texto, por exemplo: **“Campinas, região metropolitana de SP. Eixo de expansão sul. Parques Taquaral e Portugal.”**
2. **Não** marque ainda o checkbox “Marcar etapa 1 como concluída”.
3. Clique no botão **Salvar**.
4. Deve aparecer a mensagem **Salvo com sucesso.** (em verde) por alguns segundos. O texto continua no campo.
5. Depois, **marque** o checkbox **Marcar etapa 1 como concluída** e clique em **Salvar** de novo.
6. Deve aparecer **Salvo com sucesso.** de novo. A etapa 1 fica registrada como concluída no banco.

**Resumo:** O formulário da Etapa 1 salva no banco e você vê o retorno “Salvo com sucesso.”.

---

## Passo 10 — Confirmar que os dados foram salvos (opcional)

1. Abra outra aba do navegador e vá em **https://supabase.com**. Faça login e abra o **projeto** do Viabilidade.
2. No menu da esquerda, clique em **Table Editor**.
3. Clique na tabela **etapa_progresso**.
4. Procure a linha em que **etapa_id** = **1** e **processo_id** = o ID do processo que você usou (o trecho da URL entre `/step-one/` e `/etapa/1`).
5. Nessa linha você deve ver:
   - **dados_json** com algo como `{"narrativa":"Campinas, região..."}` (o texto que você digitou)
   - **status** = **concluida** (se você marcou o checkbox e salvou)
   - **concluida_em** com data e hora

Se isso estiver lá, a Sprint 3 está **salvando e lendo** do banco corretamente.

---

## Resumo — O que você fez para a Sprint 3 funcionar

| Ordem | O que fazer |
|-------|-------------|
| 1 | Abrir a pasta VIABILIDADE no Explorador e abrir o PowerShell **dentro** dessa pasta (barra de endereço → digitar `powershell` → Enter). |
| 2 | Rodar **npm install** (e esperar terminar), se ainda não tiver feito. |
| 3 | Rodar **npm run dev** e deixar a janela do PowerShell **aberta**. |
| 4 | Abrir o navegador em **http://localhost:3000** (ou 3001) e **fazer login**. |
| 5 | Verificar se no menu aparecem **Meus processos**, **Iniciar Step One** e **Sair**. |
| 6 | Clicar em **Meus processos** e conferir a lista (ou a mensagem “nenhum processo”). Clicar em um processo para abrir. |
| 7 | Se não tiver processo, criar um em **Iniciar Step One** (Cidade + Estado → Iniciar processo). |
| 8 | Na lista das 11 etapas, abrir **Etapa 1 — Análise da praça** e conferir o formulário (narrativa, checkbox, Salvar). |
| 9 | Preencher a narrativa, clicar em **Salvar**, depois marcar “concluída” e **Salvar** de novo. |
| 10 | (Opcional) No Supabase, Table Editor → **etapa_progresso**, conferir a linha da etapa 1 com **dados_json** e **status** concluida. |

---

## Se algo não funcionar

- **PowerShell não abre na pasta certa**  
  Depois de abrir o PowerShell, digite:  
  `cd "C:\Users\apsou\OneDrive\Área de Trabalho\VIABILIDADE"`  
  (troque **apsou** pelo seu usuário do Windows, se for diferente) e aperte Enter.

- **“npm não é reconhecido”**  
  Instale o **Node.js** (nodejs.org, versão LTS) e abra o PowerShell de novo.

- **Página não abre (localhost recusou conexão)**  
  Confirme que você rodou **npm run dev** e que a janela do PowerShell **continua aberta**. Use a porta que apareceu (3000 ou 3001).

- **Não aparece “Meus processos” no menu**  
  Faça **logout** (Sair) e **login** de novo. O link só aparece para usuário logado.

- **Etapa 1 não mostra o formulário (só placeholder)**  
  Confira se a URL é **/step-one/[id]/etapa/1** (o número no final é 1). Só a Etapa 1 tem formulário na Sprint 3.

- **Salvar dá erro ou não aparece “Salvo com sucesso”**  
  Verifique o **.env.local** (URL e chave do Supabase). Confirme no Supabase que as tabelas **processo_step_one** e **etapa_progresso** existem e que você já rodou o SQL da correção de RLS (003_fix_rls_recursion_profiles.sql).

Quando todos os passos acima derem certo, a Sprint 3 está **funcionando** no seu ambiente e você pode usar **Meus processos** e a **Etapa 1** normalmente.
