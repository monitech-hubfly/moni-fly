# Integração Autentique (assinatura de documentos)

O projeto usa a **API do Autentique** para enviar documentos aprovados na revisão para assinatura eletrônica. O envio é feito **pela conta da pessoa logada**: cada usuário que pode enviar documentos (consultor, admin, supervisor) configura a **própria chave do Autentique** no **Perfil**. Assim, o documento aparece no Autentique como enviado pelo login dessa pessoa (grupo da empresa). Documentação oficial: [docs.autentique.com.br](https://docs.autentique.com.br/api).

**Passo a passo para quem vai enviar documentos:** [PASSO_A_PASSO_AUTENTIQUE.md](./PASSO_A_PASSO_AUTENTIQUE.md)

---

## 1. Chave da API (por usuário ou global)

**Recomendado (por usuário):** Cada pessoa que pode enviar documentos (consultor, admin, supervisor) acessa **Perfil** na ferramenta e cadastra a **própria chave** do Autentique (gerada no painel do Autentique com o login dela no grupo da empresa). Ao clicar em "Enviar para assinatura", o documento é enviado pela API usando essa chave — ou seja, pelo login da pessoa logada.

**Fallback (global):** Se o usuário não tiver chave configurada no perfil, o sistema usa a variável de ambiente `AUTENTIQUE_API_KEY` (útil para um único login compartilhado ou testes).

No servidor, em **`.env.local`** (opcional, se usar só chave por usuário):

```env
AUTENTIQUE_API_KEY=chave_global_opcional
```

**Importante:** não commite chaves no repositório. Chaves por usuário ficam apenas no banco (coluna `profiles.autentique_api_key`).

---

## 2. Signatários (quem vai assinar)

Os signatários podem ser definidos de duas formas:

### Opção A – Por template (recomendado)

No cadastro do **template** do documento (`document_templates`), preencha o campo `metadados` (JSON) com uma lista de signatários:

```json
{
  "signers": [
    { "email": "signatario1@email.com", "action": "SIGN" },
    { "email": "signatario2@email.com", "action": "SIGN" }
  ]
}
```

Cada item pode ter `email`, `name` (opcional) e `action` (`SIGN`, `APPROVE`, etc.).

### Opção B – Variável de ambiente (fallback)

Se o template não tiver `metadados.signers`, o sistema usa a variável:

```env
AUTENTIQUE_SIGNERS_EMAILS=email1@exemplo.com,email2@exemplo.com
```

Vários e-mails separados por vírgula. Todos receberão o documento para assinar.

---

## 3. Webhook (documento finalizado)

Quando o documento é **finalizado** no Autentique (todas as assinaturas concluídas), a Autentique envia um evento para a sua aplicação. O projeto já possui o endpoint:

**URL do webhook:**  
`https://SEU_DOMINIO/api/webhooks/autentique`

### Registrar o webhook na Autentique

Na documentação da Autentique (ex.: [Webhooks](https://docs.autentique.com.br/api/integration-basics/webhooks)), registre um endpoint com:

- **URL:** a URL acima (HTTPS obrigatório)
- **Evento:** `document.finished` (ou equivalente, ex.: `DOCUMENT_FINISHED` em algumas versões da API)
- **Formato:** JSON

No painel da Autentique ou via API GraphQL (mutação `createEndpoint`), cadastre essa URL para o evento de documento finalizado.

### O que o webhook faz aqui

- Localiza a instância do documento pelo `autentique_document_id`
- Atualiza o status para **assinado** e grava o arquivo assinado no storage
- Notifica consultores e admins (tabela `alertas`)

---

## 4. Fluxo no sistema

1. **Revisão:** Consultor/admin aprova o documento na tela de Documentos em Revisão.
2. **Enviar para assinatura:** Clica em “Enviar para assinatura (Autentique)”. O sistema envia o PDF/doc para a API e exibe o **link de assinatura** (para copiar e enviar ao signatário, se necessário).
3. **Assinatura:** O(s) signatário(s) assina(m) pelo link enviado por e-mail pelo Autentique (ou pelo link copiado).
4. **Webhook:** Ao finalizar, a Autentique chama `/api/webhooks/autentique`. O documento assinado é salvo e o status da instância vira “Assinado”.
5. **Download:** Na mesma tela, o link “Baixar documento assinado” fica disponível quando o status for “assinado”.

---

## 5. Resumo de variáveis

| Onde | Variável / Campo | Descrição |
|------|------------------|-----------|
| Perfil (banco) | `profiles.autentique_api_key` | Chave do Autentique do usuário logado; usada ao enviar documento (consultor/admin/supervisor). |
| Servidor | `AUTENTIQUE_API_KEY` | Chave global (fallback se o usuário não tiver chave no perfil). |
| Servidor | `AUTENTIQUE_SIGNERS_EMAILS` | E-mails dos signatários (se não estiverem em `metadados.signers` do template). |

---

## 6. Troubleshooting

- **“Integração Autentique não configurada”:** Defina `AUTENTIQUE_API_KEY` no `.env.local` e reinicie o servidor.
- **“Configure os signatários…”:** Preencha `metadados.signers` no template ou `AUTENTIQUE_SIGNERS_EMAILS`.
- **Documento não atualiza para “Assinado”:** Confira se o webhook está registrado na Autentique com a URL correta e o evento de documento finalizado. Verifique os logs do servidor ao receber o POST do webhook.
