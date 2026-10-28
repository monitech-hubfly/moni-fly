# Cadastro de Corretores

Cadastro da Rede Casa Moní. Não é o Kanban Funil Corretores.

Quem vê e edita: `profiles.role` admin ou team. Frank não acessa. A lista fica na aba **Cadastro de Corretor** em `/rede-franqueados`.

## Onde está

| Caminho | O que é |
|---|---|
| `/rede-franqueados` → aba Cadastro de Corretor | Lista, busca, aprovar, editar |
| `/corretores/novo` | Cadastro interno. Status padrão: ativo. Também mostra o link do formulário público |
| `/cadastro/corretor` | Formulário público, sem login |
| `/cadastro/corretor/enviado` | Confirmação depois do envio |
| `POST /api/public/cadastro-corretor` | Grava o formulário público |

O Kanban em `/corretores` é o **Funil Corretores** (leads). O formulário `/formulario-corretor/[token]` alimenta esse funil. Os dois não gravam em `rede_corretores`.

## Tabela `rede_corretores`

Migrations: `534` (tabela e RLS), `535` (status pendente), `536` (área de atuação), `538` (aprovação, link e e-mail).

Código `CR` + número, largura 4. O próximo é o maior existente + 1 (`CR0001`, `CR0002`…). Se alguém informar um código `CR` válido, esse código é usado.

### Campos

**Identificação.** Nome ou razão social (obrigatório). CPF/CNPJ. Código `n_corretor`. Ordem numérica do código.

**CRECI.** Número, UF, tipo de registro, validade.

Tipos: Estagiário, Técnico em Transações Imobiliárias, Corretor Titular.

**Atuação.** UFs (lista) e cidades `{ ibge_id, nome, uf }`.

**Contato.** E-mail e celular.

**Banco.** Código e nome do banco, agência, conta, tipo (corrente ou poupança), titular, tipo e chave Pix. Se o titular vier vazio, o nome do corretor entra no lugar.

**Cadastro.** Status, observações, `link_simulador`, `email_enviado_em`, quem criou, quem atualizou, datas.

Linha sem nome não aparece na lista.

### Status

| Valor | Rótulo | Quando |
|---|---|---|
| `pendente` | Pendente | Formulário público, esperando revisão |
| `em_analise` | Em análise | Padrão antigo da tabela, antes do fluxo público |
| `aprovado` | Aprovado | Botão Aprovar na lista |
| `ativo` | Ativo | Cadastro feito pelo time em `/corretores/novo` |
| `inativo` | Inativo | Arquivar |

Só o nome é obrigatório. CPF/CNPJ, CRECI, e-mail, celular e Pix são validados só quando preenchidos.

## Formulário público

Sem login. A rota está liberada para anônimo. Até 8 envios por IP a cada 15 minutos.

O visitante não escolhe status. O servidor grava `pendente` e gera o `CR`. A resposta é: cadastro recebido, aguarde a análise. A tela seguinte é `/cadastro/corretor/enviado`.

O time copia esse link em `/corretores/novo` e pode mandar pelo WhatsApp.

## Cadastro interno

Admin ou team. Em `/corretores/novo` o status inicial é ativo, salvo se a ficha mandar outro. O botão Novo Corretor da aba também abre a ficha.

Editar e arquivar (status inativo) passam pela mesma permissão. Busca por código, nome, documento, CRECI, contato, banco, Pix, cidades, status e observações. A lista ordena pelo número do `CR`.

## Aprovar

O ícone de aprovar só aparece em status `pendente`. Ele grava `aprovado`.

O trigger `fn_corretor_aprovado` (migration 538), na mudança para `aprovado`:

- monta `link_simulador` = `https://simulador.moni.casa/formulario?corretor_id={id}`
- se houver e-mail e a chave `app.supabase_service_key` no banco, chama a Edge Function `email-corretor-aprovado` em produção

O comentário da migration diz que o domínio do simulador deve ser trocado pelo domínio real. O link não é o da jornada `/empreendimento/[slug]` do Hub Fly.

## Quem pode ver

RLS: select, insert, update e delete só para `profiles.role` admin ou team. O formulário público usa o client admin no servidor, não a sessão do visitante. `service_role` também tem grant.

## Ligação com empreendimento

`imob_corretor_empreendimentos` liga `rede_corretores` a um empreendimento. No cadastro de empreendimentos imobiliários o time marca quais corretores atuam ali. Isso não cria card no Funil Corretores.

## Arquivos

- `src/lib/rede-corretores.ts` — tipos, rótulos, busca, leitura
- `src/lib/rede-corretor-persist.ts` — validação, insert, URL pública
- `src/lib/rede-corretor-ficha-draft.ts` — rascunho da ficha
- `src/lib/next-cr-corretor.ts` — próximo código CR
- `src/components/RedeCorretorFichaForm.tsx` — ficha
- `src/components/CadastroCorretorPublicoForm.tsx` — envio público
- `src/app/rede-franqueados/rede-corretores-actions.ts` — criar, atualizar, arquivar, aprovar
- `src/app/rede-franqueados/RedeCorretoresTabelaComBusca.tsx` — tabela
- `supabase/migrations/534_rede_corretores.sql`
- `supabase/migrations/535_rede_corretores_status_pendente.sql`
- `supabase/migrations/536_rede_corretores_area_atuacao.sql`
- `supabase/migrations/538_rede_corretores_fn_aprovado.sql`
