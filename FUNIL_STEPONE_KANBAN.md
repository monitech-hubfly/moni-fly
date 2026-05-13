# Kanban Funil Step One

## Visão Geral

O Kanban "Funil Step One" foi criado como um board independente para gerenciar o processo de mapeamento e viabilidade inicial de novos negócios.

## Estrutura

### Fases do Kanban (em ordem)

1. **Dados da Cidade** - SLA: 7 dias
2. **Lista de Condomínios** - SLA: 7 dias
3. **Dados dos Condomínios** - SLA: 10 dias
4. **Lotes disponíveis** - SLA: 7 dias
5. **Mapa de Competidores** - SLA: 7 dias
6. **BCA + Batalha de Casas** - SLA: 14 dias
7. **Hipóteses** - SLA: 7 dias

### Rotas Criadas

- `/funil-stepone` - Página principal do Kanban
- `/funil-stepone/novo` - Formulário para criar novo card
- `/funil-stepone/[id]` - Página de detalhes do card

### Navegação

O Kanban aparece no menu lateral em **Novos Negócios > Funil Step One**, posicionado ANTES de "Portfolio + Operações".

## Funcionalidades

### Visualização do Kanban

- Todas as 7 fases são exibidas em colunas horizontais
- Cada coluna mostra:
  - Nome da fase
  - Quantidade de cards
  - SLA da fase (em dias)
- Cards exibem:
  - Título
  - Data de criação
  - Status do SLA (atrasado, vence hoje, vence amanhã, dias restantes)
  - Nome do franqueado (apenas para admin/consultor)

### Criação de Cards

- Botão "+ Novo card" no header da página
- Formulário simples com:
  - Título do card
  - Fase inicial (seletor com todas as 7 fases)
- Cards são automaticamente associados ao franqueado que os criou

### Detalhes do Card

- Edição do título
- Movimentação entre fases (via seletor)
- Visualização de informações:
  - Data de criação
  - Status do SLA
  - Responsável (apenas para admin/consultor)
- Ação de arquivar card

## Permissões (RLS)

### Tabela `kanbans`
- **Leitura**: Todos os usuários autenticados
- **Escrita**: Apenas admin/consultor

### Tabela `kanban_fases`
- **Leitura**: Todos os usuários autenticados
- **Escrita**: Apenas admin/consultor

### Tabela `kanban_cards`
- **Leitura**: Dono do card OU admin/consultor
- **Inserção**: O `franqueado_id` deve ser o próprio usuário OU admin/consultor
- **Atualização**: Dono do card OU admin/consultor
- **Exclusão**: Dono do card OU admin/consultor

## Design

### Cores

O Kanban usa as cores de identidade definidas em `moni-tokens.css`:

- **Primária**: `var(--moni-kanban-stepone)` - Verde Naval escuro (#0C2633)
- **Light**: `var(--moni-kanban-stepone-light)` - Verde Naval claro (#e8eef1)
- **Accent**: `var(--moni-kanban-stepone-accent)` - Verde Naval médio (#3e7490)

### Tags de SLA

- **Atrasado**: Tag vermelha (`.moni-tag-atrasado`)
- **Atenção** (vence hoje ou amanhã): Tag dourada (`.moni-tag-atencao`)
- **Normal**: Texto simples com dias restantes

## Banco de Dados

### Migration: `091_step_one_kanban.sql`

O arquivo de migração cria:

1. **Tabela `kanbans`**
   - `id` (UUID, PK)
   - `nome` (TEXT)
   - `ordem` (INT) - ordem no menu
   - `cor_hex` (TEXT)
   - `ativo` (BOOLEAN)

2. **Tabela `kanban_fases`**
   - `id` (UUID, PK)
   - `kanban_id` (UUID, FK)
   - `nome` (TEXT)
   - `ordem` (INT)
   - `sla_dias` (INT)
   - `ativo` (BOOLEAN)

3. **Tabela `kanban_cards`**
   - `id` (UUID, PK)
   - `kanban_id` (UUID, FK)
   - `fase_id` (UUID, FK)
   - `franqueado_id` (UUID, FK)
   - `titulo` (TEXT)
   - `status` (TEXT) - 'ativo' ou 'arquivado'
   - `created_at` (TIMESTAMPTZ)

4. **Seed inicial**
   - Cria o Kanban "Funil Step One" com `ordem = 1`
   - Insere as 7 fases com seus respectivos SLAs

## Como Rodar a Migration

```bash
# Via Supabase CLI
supabase db push

# Ou aplicar manualmente no Supabase Dashboard > SQL Editor
```

## Próximos Passos

Para estender o Kanban, você pode:

1. Adicionar campos customizados aos cards (descrição, anexos, etc.)
2. Implementar comentários em cards
3. Adicionar drag & drop para mover cards entre fases
4. Criar filtros por franqueado, data, SLA
5. Adicionar notificações quando o SLA estiver próximo do vencimento
6. Gerar relatórios de tempo médio por fase

## Arquivos Criados

```
src/app/funil-stepone/
├── page.tsx                          # Página principal do Kanban
├── KanbanColumn.tsx                  # Componente de coluna
├── novo/
│   ├── page.tsx                      # Página do formulário
│   └── NovoCardForm.tsx              # Componente do formulário
└── [id]/
    ├── page.tsx                      # Página de detalhes
    └── CardDetailClient.tsx          # Componente de detalhes (client)

supabase/migrations/
└── 091_step_one_kanban.sql           # Migration do banco de dados

src/components/
└── PortalSidebar.tsx                 # (modificado) - adiciona rota no menu
```

## Observações Importantes

- **Sem laranja**: Conforme solicitado, nenhuma cor laranja foi utilizada no design
- **Padrão visual**: Segue exatamente o mesmo padrão dos Kanbans existentes (Jurídico, Sirene)
- **Responsivo**: Cards e colunas se adaptam a diferentes tamanhos de tela
- **Performance**: Build otimizado com 1.26 kB para a página principal
