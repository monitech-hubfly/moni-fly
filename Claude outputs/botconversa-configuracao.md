# Guia de Configuração — Bot WhatsApp Casa Moní no BotConversa

## Visão geral

O bot responde dúvidas da Central de Ajuda Hub Fly via WhatsApp. O fluxo é simples:

**Mensagem do usuário → BotConversa → Bloco Claude (com system prompt) → Resposta no WhatsApp**

Nenhum middleware externo é necessário — o conector Claude nativo do BotConversa é suficiente.

---

## Pré-requisitos

- Conta BotConversa ativa com número WhatsApp conectado
- Conector Claude configurado em **Configurações → Conectores → Claude** (chave de API da Anthropic)
- Arquivo `botconversa-system-prompt.md` em mãos (entregue junto com este guia)

---

## Passo 1 — Criar o fluxo no BotConversa

1. Acesse **Fluxos → Criar novo fluxo**
2. Dê o nome: `Central de Ajuda — Casa Moní`
3. Defina o **gatilho** conforme o comportamento desejado:
   - **Palavra-chave:** ex. `ajuda`, `dúvida`, `pergunta` — o fluxo dispara quando o usuário envia uma dessas palavras
   - **Mensagem de entrada livre** (recomendado): qualquer mensagem do usuário aciona o fluxo

---

## Passo 2 — Adicionar o bloco Claude

1. No editor do fluxo, clique em **+ Adicionar bloco → IA → Claude**
2. Configure os campos:

| Campo | Valor |
|-------|-------|
| **Conector** | Selecione o conector Claude que você já cadastrou |
| **Modelo** | `claude-sonnet-4-5` ou o mais recente disponível |
| **Instruções do sistema** | Cole TODO o conteúdo do arquivo `botconversa-system-prompt.md` |
| **Mensagem do usuário** | `{{last_message}}` (variável nativa do BotConversa — mensagem mais recente do contato) |
| **Variável de resposta** | Crie ou selecione uma variável, ex.: `resposta_bot` |

3. Clique em **Salvar bloco**

---

## Passo 3 — Exibir a resposta ao usuário

1. Após o bloco Claude, adicione um **bloco Mensagem de texto**
2. No campo de texto, insira: `{{resposta_bot}}`
3. Isso envia a resposta do Claude de volta ao WhatsApp do usuário

---

## Passo 4 — Controlar quem acessa o bot

O BotConversa não tem controle nativo de permissão por número. Use uma das opções:

### Opção A — Lista de contatos (recomendado para poucos números)
1. Vá em **Contatos → Importar** e adicione somente os números autorizados (Frank e time Moní)
2. Configure o gatilho do fluxo para **"apenas contatos existentes"** — usuários fora da base não acionam o fluxo

### Opção B — Tag de permissão
1. Crie uma tag `acesso_bot` no BotConversa
2. Aplique a tag manualmente aos contatos autorizados
3. No fluxo, adicione uma **condição** no início: `se contato tem tag acesso_bot → continua; senão → encerra ou envia mensagem de acesso negado`

### Opção C — Senha/código de ativação
1. O primeiro bloco do fluxo pede um código de acesso
2. Se o código bater → segue para o bloco Claude
3. Código diferente → encerra o fluxo

---

## Passo 5 — Mensagem de boas-vindas (opcional)

Antes do bloco Claude, adicione um bloco de texto com:

```
Olá! Sou o assistente da Casa Moní. 👋
Pode me enviar sua dúvida que responderei com base na nossa Central de Ajuda.
```

---

## Passo 6 — Testar o fluxo

1. Em **Testar fluxo**, envie uma pergunta que está na Central de Ajuda, ex.:
   - `"Qual é a taxa de administração do Frank?"`
   - `"Como funciona a permuta?"`
2. Verifique se a resposta está correta e formatada
3. Teste uma pergunta fora do escopo, ex.: `"Qual é o telefone do suporte?"` — o bot deve responder com o texto de escalada

---

## Estrutura final do fluxo

```
[Gatilho: mensagem recebida]
       ↓
[Verificação de acesso] (se usar Opção B ou C)
       ↓
[Mensagem de boas-vindas] (opcional)
       ↓
[Bloco Claude]
  - System prompt: Central de Ajuda completa
  - Input: {{last_message}}
  - Output: {{resposta_bot}}
       ↓
[Bloco Texto: {{resposta_bot}}]
       ↓
[Fim]
```

---

## Dicas de operação

- **Atualizar o conhecimento do bot:** basta editar o system prompt no bloco Claude — não precisa recriar o fluxo
- **Histórico de conversa:** o bloco Claude do BotConversa não mantém histórico por padrão. Cada mensagem é tratada de forma independente. Se quiser histórico, ative a opção "Manter contexto da conversa" no bloco (se disponível no plano)
- **Evitar respostas longas demais:** o system prompt já instrui o bot a ser direto; se as respostas ficarem muito longas, adicione ao system prompt: `"Limite suas respostas a no máximo 3 parágrafos"`
- **Custo por mensagem:** cada mensagem aciona uma chamada à API da Anthropic — monitore o uso em Anthropic Console → Usage

---

## Solução de problemas

| Problema | Causa provável | Solução |
|----------|----------------|---------|
| Bot não responde | Conector Claude não configurado | Verifique em Configurações → Conectores |
| Resposta em branco | Variável `resposta_bot` não ligada ao bloco de texto | Cheque o nome da variável nos dois blocos |
| Resposta inventada | System prompt não foi colado corretamente | Reabra o bloco Claude e verifique o campo Instruções |
| Fluxo não dispara | Gatilho mal configurado | Teste com gatilho "qualquer mensagem" primeiro |
