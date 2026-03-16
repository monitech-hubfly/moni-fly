# Sirene — Central de Chamados: próximos passos

Documento de mapeamento: o que já está feito e o que falta implementar, na ordem sugerida.

---

## ✅ Já implementado

| Área | O que existe |
|------|----------------|
| **Banco** | Migrations 034 (tabelas `sirene_*`, bucket, RLS) e 035 (HDM: `tipo`, `hdm_responsavel`, `profiles.time`, RLS time HDM). |
| **Tipos / Lib** | `src/types/sirene.ts` (Chamado, Topico, HdmTime, RedirecionarHDMInput). `src/lib/sirene.ts` (canActAsBombeiro, formatarStatus, calcularProgressoTopicos). |
| **Actions** | criarChamado (tipo/hdm, notifica Bombeiro ou time HDM), redirecionarParaHDM, definirPrioridade, salvarResolucaoPontual, aprovarTopico, reprovarTopico, fecharChamado, listChamados, getDashboardData, getChamado, getNotificacoesResumo, marcarNotificacaoLida. |
| **Layout** | Header único (Portal, Sirene, usuário), abas (Dashboard \| Chamados \| Kanban \| Perícias), sino de notificações com dropdown e marcar lida. |
| **Dashboard** | 4 KPIs, Chamados por status, Satisfação 1º atendimento, Chamados com trava + recentes, Minhas tarefas pendentes (links para /sirene/[id]). |
| **Chamados** | Lista com filtro Tipo (Todos/Padrão/HDM), botão Novo chamado, modal com toggle HDM e select do time, cards com borda vermelha/azul e tag HDM. |
| **Kanban** | 3 colunas por status, mesmo filtro por tipo, cards clicáveis para o detalhe, estilo HDM. |
| **Detalhe [id]** | Breadcrumb, header do chamado, banners HDM, botão Redirecionar para HDM (só padrão), blocos “Resolução e tópicos” e “Fechamento” (texto “em implementação”). |
| **Perícias** | Tab com placeholder e texto da estrutura futura. |
| **Notificações** | Criação em criarChamado e redirecionarParaHDM; sino no header com últimas 10 e marcar lida. |

---

## Próximos passos (prioridade sugerida)

### 1. Detalhe do chamado — fluxo completo

- [ ] **Resolução pontual**  
  Editor de tópicos (não só textarea): lista de tópicos com descrição, time, datas (início/fim), status.  
  Usar actions já existentes: `salvarResolucaoPontual` (Bombeiro/HDM).

- [ ] **Tópicos**  
  - Lista de tópicos do chamado com status e ações por papel:  
    - Time: atribuir responsável, salvar resolução do time, concluir tópico.  
    - Bombeiro / time HDM: aprovar ou reprovar tópico (com motivo).  
  - Actions já existem: falta UI (atribuir responsável pode exigir action nova se ainda não existir).

- [ ] **Bloco de fechamento (Bombeiro)**  
  Formulário para parecer final + tema + mapeamento de perícia, botão “Enviar para o criador julgar”.  
  Usar `fecharChamado` já existente.

- [ ] **Julgamento do criador**  
  Bloco “Foi suficiente?” (SIM/NÃO). Se NÃO: campo motivo e reabertura (status volta a em_andamento, notificação chamado_reaberto).  
  Action `julgarChamado` a criar ou completar (ex.: `julgarChamado(chamadoId, suficiente, motivo?)`).

- [ ] **Chat do chamado**  
  Canal de mensagens por chamado (`sirene_mensagens`): listar mensagens, enviar nova mensagem.  
  Opcional: Realtime (Supabase channel em `sirene_mensagens`) e @menções (preencher `mencoes` e criar notificação tipo `mencao`).

- [ ] **Upload de anexos**  
  No detalhe (e/ou no modal de abertura): upload para bucket `sirene-attachments`, gravar em `sirene_anexos` (chamado_id, opcional topico_id).  
  RLS do bucket já existe na 034.

---

### 2. Formulário de abertura (Novo chamado)

- [ ] **Select de franqueados com busca**  
  Se houver tabela de franqueados ou lista de usuários “frank”: select pesquisável para preencher frank_id / frank_nome (ou equivalente).

- [ ] **Upload de anexos na abertura**  
  Opcional: anexos já no modal de novo chamado, enviados junto com `criarChamado` (inserir em `sirene_anexos` após criar o chamado).

---

### 3. Notificações — todos os eventos

Garantir criação de registro em `sirene_notificacoes` (e, se aplicável, envio para participantes) nos eventos abaixo. Parte já feita em criarChamado e redirecionarParaHDM.

