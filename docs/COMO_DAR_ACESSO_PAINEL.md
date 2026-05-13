# Passo a passo — Dar acesso ao Painel (consultor ou admin)

Para um usuário acessar a página **Painel Moní** (`/painel`), o perfil dele precisa ter `role` = **consultor** ou **admin**. Por padrão, novos usuários são criados com `role` = **frank**.

Siga os passos abaixo no **Supabase**.

---

## 1. Abrir o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e faça login.
2. Clique no **projeto** que você usa para o app Viabilidade (ex.: viabilidade-moni).

---

## 2. Abrir a tabela `profiles`

1. No **menu lateral esquerdo**, clique em **Table Editor** (ícone de tabela).
2. Na lista de tabelas, clique em **profiles**.

---

## 3. Localizar o usuário

1. Na tabela `profiles` você verá colunas como: **id**, **role**, **full_name**, **email**, **consultor_id**, **created_at**, **updated_at**.
2. Encontre a **linha** do usuário que deve ter acesso ao Painel:
   - Use o **email** (se a coluna estiver visível) ou o **full_name** para identificar.
   - Se a tabela for grande, use a **busca/filtro** no canto superior da tabela (se existir) ou role a lista.

---

## 4. Editar o campo `role`

1. Clique na **célula** da coluna **role** dessa linha (onde hoje deve estar **frank**).
2. A célula ficará editável. Altere o valor para:
   - **admin** — vê todos os processos de todos os Franks no Painel.
   - **consultor** — vê no Painel apenas os processos dos Franks da sua carteira (Franks cujo `consultor_id` = id desse consultor).
3. Confirme a edição:
   - Em alguns layouts: clique no **✓** (check) ou pressione **Enter**.
   - Ou clique fora da célula para salvar.

---

## 5. Conferir

1. Verifique se a célula **role** daquele usuário está exibindo **admin** ou **consultor** (sem espaços, em minúsculo).
2. No app, faça **logout** e **login** de novo com esse usuário (ou use em outra aba em modo anônimo).
3. Acesse **http://localhost:3000/painel** (ou o link “Painel” no menu).
4. Se estiver tudo certo, a página do Painel será exibida (tabela de processos). Se o usuário ainda for **frank**, será redirecionado para a home.

---

## Resumo rápido

| Passo | Onde | O que fazer |
|-------|------|-------------|
| 1 | Supabase | Entrar no projeto |
| 2 | Table Editor → **profiles** | Abrir a tabela de perfis |
| 3 | Tabela **profiles** | Achar a linha do usuário (email/nome) |
| 4 | Célula **role** dessa linha | Trocar **frank** por **admin** ou **consultor** e salvar |
| 5 | App | Login com esse usuário e abrir `/painel` |

---

## Consultor e carteira de Franks

- **admin**: vê todos os processos no Painel.
- **consultor**: vê só processos dos Franks que **pertencem** a ele. Isso é definido pelo campo **consultor_id** na tabela **profiles**: se o perfil do **Frank** tiver `consultor_id` = id do **consultor**, esse Frank faz parte da carteira do consultor.

Para colocar um Frank na carteira de um consultor:

1. Na tabela **profiles**, localize a linha do **Frank** (o usuário que é franqueado).
2. Na coluna **consultor_id** dessa linha, preencha com o **id** (UUID) do perfil do **consultor** (copie o valor da coluna **id** da linha do consultor em **profiles**).
3. Salve. A partir daí, no Painel (logado como consultor) aparecerão os processos desse Frank.
