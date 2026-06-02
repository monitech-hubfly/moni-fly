# Regras de conclusão do chamado (criador)

Documento para stakeholders — vigente após migração 228 e alterações de fluxo Sirene/Kanban.

## A) Quem conclui o chamado (regra CARD)

- **Somente o criador** (quem abriu o chamado: `aberto_por` / `criado_por` na interação) pode marcar o chamado como **concluído**.
- O **Bombeiro não precisa** enviar “fechamento” nem colocar o chamado em `aguardando_aprovacao_criador` para o criador poder concluir.
- O status `aguardando_aprovacao_criador` permanece no sistema apenas para **dados legados**; o fluxo normal não depende mais dele.
- A mesma regra vale em: lista Sirene (`/sirene/chamados`), detalhe (`/sirene/[id]`), modal de chamado e **todos os funis** (modal de card / `atualizarStatusInteracao`).
- O Bombeiro pode continuar registrando parecer, tema e mapeamento de perícia **sem** bloquear a conclusão pelo criador.

## B) Tempo médio do 1º atendimento (dashboard)

- **Antes:** `data_inicio_atendimento` era preenchida quando o Bombeiro salvava os tópicos pela primeira vez.
- **Agora:** é registrada na **primeira vez** em que **qualquer atividade** (`sirene_topicos` / sub-interação) passa para **`em_andamento`**.
- O cálculo do KPI no dashboard (`getDashboardData`) **não mudou** — apenas a origem do campo.

## C) Satisfação do criador (KPI e UX)

- Quando **todas as atividades** estão encerradas (`concluido` ou `aprovado`), o criador pode:
  1. **Concluir o chamado** (caminho suficiente) → `resolucao_suficiente = true`, status `concluido`; ou
  2. Marcar **“resolução não foi suficiente”** → `resolucao_suficiente = false`, chamado volta para **`em_andamento`** e novas atividades podem ser abertas.
- O KPI de satisfação no dashboard continua baseado em `resolucao_suficiente` entre chamados já avaliados pelo criador.
- Não é necessário fechamento prévio do Bombeiro.

## D) Texto obrigatório na conclusão

- Ao concluir (lista, detalhe ou card), o criador deve preencher um **campo de texto** e confirmar.
- O texto é gravado em `info_conclusao_criador` (chamado Sirene) ou na interação Kanban quando não há vínculo Sirene.
- Em caso de “não suficiente”, o mesmo campo registra o **motivo** (`motivo_insuficiente` no chamado Sirene).

## E) Prazo negociado

- Painel de negociação de prazo (`PrazoNegociacaoPanel`) disponível nas atividades da lista e do modal de detalhe Sirene, alinhado ao card modal.

## F) Chamados legados sem `sirene_chamado_id`

- Interações antigas em `kanban_atividades` **sem** vínculo em `sirene_chamados` continuam visíveis na lista Sirene (`v_atividades_unificadas`) e no card.
- **Conclusão:** o criador preenche `info_conclusao_criador` só na interação Kanban; não há espelho em `sirene_chamados` nem KPI de satisfação Sirene para esses registros.
- **Primeiro atendimento:** `data_inicio_atendimento` não se aplica (campo existe apenas em `sirene_chamados`).
- **Novos chamados** abertos pelo card ou pela Sirene passam por `criarChamadoSireneComAtividade`, que cria `sirene_chamados` + `kanban_atividades` + `sirene_topicos` de forma consistente.
- Não há backfill automático de `sirene_chamado_id` para legado; migração manual seria necessária caso stakeholders queiram unificar KPIs.
