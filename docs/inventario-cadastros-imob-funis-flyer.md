# Inventário completo — Cadastros · Loteadores · Portfólio · IMOB · Corretores · Flyer

> Gerado a partir do código em `funcionalidade-ingrid` (set/2026).  
> Fonte canônica de UUIDs/slugs: `src/lib/constants/kanban-ids.ts`.  
> Hub de cadastros: `/rede-franqueados`.

---

## 0. Mapa rápido

| Domínio | Hub / rota | Tabela principal | Kanban relacionado |
|---------|------------|------------------|--------------------|
| Empreendimentos IMOB | `?tab=imob-empreendimentos` | `imob_empreendimentos` | via `card_id` + `imob_card_*` |
| Corretores (ficha) | `?tab=corretores` | `rede_corretores` | — (sem FK no funil) |
| Franqueados | `?tab=franqueados` | `rede_franqueados` | Step One (`rede_franqueado_id`) |
| Loteadores (ficha) | `?tab=loteadores` | `rede_loteadores` | Funil Loteadores (`rede_loteador_id`) |
| Condomínios | `?tab=condominios` | `condominios` | `kanban_cards.condominio_id` |
| Funil Loteadores | `/loteadores` | `kanban_cards` | UUID `3e7b6ec7-…` |
| Funil Portfólio | `/portfolio` | `kanban_cards` | UUID `c57120a0-…` |
| Funil Corretores | `/corretores` | `kanban_cards` (leads) | UUID `1e23c356-…` |
| Simulações IMOB | seção no modal do card | `imob_card_modelo` + `imob_card_empreendimentos` | quase todos os funis |
| Flyer A5 | botão na tabela IMOB | HTML + params URL | `public/flyermoniv6.html` |

**Não confundir:** Funil Loteadores ≠ Funil Motor 01 (`/funil-motor01`, slugs `m1_*`).

---

## 1. Cadastro de empreendimentos (IMOB)

### Rotas e UI
- `/rede-franqueados?tab=imob-empreendimentos`
- Componentes: `ImobEmpreendimentosTabelaComBusca.tsx`, `imob-empreendimentos-actions.ts`, `src/lib/imob-empreendimentos.ts`
- Link simulador externo: `https://moni.casa/corretor?token={share_token}`
- Botão **Gerar Flyer** por linha

### Banco
- Migration base: `537_imob_empreendimentos.sql` → `imob_empreendimentos` (`nome`, `slug`, `ativo`, `tipologias`/`opcionais`/`condicoes` JSONB)
- N:N corretores: `imob_corretor_empreendimentos`
- **Gap:** o código também usa `specs`, `imagem_url`, `share_token`, `card_id`, `condominio_id` — podem existir no DEV/PROD sem migration versionada completa neste tree
- Satélites de card: migrations `540`–`544` (`imob_card_*`)

### Campos no modal CRUD
- Nome *, condomínio (`condominio_id`), specs, imagem URL, ativo
- Toggle N:N de corretores
- **Não há UI** para editar `tipologias` / `opcionais` / `condicoes` JSONB da 537

### Regras / RLS
- SELECT anon: só `ativo = true`
- WRITE: admin|team (`requireImobStaff` / `emp_write_admin_team`)
- Staff authenticated vê ativos + gestão

### O que está preenchido vs stub
- **Preenchido:** CRUD, vínculo corretor/condomínio, flyer, share link
- **Stub/gap:** editor JSONB tipologias; drift schema migration vs código

---

## 2. Cadastro de corretores (`rede_corretores`)

### Rotas
| Path | Papel |
|------|--------|
| `/rede-franqueados?tab=corretores` | Lista CRUD staff |
| `/corretores/novo` | Cadastro interno (status ativo) |
| `/cadastro/corretor` | Form público → `pendente` |
| `/api/public/cadastro-corretor` | POST público (rate limit 8/15min) |
| `/corretores` | **Funil** de leads (outro sistema) |