| Evento | Quem recebe | Tipo | Status |
|--------|-------------|------|--------|
| Chamado aberto | Bombeiro (ou time HDM se tipo HDM) | novo_chamado / chamado_hdm_recebido | ✅ |
| Resolução pontual salva | Criador + times com tópico | resolucao_pontual / topico_atribuido | Pendente |
| Tópico concluído pelo time | Bombeiro | aprovacao_solicitada | Pendente |
| Tópico aprovado/reprovado pelo Bombeiro | Time do tópico | topico_aprovado / topico_reprovado | Pendente |
| Chamado enviado para julgamento | Criador | chamado_fechado | Pendente |
| Chamado concluído (criador aprova) | Participantes | chamado_concluido | Pendente |
| Chamado reaberto (criador reprova) | Bombeiro + times | chamado_reaberto | Pendente |
| @Menção em mensagem | Usuário mencionado | mencao | Pendente |
| Redirecionamento para HDM | Time HDM | chamado_hdm_recebido | ✅ |

Integrar essas notificações nas actions correspondentes (ex.: ao aprovar/reprovar tópico, ao fechar chamado, ao julgar chamado, ao enviar mensagem com menção).

---

### 4. Tab Perícias (Caneta Verde)

- [ ] **Lista de perícias**  
  Listar `sirene_pericias` com filtros (status, responsável, etc.).

- [ ] **Vinculação com chamados concluídos**  
  Ao fechar/julgar chamado com tema e mapeamento, criar ou vincular registro em `sirene_pericias` / `sirene_pericia_chamados` (conforme regra de negócio).

- [ ] **Select com busca no Planejamento de Perícias**  
  Se existir tabela de planejamento de perícias: campo “nome da perícia” como select pesquisável; ao selecionar, preencher responsável, data prevista, prioridade.

- [ ] **Painéis**  
  “Perícias em andamento” (cards com nome, responsável, status, % chamados vinculados resolvidos) e “Histórico de chamados por perícia” (ao clicar na perícia, listar chamados vinculados).

---

### 5. Ajustes de UX e dados

- [ ] **Dashboard — Chamados aguardando julgamento do criador**  
  Seção ou painel listando chamados em estado “fechar” (enviados para o criador) para o criador ver onde precisa julgar.

- [ ] **Popular `profiles.time`**  
  Para usuários dos times HDM (Homologações, Produto, Modelo Virtual), preencher `profiles.time` para RLS e `canActAsBombeiro` funcionarem corretamente.

- [ ] **Kanban — arrastar e soltar**  
  Opcional: drag-and-drop para mover card entre colunas e atualizar `status` do chamado (action de atualização de status).

- [ ] **Indicador na aba Chamados**  
  Opcional: ponto vermelho ou badge na aba “Chamados” quando houver notificações não lidas relacionadas a chamados (pode reutilizar `getNotificacoesResumo`).

---

### 6. Realtime (opcional)

- [ ] **Chat**  
  Subscription ao canal `sirene_chamado_{id}` em `sirene_mensagens` para atualizar mensagens em tempo real na página do chamado.

- [ ] **Sino**  
  Atualizar contagem/listagem de notificações em tempo real (ex.: subscription em `sirene_notificacoes` para `user_id = auth.uid()`).

---

## Ordem sugerida de implementação

1. **Detalhe do chamado**: tópicos (lista + ações) e bloco de fechamento (parecer, tema, mapeamento) + julgamento do criador.  
2. **Notificações**: disparar nos eventos listados acima.  
3. **Chat** no detalhe (listar + enviar; depois Realtime e @menções se fizer sentido).  
4. **Upload de anexos** (detalhe e, se quiser, abertura).  
5. **Formulário de abertura**: select de franqueados com busca (se houver fonte de dados).  
6. **Tab Perícias**: lista, vinculação, select planejamento, painéis.  
7. **Ajustes**: painel “aguardando julgamento”, `profiles.time`, drag Kanban, indicador na aba Chamados.

---

## Referência rápida de arquivos

| O quê | Onde |
|-------|------|
| Actions | `src/app/sirene/actions.ts` |
| Tipos | `src/types/sirene.ts` |
| Helpers | `src/lib/sirene.ts` |
| Layout + abas + sino | `src/app/sirene/layout.tsx`, `SireneShell.tsx` |
| Dashboard | `src/app/sirene/page.tsx`, `DashboardSirene.tsx` |
| Lista Chamados | `src/app/sirene/chamados/page.tsx`, `ChamadosLista.tsx`, `ModalNovoChamado.tsx` |
| Kanban | `src/app/sirene/kanban/page.tsx`, `KanbanBoard.tsx` |
| Detalhe chamado | `src/app/sirene/[id]/page.tsx`, `DetalheChamadoConteudo.tsx`, `ModalRedirecionarHDM.tsx` |
| Perícias | `src/app/sirene/pericias/page.tsx` |
| Migrations | `supabase/migrations/034_sirene.sql`, `035_sirene_hdm.sql` |
