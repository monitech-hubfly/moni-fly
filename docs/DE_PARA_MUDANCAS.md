# De / para — mudanças no Moni Fly (visão para o time)

Este texto resume **o que era antes** e **como funciona agora**, em linguagem simples. Não é um manual técnico; é um mapa para alinhar conversa entre áreas.

---

## Funis (kanban) — “Portfolio + Operações” antes e agora

**Antes (visão de produto):**  
Muita gente falava em **um bloco só**: “Portfolio + Operações”, como se fosse um único lugar genérico para acompanhar o pipeline.

**Agora:**  
No sistema existem **funis separados**, cada um com nome próprio no cadastro, por exemplo:

- **Funil Portfólio** — tela dedicada em **Kanban Portfolio** (`/portfolio`).
- **Funil Operações** — tela dedicada em **Kanban Operações** (`/operacoes`).
- Além deles, outros funis próprios (ex.: **Funil Step One**, **Funil Acoplamento**, **Contabilidade**, **Crédito**), cada um com sua rota.

**O que não sumiu:**  
A área **Novos Negócios** (`/painel-novos-negocios`) continua sendo o **hub**: dá para alternar entre visão de **kanban** (processos antigos em colunas de etapa) e aba de **painel** com **dois blocos de performance** lado a lado — um para Portfólio e outro para Operações. Ou seja: o “mais” entre Portfolio e Operações virou **dois funis reais**, mas a **visão consolidada** no painel foi mantida.

---

## Cards — o que mudou na “ficha” do card

**Antes:**  
A ideia forte era o **processo** (viabilidade em etapas no painel clássico), com muita informação espalhada em telas de “steps”.

**Agora:**  
Cada negócio também (ou principalmente) vive como **card no kanban**: título, coluna (fase), franqueado, status ativo/arquivado/concluído, etc. Na **ficha do card** (modal):

- entra o **checklist da fase** (ver tópico abaixo);
- dá para **gerar link de formulário** para o candidato (ver formulário público);
- há fluxo de **aprovação para mudar de fase** quando o Bombeiro precisa validar (ver aprovação de fase);
- há **aba de e-mail** para falar com franqueado/candidato sem sair do card (ver e-mail).

Alguns cards ainda podem estar ligados a **processos antigos** (“legado”); a interface tenta **unir** nativo e legado na mesma jornada de Novos Negócios.

---

## Atividades / tarefas — e o “Painel de Chamados”

**Antes:**  
Falava-se muito em **tarefas** ou **atividades** ligadas ao checklist dos cards no painel.

**Agora (Novos Negócios):**  
A mesma lista consolidada — ainda alimentada pelas **interações/atividades do checklist** dos kanbans — aparece na interface com o nome **Painel de Chamados** (`/painel-novos-negocios/tarefas`): filtros por status, tipo, kanban, time, responsável, SLA, etc. Ou seja: **o vocabulário na tela mudou para “chamado”** nesse painel de Novos Negócios, para ficar alinhado à ideia de **demanda tratável em um só lugar**.

**Importante:**  
Isso é **complementar** ao módulo **Sirene** (próximo tópico): Sirene é a **central de chamados formal** (ticket com tópicos, Bombeiro, HDM, etc.). O painel em Novos Negócios é a **visão operacional dos chamados/checklist** espalhados pelos funis de Portfolio e Operações (e afins).

---

## Chamados (Sirene) — o que mudou

**Antes:**  
Não existia no produto um **módulo único** de “Sirene” com esse desenho.

**Agora:**  
**Sirene** é a **central de chamados** da operação: abrir chamado, tipos (padrão / HDM), dashboard, lista, kanban por status, detalhe do chamado, notificações no sino, fluxos de resolução e aprovação de tópicos (conforme papel: time, Bombeiro, criador).  
Com o tempo foram acrescentados **campos mais ricos nas notificações** (título, mensagem, referência ao chamado), para o aviso na interface ficar mais claro — especialmente em eventos como **menções** em comentários.

---

## Portal Frank — o que é e o que o franqueado pode ou não pode

**O que é:**  
O **Portal Frank** é o **espaço logado** pensado para o perfil **franqueado** (e correlatos): login próprio (`/portal-frank/login`), **home** com os **cards dos funis** que lhe dizem respeito, **validação trimestral** da rede quando aplicável, e visão da **rede** em rota dedicada.

**O que o franqueado pode (em linha geral):**  
Acessar **Novos Negócios** nas rotas liberadas para o papel: painel hub, **Portfolio**, **Operações**, **Funil Acoplamento**, **Funil Step One**, **dashboard** de Novos Negócios, **perfil**, além do próprio portal e **rede** (no portal, a navegação de “Rede de Franqueados” aponta para a experiência do franqueado).