### Banco (`534`–`538`)
Campos: `n_corretor`, `ordem`, `nome`*, CPF/CNPJ, CRECI (número/UF/tipo/validade), e-mail, telefone, `atuacao_ufs`/`atuacao_cidades`, conta bancária + PIX, `status` (`ativo|inativo|em_analise|pendente|aprovado`), auditoria.

### Regras
- RLS: **só admin|team** (Frank sem acesso à ficha)
- Público força `pendente`; aprovar via `aprovarRedeCorretor`
- Validações BR em `@/lib/br-docs`
- **Sem FK** para Funil Corretores — funil guarda leads em colunas do card

### Preenchido
CRUD + área de atuação + form público + aprovação. Funil de leads é paralelo.

---

## 3. Cadastro de franqueados (`rede_franqueados`)

### Rotas
- Hub `/rede-franqueados`, detalhe `/rede-franqueados/[id]`
- Portal: `/portal-frank`, `/portal-frank/cadastro`, `/due-diligence-frank`, `/minhas-empresas`
- Webhooks/invite: `/api/webhooks/novo-franqueado`, `/api/invite-frank`
- Import: `npm run rede-franqueados:import`

### Banco
Base `026_rede_franqueados.sql` + evoluções (`027`, `050`, `140`, `198`, `207` empresas, `320` SPE, `508` diagnóstico, `510` substituições…).

Campos de negócio: `n_franquia` (canônico `FK0000`), `nome_completo`, `status_franquia`, `classificacao_franqueado`, `modalidade`, datas COF/contrato/expiração, regional, área, contato, endereço, sócios, kit, responsável comercial (sensível), diag_*, anexos.

Relacionadas: `franqueado_empresas`, `franqueado_spe`, `profiles.rede_franqueado_id`, `kanban_cards.rede_franqueado_id`.

### Regras
- Gestão: `isRedeStaffRole` (admin|team)
- Colunas sensíveis: admin ou time ADM/Controladoria
- Frank: só própria linha no portal
- Cards Step One criados a partir da rede (`CriarCardsDesdeRedeButton`, etc.)

### Docs
`docs/REDE_FRANQUEADOS.md`, `docs/08-rede-frank/*` — **sistema mais maduro** do conjunto.

---

## 4. Cadastro de loteadores (`rede_loteadores`)

### Rotas
- Ficha: `/rede-franqueados?tab=loteadores`
- Funil: `/loteadores`, alias `/funil-moni-inc`
- Externo: `/loteador/[token]`, intake `/loteador/cadastro/[token]`

### Banco (`207`, `331`, `458`)
Grupos de campos:
1. Base: nome*, CNPJ, cidade/UF, contato, portfolio, status, `codigo`/`n_loteador`
2. Interlocutor
3. Condomínio prospect + anexos (planta/manual/casas)
4. Carteira (lotes disponíveis/vendidos, curta/longa)
5. Livre / material extra

Kanban: `kanban_cards.rede_loteador_id`; tokens `kanban_loteador_externo_tokens`; intake `kanban_loteador_intake_publico` (`526`).

### Regras
- RLS migration 207: admin|team (doc diz “Frank só visualiza” — conferir banco real)
- Intake: 1 token estável; cada envio = novo cadastro + card
- Título do card sincronizado com loteador/condomínio

### Preenchido
CRUD + CSV + funil + form externo + seeds (`522`/`523`).

---

## 5. Cadastro de condomínios (`condominios`)

### Rotas
- `/rede-franqueados?tab=condominios` (staff write; Frank leitura)
- Uso indireto: Step One Etapa 2, IMOB, cards Kanban, Gantt

**Não confundir com** `/rede` (`rede_contatos` legado) nem `processo_condominios` (por processo Step One).

### Banco (`208` + `247`/`323`/`377`/`415`)
Nome*, endereço, CEP, cidade, UF, descrição, tickets médios, estimativa vendas, extratos, `recuo_*_m`, prazos aprovação + `sla_tipo`. Satélite: `condominios_lotes` (`260`).

