# Passo a passo: configurar e-mail com Resend

Para o franqueado receber e-mail quando o status do ticket jurídico mudar, configure o [Resend](https://resend.com) e as variáveis de ambiente no projeto.

---

## 1. Criar conta no Resend

1. Acesse **https://resend.com** no navegador.
2. Clique em **Sign up** (ou "Criar conta").
3. Cadastre-se com:
   - **E-mail** e **senha**, ou
   - **Conta Google** / **GitHub**, se preferir.
4. Confirme o e-mail se o Resend pedir (verifique a caixa de entrada e spam).
5. Faça login no painel do Resend.

---

## 2. Obter a API Key

1. No painel do Resend, no menu lateral, clique em **API Keys** (ou acesse **https://resend.com/api-keys**).
2. Clique em **Create API Key**.
3. Dê um nome (ex.: `Viabilidade Moní - produção` ou `dev`).
4. Escolha a permissão:
   - **Sending access** (envio) é suficiente para este projeto.
5. Clique em **Add** (ou **Create**).
6. **Copie a chave** que aparece na tela (ela só é mostrada uma vez).  
   Formato típico: `re_xxxxxxxxxxxxxxxxxxxxxxxxxx`.
7. Guarde em local seguro; você vai colar no `.env.local` no próximo passo.

---

## 3. Configurar no projeto (RESEND_API_KEY)

**Passo a passo detalhado (abrir/criar `.env.local`, colar a chave, salvar, reiniciar):** [Configurar RESEND no projeto](CONFIGURAR_RESEND_NO_PROJETO.md).

Resumo:

1. Na raiz do projeto (pasta **VIABILIDADE**), abra ou crie o arquivo **`.env.local`**.
2. Adicione a linha (trocando pela sua chave):

   ```env
   RESEND_API_KEY=re_sua_chave_aqui
   ```

3. Salve o arquivo (Ctrl+S).
4. **Reinicie o servidor** (Next.js): no terminal, pressione **Ctrl+C** para parar e depois rode `npm run dev` de novo.

**Importante:**  
- O arquivo `.env.local` não deve ser commitado (geralmente já está no `.gitignore`).  
- Não compartilhe a API key em repositórios públicos ou prints.

---

## 4. (Opcional) Configurar o remetente (RESEND_FROM)

Por padrão o código usa `onboarding@resend.dev` como remetente (domínio de teste do Resend). Para usar um e-mail seu (ex.: `notificacoes@seudominio.com`):

### 4.1. Adicionar e verificar domínio no Resend

1. No painel do Resend, vá em **Domains** (menu lateral).
2. Clique em **Add Domain**.
3. Digite o domínio (ex.: `seudominio.com`) e siga as instruções.
4. O Resend vai pedir que você adicione registros **DNS** (MX, TXT, etc.) no provedor do domínio.  
   Copie os valores e configure no painel da sua hospedagem/registro de domínio.
5. Após propagar o DNS (pode levar alguns minutos ou horas), volte no Resend e clique em **Verify** no domínio. Quando estiver verificado, você pode enviar com esse domínio.

### 4.2. Definir RESEND_FROM no projeto

1. No mesmo **`.env.local`**, adicione:

   ```env
   RESEND_FROM=Viabilidade Moní <notificacoes@seudominio.com>
   ```

   Troque `notificacoes@seudominio.com` pelo e-mail que você configurou no domínio verificado.

2. Salve e reinicie o servidor (pare e suba de novo o `npm run dev`).

**Se não configurar RESEND_FROM:**  
Os e-mails continuam sendo enviados usando `onboarding@resend.dev` (limite de envio do Resend para teste; ideal só para desenvolvimento).

---

## 5. Conferir se está funcionando

1. Garanta que a migração **012** foi aplicada no Supabase (campo `email_frank` na tabela `juridico_tickets`).
2. Crie um **novo** ticket como franqueado (com o e-mail que você quer receber).
3. Como **consultor/admin**, altere o status desse ticket (ex.: mover para "Em análise com Jurídico").
4. Verifique:
   - a caixa de entrada (e spam) do e-mail do franqueado;
   - no Resend, em **Logs** ou **Emails**, se o envio aparece como enviado ou com erro.

Se não chegar e-mail:
- Confirme que `RESEND_API_KEY` está correta no `.env.local` e que o servidor foi reiniciado.
- Veja os logs do Resend para mensagens de bounce ou rejeição.
- Para domínio próprio, confirme que o domínio está verificado e que `RESEND_FROM` está exatamente no formato `Nome <email@dominio.com>`.

---

## Resumo das variáveis

| Variável          | Obrigatória para e-mail? | Exemplo                                              |
|-------------------|---------------------------|------------------------------------------------------|
| `RESEND_API_KEY`  | Sim                       | `re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`                |
| `RESEND_FROM`     | Não (usa teste do Resend) | `Viabilidade Moní <notificacoes@seudominio.com>`      |

Com `RESEND_API_KEY` configurada, os alertas por e-mail passam a ser enviados sempre que o status do ticket mudar ou quando a Moní finalizar com resposta.