**O que o franqueado não pode (regra geral):**  
Entrar em áreas **só da matriz** (ex.: **Sirene**, comunidade/rede “completa” como quem é admin, contabilidade/crédito administrativo, etc.). No **card**, a **aba de envio de e-mail** fica **oculta** para quem está no contexto Portal Frank — para não misturar ações internas de e-mail com a experiência do franqueado.

---

## Checklist estrutural da fase — o que é novo

**Antes:**  
Checklist “de card” no mundo do **painel por etapas** (processo) era a referência mais antiga.

**Agora:**  
Cada **fase do kanban** pode ter um **checklist configurável**: itens com rótulo, tipo (texto curto/longo, e-mail, telefone, número, caixa de marcação, anexo, **modelo para baixar e devolver assinado**, etc.), obrigatoriedade, e se o item aparece ou não para o **candidato** no formulário público.  
As respostas ficam **gravadas por card e por item** (valor em texto e, quando couber, **caminho de arquivo** no storage).

---

## Formulário público para candidato — o que é e como funciona

**O que é:**  
Um **link único** (com **token** e prazo) que **não exige login** do candidato. Abre a página **Formulário do Candidato** e mostra só os itens do checklist marcados como **visíveis para o candidato**.

**Como funciona:**  
Quem está no time **gera o link** a partir do card (no fluxo do funil). O candidato preenche e envia; anexos e modelos assinados sobem de forma segura (URLs assinadas e APIs pensadas para o token). O time acompanha as respostas no **checklist** do card. Pode existir integração com **e-mail do candidato** guardado no token para **pré-preencher** destinatário na aba de e-mail do card (quando aplicável).

---

## Área de e-mail nos cards — o que é novo

**Antes:**  
Não havia, no mesmo modal do card, um bloco explícito para **montar e enviar um e-mail** (assunto, mensagem, destinatário).

**Agora:**  
No modal do card há **abas**: comentários e **e-mail**. O time pode enviar mensagem (via integração de envio configurada no projeto), com sugestão de **e-mail do franqueado** e, quando houver formulário com token, **e-mail do candidato** cadastrado no link.

---

## Aprovação de fase — o que é e como funciona

**O que é:**  
Quando alguém tenta **avançar o card** para a próxima fase e ainda existem **itens de checklist obrigatórios em aberto**, o sistema **não deixa passar direto**: abre um fluxo para **solicitar aprovação** ao **Bombeiro** (papel definido no módulo Sirene).

**Como funciona:**  
É criado um registro de **solicitação** (pendente / aprovado / rejeitado). Quem tem papel de **Bombeiro** vê essas pendências e **aprova ou rejeita**; só depois disso o time consegue **concluir a mudança de fase** de forma alinhada à regra. Isso amarra **disciplina de checklist** com **governança** da operação.

---

## Notificações — o que mudou

**Antes:**  
Notificações mais “cruas” ou genéricas (menos contexto na própria linha do aviso).

**Agora:**  
No **Sirene**, as notificações passaram a suportar **título**, **texto da mensagem** e **ligação com o chamado** (referência), para cada aviso ser **entendido na hora** — por exemplo, ao abrir chamado, receber HDM, ou quando alguém é **mencionado** num comentário. O **sino** no topo continua sendo o lugar de ver as últimas e marcar como lidas.

---

## Resumo em uma frase por bloco

| Tema | De → para |
|------|-----------|
| Funis | “Um nome único” → **vários funis** (Portfólio, Operações, Step One, …) + **hub** que ainda junta os dois primeiros no painel. |
| Cards | Só processo/painel → **card no kanban** + ficha rica (checklist, link candidato, e-mail, aprovação). |
| Tarefas / painel NN | “Tarefas” → **Painel de Chamados** (mesma família de dados; vocabulário alinhado à operação). |
| Sirene | — → **Chamados formais** com papéis, tópicos e notificações evoluídas. |
| Portal Frank | — → **Casa do franqueado** com rotas claras; **sem** Sirene e **sem** aba de e-mail no card. |
| Checklist de fase | Checklist antigo do processo → **itens por fase do kanban** + respostas por card. |
| Formulário candidato | — → **Link com prazo**, sem login, anexos e modelo assinado. |
| E-mail no card | — → **Aba e-mail** no modal com pré-preenchimento quando existir. |
| Aprovação de fase | — → **Bombeiro** valida avanço quando checklist exige. |
| Notificações | Mais secas → **título + mensagem + referência** onde couber (Sirene). |

---

*Documento gerado para alinhamento interno; detalhes de implementação podem evoluir com novas entregas.*