### Regras
- SELECT: admin|team **e** frank
- WRITE: admin|team
- FK ampla: `kanban_cards.condominio_id`, `imob_empreendimentos.condominio_id`, Gantt

### Preenchido
CRUD + CSV + prazos SLA. Recuos: conferir cobertura UI vs tipo.

---

## 6. Funil / Kanban Loteadores

| | |
|--|--|
| UUID | `3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c` |
| Rotas | `/loteadores`, `/funil-moni-inc` |
| Código fases | `src/lib/kanban/funil-loteadores.ts` → `LOTEADORES_FASES_CANONICAS` (**21** ativas) |
| UI | Board custom `KanbanLoteadoresBoardLoader` |

### Fases canônicas (código)

| # | Nome | Slug | SLA |
|---|------|------|-----|
| 1 | Entrar em contato | `primeiro_contato_moni_inc` | 1 |
| 2 | R1 Conceito | `r1_conceito_moni_inc` | 5 |
| 3 | NDA | `nda_moni_inc` | 3 |
| 4 | Opção | `opcao_moni_inc` | 3 |
| 5 | Aguardando Ficha | `aguardando_ficha_moni_inc` | 3 |
| 6 | Novo Produto | `novo_produto_moni_inc` | 20 |
| 7 | Viabilidade / Premissas | `viabilidade_moni_inc` | 1 |
| 8 | Acoplamento | `acoplamento_moni_inc` | 1 |
| 9 | Executar Material | `execucao_material_moni_inc` | 1 |
| 10 | Validação | `validacao_moni_inc` | 1 |
| 11 | R2 Apresentação | `r2_plano_teorico_moni_inc` | 5 |
| 12 | Revisões + Forma Pgto | `revisoes_moni_inc` | 2 |
| 13 | Acoplamento + Gbox | `acoplamento_gbox_moni_inc` | 5 |
| 14 | Comitê | `comite_moni_inc` | 3 |
| 15 | Revisões | `revisoes_pos_comite_moni_inc` | 2 |
| 16 | Cto c/ Precedentes | `cto_precedentes_moni_inc` | 3 |
| 17 | Diligência | `diligencia_moni_inc` | 10 |
| 18 | Cto Showroom | `cto_showroom_moni_inc` | 3 |
| 19 | Passagem para Waysers | `passagem_waysers_moni_inc` | 1 |
| 20 | Cto de Parceria | `contrato_parceria_moni_inc` | 3 |
| 21 | Assinados | `assinados_moni_inc` | — |

Deprecated: batalha, R3, Moní Capital, SPE, fechar_contrato. Doc `motor-01-loteadores.md` lista 20 (sem Assinados) — **desatualizado**.

### Gates e confirmações
- **Gate Comitê:** entrar em `comite_moni_inc` exige `acoplamento_concluido === true`
- **Assinou?** (só ao avançar): Opção, Comitê, Cto precedentes, Showroom, Parceria → colunas `loteadores_*` / `comite_aprovado`
- «Não» cancela o avanço
- SLA vencido: justificativa (`kanban_card_sla_justificativas`)

### Bastões automáticos
| Origem | Destino | Fase inicial |
|--------|---------|--------------|
| `acoplamento_moni_inc` / `acoplamento_gbox_moni_inc` | Acoplamento | `modelagem_terreno` |
| `passagem_waysers_moni_inc` | Operações (Pré Obra) | `planialtimetrico` |
| `loteador_juridico` (legado) | Jurídico | `juridico_recebimento` |

### Checklist por fase
Módulos `src/lib/kanban/loteadores-*.ts` + seed `512`. Exemplos:
- Primeiro contato: `pc_nome_responsavel`, tel, e-mail, perfil, data, R1 agendado
- NDA / Opção / Ficha / Viabilidade (`produto_escolhido`) / Material (`ppt_criado`) / Gbox (`memorial_descritivo`) / Comitê (decisão) / contratos (data+URL)

### Modal específico
Painel persistente `rede_loteador`, link externo, sync reunião/acoplamento, chips paralelas, IMOB.

