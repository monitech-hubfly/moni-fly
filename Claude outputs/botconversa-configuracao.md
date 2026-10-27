# Guia de Configuração — Bot WhatsApp Casa Moní no BotConversa

## Visão geral

O bot responde dúvidas da Central de Ajuda Hub Fly via WhatsApp. A base de conhecimento é carregada **em tempo real** a partir do Supabase — assim qualquer atualização feita no Hub Fly reflete imediatamente no bot, sem precisar editar o system prompt.

**Fluxo completo:**

```
[Gatilho: mensagem recebida]
       ↓
[Verificação de acesso]  ← opcional
       ↓
[Mensagem de boas-vindas]  ← opcional
       ↓
[Bloco HTTP Request]  ← busca FAQ atualizado no Supabase
  - GET https://aydryzoxqnwnbybvgiug.supabase.co/functions/v1/get-faq
  - Salva em: {{base_conhecimento}}
       ↓
[Bloco Claude]
  - System prompt: instruções fixas (arquivo botconversa-system-prompt-v2.md)
  - Mensagem do usuário: BASE DE CONHECIMENTO:\n{{base_conhecimento}}\n\nPERGUNTA DO USUÁRIO: {{last_message}}
  - Output: {{resposta_bot}}
       ↓
[Bloco Texto: {{resposta_bot}}]
       ↓
[Fim]
```

---

## Pré-requisitos

- Conta BotConversa ativa com número WhatsApp conectado
- Conector Claude configurado em **Configurações → Conectores → Claude** (chave de API da Anthropic)
- Arquivo `botconversa-system-prompt-v2.md` em mãos (entregue junto com este guia)

---

## Passo 1 — Criar o fluxo no BotConversa

1. Acesse **Fluxos → Criar novo fluxo**
2. Dê o nome: `Central de Ajuda — Casa Moní`
3. Defina o **gatilho** conforme o comportamento desejado:
   - **Palavra-chave:** ex. `ajuda`, `dúvida`, `pergunta`
   - **Mensagem de entrada livre** (recomendado): qualquer mensagem aciona o fluxo

---

## Passo 2 — Adicionar o bloco HTTP Request (busca o FAQ)

Este bloco carrega a Central de Ajuda atualizada antes de cada resposta do Claude.

1. No editor do fluxo, clique em **+ Adicionar bloco → HTTP Request** (ou "Requisição HTTP")
2. Configure:

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **URL** | `https://aydryzoxqnwnbybvgiug.supabase.co/functions/v1/get-faq` |
| **Headers** | Nenhum necessário (endpoint público) |
| **Variável de resposta** | `base_conhecimento` |
| **Formato da resposta** | `Texto plano` (ou `text/plain`) |

3. Clique em **Salvar bloco**

> **Por que sem autenticação?** A Edge Function foi publicada como endpoint público — ela só lê dados públicos (FAQ ativo), sem expor nenhuma informação sensível.

---

## Passo 3 — Adicionar o bloco Claude

1. Após o bloco HTTP Request, clique em **+ Adicionar bloco → IA → Claude**
2. Configure os campos:

| Campo | Valor |
|-------|-------|
| **Conector** | Selecione o conector Claude que você já cadastrou |
| **Modelo** | `claude-sonnet-4-5` ou o mais recente disponível |
| **Instruções do sistema** | Cole TODO o conteúdo do arquivo `botconversa-system-prompt-v2.md` |
| **Mensagem do usuário** | `BASE DE CONHECIMENTO:\n{{base_conhecimento}}\n\nPERGUNTA DO USUÁRIO: {{last_message}}` |
| **Variável de resposta** | `resposta_bot` |

3. Clique em **Salvar bloco**

> **Importante:** o campo "Mensagem do usuário" deve ser exatamente como mostrado acima — o Claude lê o FAQ a partir desse campo, não do system prompt.

---

## Passo 4 — Exibir a resposta ao usuário

1. Após o bloco Claude, adicione um **bloco Mensagem de texto**
2. No campo de texto, insira: `{{resposta_bot}}`
3. Isso envia a resposta do Claude de volta ao WhatsApp do usuário

---

## Passo 5 — Controlar quem acessa o bot

O BotConversa não tem controle nativo de permissão por número. Use uma das opções:

