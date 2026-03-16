# Passo a passo: Módulo Jurídico (Canal de Dúvidas)

## 1. Migrações no Supabase

Execute no **SQL Editor** do Supabase, nesta ordem:

1. **009_juridico_canal_duvidas.sql**  
   Cria tabelas: `juridico_tickets`, `juridico_ticket_comentarios`, `juridico_ticket_anexos`, `juridico_documentos` e RLS.

2. **010_juridico_storage.sql**  
   Cria o bucket `juridico-anexos` (se ainda não existir) e as funções `juridico_can_access_path` e `juridico_can_insert_path`.  
   **Políticas em `storage.objects`:** no Supabase hospedado a migração não pode criar políticas nessa tabela (erro "must be owner of table objects"). Crie as políticas pelo **Dashboard**: Storage → bucket `juridico-anexos` → Policies. Detalhes em **docs/STORAGE_JURIDICO_POLICIES.md**.

3. **011_juridico_ticket_campos_frank.sql**  
   Campos nome_frank, nome_condominio, lote no ticket.

4. **012_juridico_ticket_email_frank.sql**  
   Campo email_frank no ticket (para envio de e-mail quando o status mudar).

## E-mail ao franqueado

Quando o status do ticket muda (ou quando a Moní finaliza com resposta), o sistema envia um e-mail para o **e-mail cadastrado** do franqueado (o mesmo do login), desde que:

- O ticket tenha sido criado após a migração 012 (o campo `email_frank` é preenchido na criação).
- Esteja configurada a variável de ambiente **RESEND_API_KEY** (API key do [Resend](https://resend.com)).
- Opcional: **RESEND_FROM** com o remetente (ex.: `Viabilidade Moní <notificacoes@seudominio.com>`). Se não definir, usa `onboarding@resend.dev` (domínio de teste do Resend).

Sem `RESEND_API_KEY`, o alerta continua sendo criado dentro do portal (Minhas alertas), mas nenhum e-mail é enviado.  
**Passo a passo detalhado:** [Configurar e-mail com Resend](CONFIGURAR_EMAIL_RESEND.md).

## 2. Onde acessar

- **Franqueado (Frank):** menu **Dúvidas jurídicas** → `/juridico`  
  - Lista de tickets, **Nova dúvida**, aba **Documentos e contratos templates**.
- **Moní (consultor/admin):** mesmo menu → **Kanban Moní** ou `/juridico/kanban`  
  - Kanban com 4 colunas; clique no ticket para abrir detalhe em `/juridico/[id]`.

## 3. Fluxo Frank

1. Em **Canal de dúvidas jurídicas**, clicar em **Nova dúvida**.
2. Preencher título e descrição em `/juridico/nova` e **Criar dúvida**.
3. Na tela do ticket (`/juridico/[id]`), enviar anexos (PDF, imagens, Word) se quiser.
4. Acompanhar o **status** (Nova Dúvida → Em análise → Paralisado → Finalizado).
5. Quando a Moní responder e finalizar, a **resposta** e os **anexos da Moní** aparecem na mesma tela.
6. **Alertas:** ao mudar etapa ou ao finalizar, o Frank recebe alerta em **Minhas alertas** (`/alertas`) e, se configurado (Resend), um e-mail no endereço cadastrado.
7. O campo **Seu nome** na abertura do ticket é preenchido automaticamente com o nome do perfil/login; o franqueado pode alterar se quiser.

## 4. Fluxo Moní (consultor/admin)

1. Em **Canal de dúvidas** → **Kanban Moní** (`/juridico/kanban`).
2. Ver todos os tickets nas colunas: **Nova Dúvida**, **Em análise com Jurídico**, **Paralisado**, **Finalizado**.
3. Em cada card, usar **Mover para** para alterar a etapa (o Frank recebe alerta).
4. Clicar no ticket para abrir o detalhe (`/juridico/[id]`).
5. **Comentários internos:** adicionar observações que o Frank **não vê**.
6. **Responder e finalizar:** preencher a resposta visível ao Frank e clicar em **Enviar resposta e finalizar** (o ticket vai para Finalizado e o Frank recebe alerta).
7. **Anexos da Moní:** enviar arquivos como resposta; o Frank vê e pode baixar na tela do ticket.

## 5. Documentos templates

Na página `/juridico`, na seção **Documentos e contratos templates**, o Frank vê os itens ativos da tabela `juridico_documentos`.  
Para disponibilizar um contrato/modelo: inserir ou atualizar em `juridico_documentos` com `titulo`, `descricao` (opcional), `file_url` (URL pública ou path no storage) e `ativo = true`. Apenas consultor/admin podem criar/editar esses registros (via SQL ou futura tela de gestão).

## 6. Resumo técnico

- **Tabelas:** `juridico_tickets`, `juridico_ticket_comentarios`, `juridico_ticket_anexos`, `juridico_documentos`.
- **Storage:** bucket `juridico-anexos`, paths `{ticket_id}/frank/...` e `{ticket_id}/moni/...`.
- **Alertas:** inserção em `alertas` ao mudar status e ao finalizar (resposta pública).
- **RLS:** Frank só vê os próprios tickets e anexos dos próprios tickets; Moní (consultor/admin) vê e gerencia todos; comentários internos só Moní.