### Migrations chave
`511`, `512`, `521`, `525` (Assinados), `533`, `514`–`519`, `527`, `532`.

---

## 7. Funil / Kanban Portfólio

| | |
|--|--|
| UUID | `c57120a0-991c-422b-8def-4d16a9411d45` |
| Rota | `/portfolio`, saúde `/portfolio/saude` |
| Fases ativas | **23** (pós migrations `559`/`560`) |

### Fases (ordem canônica)

| # | Nome | Slug | SLA |
|---|------|------|-----|
| 1 | Novo Negócio | `step_2` | 2 |
| 2 | Aprovação Moní - Novo Negócio | `aprovacao_moni_novo_negocio` | 2 |
| 3 | Enviar Opção | `step_3` | 3 |
| 4 | Jurídico Opção | `juridico_opcao` | 3 |
| 5 | Assinaturas Opção | `assinaturas_opcao` | 3 |
| 6 | Opção Assinada | `opcao_assinada` | 1 |
| 7 | Check Legal e Crédito | `step_4` | 3 |
| 8 | Pré Comitê | `pre_comite` | 3 |
| 9 | Acoplamento | `acoplamento` | 5 |
| 10 | Comitê | `step_5` | 5 |
| 11 | Revisões Comitê | `revisoes_comite` | 3 |
| 12 | 2º Comitê | `segundo_comite` | 5 |
| 13 | Enviar Cto c/ Precedentes | `cto_condicoes_precedentes` | — |
| 14 | Jurídico Cto c/ Precedentes | `juridico_cto_precedentes` | 3 |
| 15 | Assinaturas Cto c/ Precedentes | `assinaturas_cto_precedentes` | 3 |
| 16 | Cto c/ Precedentes Assinado | `cto_precedentes_assinado` | 1 |
| 17 | Diligência | `step_6` | 10 |
| 18 | Enviar Contrato s/ Precedentes | `step_7` | 3 |
| 19 | Jurídico Contrato s/ Precedentes | `juridico_contrato` | 3 |
| 20 | Assinaturas Contrato s/ Precedentes | `assinaturas_contrato` | 3 |
| 21 | Contrato s/ Precedentes Assinado | `contrato_s_precedentes_assinado` | 1 |
| 22 | Passagem p/ Wayser | `passagem_wayser` | 2 |
| 23 | Convertidos | `convertidos` | — (`fase_conversao`) |

Inativa: `captacao_moni_capital`.

### Confirmações
| Tipo | Sai de | Flags |
|------|--------|-------|
| Opção | `assinaturas_opcao` | `opcao_assinada(_em)` |
| Comitê | `step_5`, `segundo_comite` | `comite_aprovado(_em)` |
| Contrato | `assinaturas_contrato` | `contrato_assinado(_em)` |
| Chain | pós-Comitê | «Condições Precedentes?» (roteia destino) |

### Flags paralelas (`*_ok`) — chips
`acoplamento_concluido`, `credito_obra_ok`, `credito_terreno_ok`, `contabilidade_ok`, `juridico_ok`, `capital_ok`, `projetos_locais_ok`, `projetos_legais_ok`  
Setadas quando filhos entram em fases de conclusão (`portfolio-paralelas.ts` / `kanban-bastoes.ts`).

### Gates
- Gate Comitê Portfólio por esteiras: **removido** (sempre ok)
- Checklist Legal/Crédito: UI só em `step_4`; gate ao avançar
- Passagem Wayser: 7 checkboxes obrigatórios (`467`)

### Bastões automáticos
| Origem | Destino |
|--------|---------|
| `step_3` | Jurídico → `juridico_recebimento` |
| `acoplamento` | Acoplamento → `modelagem_terreno` |
| `step_7` | Contabilidade → `contabilidade_spe` |
| `passagem_wayser` | Operações → `planialtimetrico` |
| `captacao_moni_capital` (inativa) | Divify/Capital | |

Entrada: Step One Hipóteses → Portfólio `step_2`.  
Encerramento: Operações entregue 100% → card pai Portfólio `concluido`.