### Opção A — Lista de contatos (recomendado para poucos números)
1. Vá em **Contatos → Importar** e adicione somente os números autorizados
2. Configure o gatilho do fluxo para **"apenas contatos existentes"**

### Opção B — Tag de permissão
1. Crie uma tag `acesso_bot` no BotConversa
2. Aplique a tag manualmente aos contatos autorizados
3. No fluxo, adicione uma **condição** no início: `se contato tem tag acesso_bot → continua; senão → encerra`

### Opção C — Senha/código de ativação
1. O primeiro bloco pede um código de acesso
2. Se o código bater → segue para HTTP Request → Claude
3. Código diferente → encerra o fluxo

---

## Passo 6 — Mensagem de boas-vindas (opcional)

Antes do bloco HTTP Request, adicione um bloco de texto com:

```
Olá! Sou o assistente da Casa Moní. 👋
Pode me enviar sua dúvida que responderei com base na nossa Central de Ajuda.
```

---

## Passo 7 — Testar o fluxo

1. Em **Testar fluxo**, verifique primeiro se o bloco HTTP Request retorna conteúdo (deve aparecer texto com `=== INSTITUCIONAL ===`, etc.)
2. Envie uma pergunta que está na Central de Ajuda, ex.:
   - `"Qual é a taxa de administração do Frank?"`
   - `"Como funciona a permuta?"`
3. Verifique se a resposta está correta e formatada
4. Teste uma pergunta fora do escopo, ex.: `"Qual é o telefone do suporte?"` — o bot deve oferecer encaminhamento ao atendimento humano

---

## Estrutura final do fluxo

```
[Gatilho: mensagem recebida]
       ↓
[Verificação de acesso] (Opção A, B ou C)
       ↓
[Mensagem de boas-vindas] (opcional)
       ↓
[Bloco HTTP Request]
  - GET .../functions/v1/get-faq
  - Output: {{base_conhecimento}}
       ↓
[Bloco Claude]
  - System prompt: instruções fixas
  - Mensagem do usuário: BASE DE CONHECIMENTO:\n{{base_conhecimento}}\n\nPERGUNTA DO USUÁRIO: {{last_message}}
  - Output: {{resposta_bot}}
       ↓
[Bloco Texto: {{resposta_bot}}]
       ↓
[Fim]
```

---

## Como atualizar o FAQ depois

**Você nunca precisa editar o system prompt para atualizar perguntas e respostas.** Basta:

1. Acessar o Hub Fly → tabela `faq_central_ajuda` (via painel admin ou Supabase)
2. Inserir, editar ou desativar (`ativo = false`) qualquer item
3. O bot já usará o conteúdo atualizado na próxima mensagem

---

## Dicas de operação

- **Histórico de conversa:** o bloco Claude do BotConversa não mantém histórico por padrão. Cada mensagem é tratada de forma independente. Se quiser histórico, ative "Manter contexto da conversa" no bloco (se disponível no plano)
- **Respostas longas:** o system prompt já instrui o bot a ser direto; se necessário, adicione ao system prompt: `"Limite suas respostas a no máximo 3 parágrafos"`
- **Custo por mensagem:** cada mensagem aciona uma chamada à API da Anthropic e uma chamada à Edge Function — monitore o uso em Anthropic Console → Usage

---

## Solução de problemas

| Problema | Causa provável | Solução |
|----------|----------------|---------|
| Bot não responde | Conector Claude não configurado | Verifique em Configurações → Conectores |
| `{{base_conhecimento}}` vazio | Bloco HTTP Request com erro | Teste a URL no navegador: deve retornar texto com categorias |
| Resposta em branco | Variável `resposta_bot` não ligada ao bloco de texto | Cheque o nome da variável nos dois blocos |
| Claude não usa o FAQ | Campo "Mensagem do usuário" sem `BASE DE CONHECIMENTO:\n{{base_conhecimento}}` | Corrija o campo conforme Passo 3 |
| Resposta inventada | `{{base_conhecimento}}` não chegou ao Claude | Verifique se o HTTP Request está antes do bloco Claude no fluxo |
| Fluxo não dispara | Gatilho mal configurado | Teste com gatilho "qualquer mensagem" primeiro |