### Docs
`docs/02-operacoes/portfolio.md` é breve; inventário geral parcialmente desatualizado quanto ao nº de fases.

---

## 8. Simulações IMOB por card

### Princípio
**Não há motor de cálculo no Hub.** Valores são **manuais** (admin/team). Flyer só exibe o gravado.  
Seção no modal: **“Modelo e Simulações IMOB”** (todos os funis exceto Marketing).

### Tabelas
| Tabela | Papel |
|--------|--------|
| `imob_card_modelo` | 1:1 card — status, imagem principal, `preco_a_partir_de` |
| `imob_card_empreendimentos` | N linhas: `showroom` ou `empreendimento` |

Status: `em_breve` | `lancamento` | `em_construcao` | `pronto_pra_morar`.

### Campos ativos na UI (por linha)
`tipo`, `ordem`, `produto_modelo`, `titulo_oferta`, `ano_lancamento`, quartos/banheiros/vagas/`area_vendas_m2`, links, descrição, imagem oferta, `valor_avista`, `entrada`, `parcelas_mensais`.

### Legado no banco (não editado na UI atual)
Balões `balao_{parcial|quitado|lote}_{8|18|24}` e financiamento `fin_*` — tipos ainda em `imob-simulacoes-card.ts`.

### Como “chega ao resultado”
| Resultado | Regra |
|-----------|--------|
| À vista / entrada / parcelas | Digitação → `salvarImobSimulacaoEmpreendimento` (arredonda 2 casas) |
| A partir de | Manual em `preco_a_partir_de` |
| Prefill produto | 1º item ← `processo_step_one.produto_modelo_casa` se existir |
| Flyer tipologias | Até 4 linhas `tipo != showroom`, ordem |
| Specs flyer | `"{quartos}S · {banheiros}B · {area}m²"` |
| Moeda flyer | `R$` pt-BR, 0 casas |

Upload max 10 MB; storage `processo-docs`; escrita só admin|team.

### Actions
`listar/salvar/criar/excluir` + uploads em `src/lib/actions/imob-simulacoes-card.ts`. Sem rotas `/api/imob*`.

UI: `KanbanCardModalSimulacoesImob.tsx`.

---

## 9. Funil Corretores

| | |
|--|--|
| UUID | `1e23c356-9993-4f8e-9d09-e17995e8a5c6` |
| Rota | `/corretores` |
| Hub grupo | IMOB |
| Migrations | `548`, `549` (checklists), `554` (cols lead) |

### Fases
| # | Slug | Nome | SLA |
|---|------|------|-----|
| 1 | `cor_oportunidade` | Oportunidade | 1 |
| 2 | `cor_primeiro_contato` | Primeiro Contato | 2 |
| 3 | `cor_agendamento` | Agendamento de Visita | 3 |
| 4 | `cor_visita_realizada` | Visita Realizada | 5 |
| 5 | `cor_proposta_enviada` | Proposta Enviada | 5 |
| 6 | `cor_forecast` | Forecast | 10 |
| 7 | `cor_convertido` | Convertido | — (`fase_conversao`) |
| 8 | `cor_perdido` | Perdido | — |

### Regras de movimento
- Forecast → Convertido: confirmação modal (`corretores-confirmacao-fase.ts`)
- Perdido: **motivo obrigatório**; arquiva `resultado='perda'`
- Convertido: arquiva `resultado='ganho'`, motivo `'Convertido'`
- Bastão Pré-Obra: **TODO** (não dispara ainda)
- Novo card no board: só staff
- Checklist por fase: migration `549`

### Campos do lead no card
`nome_corretor`, `imobiliaria_corretor`, `empreendimento_interesse`, `tipologia_interesse` (Térrea/Sobrado/Campo/Praia/Outro), `orcamento_lead`, `probabilidade_fechamento` (25–90%, badge só Forecast), cidade/tel/e-mail/`mensagem_lead`.

### Entrada
1. Staff gera link (`gerarLinkCorretorLead` → `kanban_corretor_lead_tokens`)
2. Público `/formulario-corretor/[token]`
3. Submit → card em `cor_oportunidade`

**≠** cadastro `rede_corretores` (ficha da rede).

Sem doc em `docs/02-operacoes/`; inventário geral não lista Corretores.

---

## 10. Flyer IMOB (A5)

### Formato (inegociável) — `.cursor/rules/flyer-imob.mdc`
- Tela: **559 × 794 px**
- Impressão: **148 × 210 mm** A5, sem margens, frente = verso
- Template único: `public/flyermoniv6.html` (+ `moni-symbol-flyer.png`)
- Nunca especializar por condomínio/`emp_id`

### Fluxo
```
Tabela IMOB → Gerar Flyer → fetchFlyerData(id) → buildFlyerUrl → /flyermoniv6.html?<params>
```

### `fetchFlyerData` monta
Empreendimento → condomínio → pipeline (Loteadores|Portfólio pelo kanban do `card_id`) → modelo (hero, preço, status) → até 4 tipologias + showroom → corretores vinculados → signed URLs 7 dias.

### Params principais
Frente: `emp_nome`, `hero_img`, `status_imovel`, `ano_lancamento`, `cond_*`, `pipeline`, `p_valor`, `p_parcela`, QR.  
Verso: `cN_nome/area/quartos/banheiros/img/avista/entrada/parcela`.

### Bug conhecido
Hub grava `cN_parcelas` (plural); template lê `cN_parcela` (singular) → verso pode mostrar `"—"` nas parcelas. Frente usa `p_parcela` (ok).

### Legado
`public/corretor.html` aponta para `https://moni.casa/flyer` com params mínimos (sem tipologias do card).

---

## 11. Matriz de vínculos

```
rede_franqueados.id ──► kanban_cards.rede_franqueado_id     (Step One+)
rede_loteadores.id  ──► kanban_cards.rede_loteador_id       (Funil Loteadores)
condominios.id      ──► kanban_cards.condominio_id          (vários funis)
imob_empreendimentos.card_id ──► kanban_cards               (IMOB)
imob_card_*         ──► card_id                            (simulações)
rede_corretores     ──╳── Funil Corretores                 (sem FK)
rede_corretores     ──► imob_corretor_empreendimentos
```

---

## 12. Arquivos-índice

**Cadastros:** `src/app/rede-franqueados/*`, `docs/08-rede-frank/`, `docs/REDE_FRANQUEADOS.md`  
**Loteadores:** `src/lib/kanban/funil-loteadores.ts`, `loteadores-*.ts`, `docs/02-operacoes/motor-01-loteadores.md`  
**Portfólio:** `portfolio-fase-slugs.ts`, `portfolio-paralelas.ts`, `portfolio-confirmacao-fase.ts`, `docs/02-operacoes/portfolio.md`  
**Bastões/gates:** `src/lib/actions/kanban-bastoes.ts`, `card-actions.ts`  
**IMOB:** `imob-simulacoes-card.ts`, `KanbanCardModalSimulacoesImob.tsx`, migrations `537`–`544`  
**Corretores funil:** `src/app/corretores/`, `corretor-lead-actions.ts`, `548`/`549`/`554`  
**Flyer:** `.cursor/rules/flyer-imob.mdc`, `public/flyermoniv6.html`, `imob-empreendimentos-actions.ts`

---

## 13. Lacunas / drift conhecidos

1. Doc Loteadores: 20 fases vs código 21 (Assinados).
2. Inventário geral: Portfólio “10 fases” / Loteadores “19” — desatualizado (23 / 21).
3. Empreendimentos: colunas no código ausentes da migration 537 versionada.
4. Tipologias JSONB da 537 sem UI.
5. Flyer: mismatch `cN_parcelas` vs `cN_parcela`.
6. Funil Corretores: sem doc operacional; bastão Pré-Obra TODO; sem FK à ficha rede.
7. RLS Frank em loteadores: doc vs migration 207.
