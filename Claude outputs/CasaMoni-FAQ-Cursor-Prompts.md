# Cursor Prompts — FAQ Moní (Hub Fly > Universidade > FAQ)

Dois prompts em sequência. Aplicar na ordem.

---

## PROMPT 1 — Banco de Dados e Camada de Dados

```
Contexto:
- Projeto: moni-fly (Next.js 14, App Router, TypeScript, Tailwind, Supabase)
- Ambiente DEV: bgaadvfucnrkpimaszjv.supabase.co
- A migration SQL já foi preparada e está em: supabase/migrations/[NNN]_faq_moni.sql
  (se ainda não existir, criar com o conteúdo do arquivo CasaMoni-FAQ-Migration-2026.sql)

Tarefa: Criar a camada de dados para o FAQ dentro da Universidade.

---

1. VERIFICAR SE AS TABELAS JÁ EXISTEM no banco DEV:
   - faq_categories (id, nome, descricao, icone, slug, ordem, ativo)
   - faq_articles (id, categoria_id, pergunta, resposta_resumida, resposta_completa,
     status, ordem, area_responsavel, palavras_chave text[], sinonimos text[],
     destaque bool, visibilidade, proxima_revisao date, slug auto-gerado)
   - faq_related_articles, faq_feedback, faq_searches

   Se não existirem, criar via migration antes de prosseguir.

2. CRIAR O ARQUIVO: src/lib/actions/faq-actions.ts

   Exportar as seguintes server actions/queries (use o Supabase client server-side):

   a) getFaqCategories(): Promise<FaqCategory[]>
      - SELECT * FROM faq_categories WHERE ativo = true ORDER BY ordem ASC

   b) getFaqArticlesByCategory(categoriaId: string): Promise<FaqArticle[]>
      - SELECT * FROM faq_articles
        WHERE categoria_id = $1 AND status = 'published' AND visibilidade = 'frank'
        ORDER BY ordem ASC

   c) getFaqAllPublished(): Promise<{ categories: FaqCategory[]; articles: FaqArticle[] }>
      - Busca todas as categorias ativas + todos os artigos published/frank em uma chamada eficiente
      - Retornar agrupado por categoria

   d) searchFaqArticles(query: string): Promise<FaqArticle[]>
      - Full-text search usando ilike em pergunta, resposta_resumida e palavras_chave::text
      - Limitar a 20 resultados

   e) recordFaqSearch(query: string, results_count: number): Promise<void>
      - INSERT em faq_searches (query, results_count, searched_at)
      - Não bloquear o fluxo — usar fire-and-forget

   f) recordFaqFeedback(articleId: string, helpful: boolean): Promise<void>
      - INSERT em faq_feedback (artigo_id, helpful, created_at)

3. CRIAR O ARQUIVO: src/types/faq.ts

   Exportar as interfaces TypeScript baseadas no schema:

   export interface FaqCategory {
     id: string;
     nome: string;
     descricao: string | null;
     icone: string | null;
     slug: string;
     ordem: number;
     ativo: boolean;
   }

   export interface FaqArticle {
     id: string;
     categoria_id: string;
     pergunta: string;
     resposta_resumida: string;
     resposta_completa: string | null;
     status: 'draft' | 'published' | 'archived';
     ordem: number;
     area_responsavel: string | null;
     palavras_chave: string[];
     sinonimos: string[];
     destaque: boolean;
     visibilidade: 'frank' | 'admin' | 'todos';
     proxima_revisao: string | null;
     slug: string;
     created_at: string;
     updated_at: string;
   }

   export interface FaqCategoryWithArticles extends FaqCategory {
     artigos: FaqArticle[];
   }

4. RLS: garantir que frank consegue fazer SELECT em faq_articles WHERE visibilidade = 'frank'.
   Se não existir política, adicionar:
   CREATE POLICY "frank_can_read_faq" ON faq_articles
     FOR SELECT TO authenticated
     USING (status = 'published' AND visibilidade IN ('frank', 'todos'));

   Mesma política em faq_categories (ativo = true).

Não criar nenhuma página ou componente neste prompt. Apenas o tipo e as actions.
```

---

## PROMPT 2 — Página FAQ no Hub Fly (Universidade)

```
Contexto:
- Projeto: moni-fly (Next.js 14, App Router, TypeScript, Tailwind, Supabase)
- Design system: src/styles/moni-tokens.css — SEMPRE usar variáveis CSS, nunca hex hardcoded
- Nunca usar laranja. Nunca usar em dash.
- Paleta Moní: --moni-navy-800 (#0C2633), --moni-gold-400 (#D4AD68), --moni-green-800 (#2F4A3A), --moni-earth-800 (#4A3929)
- A camada de dados já existe em src/lib/actions/faq-actions.ts e src/types/faq.ts
- A feature vive dentro de /universidade — verificar como a seção está estruturada
  (provavelmente src/app/universidade/) e seguir o mesmo padrão de layout/sidebar

Tarefa: Criar a página Central de Ajuda FAQ dentro da Universidade.

---

ROTA: /universidade/faq

ARQUIVOS A CRIAR:
- src/app/universidade/faq/page.tsx  (Server Component — busca os dados)
- src/app/universidade/faq/FaqClient.tsx  (Client Component — toda interatividade)
- src/app/universidade/faq/FaqCategoryCard.tsx  (componente de card de categoria)
- src/app/universidade/faq/FaqArticlePanel.tsx  (painel lateral deslizante)

---

LAYOUT DA PÁGINA (seguir exatamente este design):

[ HERO ]
- Fundo: warm off-white (#F5F3EF via var(--bg) ou similar do moni-tokens)
- Heading grande: "Como podemos ajudar?"
- Subtítulo pequeno: "Base de conhecimento Moní para franqueados"
- Barra de busca centralizada, pill shape, com ícone de lupa e hint ⌘K
- Chips de buscas comuns clicáveis abaixo da busca:
  "Carta Fiança", "Hub Fly", "Alvará", "Terrenista", "Sirene", "Habite-se"

[ GRID DE CATEGORIAS ]
- 3 colunas no desktop, 2 no tablet, 1 no mobile
- Cada card tem:
  - Cabeçalho: ícone + nome da categoria + seta →
  - Lista das primeiras 4 perguntas (pergunta truncada se longa) com seta →
  - Se tiver mais de 4: link "Ver mais X artigos →" no rodapé do card
- Cards com bordas sutis (1.5px), border-radius 14px, sombra leve
- Hover: sombra aumenta levemente, seta do header anima para a direita
- Último slot da grid: card escuro (navy) "Não encontrou o que precisa?" com botão
  "Abrir chamado no Sirene" que linka para /sirene/novo

[ PAINEL LATERAL (Sheet/Drawer) ]
- Slide-in da direita, largura 560px (full width em mobile)
- Overlay semitransparente com blur no fundo
- Fechar: botão ✕, tecla Escape, click no overlay
- Conteúdo do painel:
  - Topo: badge com nome da categoria + botão fechar
  - Heading: pergunta completa (font-size grande, font-weight 800)
  - Resposta resumida em card destacado (borda esquerda gold)
  - Resposta completa em markdown renderizado:
    - Tabelas com header navy
    - Blockquotes com borda gold
    - Bold em navy
    - Listas com bullet correto
  - Rodapé: badge da área responsável + botão "Isso foi útil?" (sim/não)
    → ao clicar, chamar recordFaqFeedback(articleId, helpful)

[ BUSCA ]
- Ao digitar, esconder grid e mostrar lista de resultados em tempo real
- Chamar searchFaqArticles(query) com debounce de 300ms
- Highlight do termo buscado nos resultados (mark com background gold claro)
- Ao selecionar resultado: abrir painel lateral com o artigo
- Resultado vazio: mensagem + link para Sirene
- Ao limpar busca: voltar ao grid
- Registrar busca após 500ms de inatividade: recordFaqSearch(query, count)

[ ATALHO ⌘K ]
- Focar a barra de busca ao pressionar Cmd+K / Ctrl+K

---

CATEGORIAS E ÍCONES (referência para mapear com o banco):
- Terrenos: 🏗️
- Aprovações e Pré-Obra: 📋
- Obra: 🏠
- Tecnologia e Hub Fly: 💻
- Entrega e Pós-Obra: 🔑
- Moní Care: 🛡️
- Licenciamento e Marca: ®️
- Suporte e Comunidade: 🤝
- Contratos e Garantias: 📝
- Permuta: 🔄

Nota: os ícones provavelmente já estão salvos na coluna `icone` de faq_categories.
Se a coluna icone vier nula, usar o mapeamento acima como fallback por slug.

---

SIDEBAR/MENU:
- Verificar src/components/PortalSidebar.tsx (ou equivalente dentro de /universidade)
- Adicionar item "Central de Ajuda" ou "FAQ" no menu da Universidade linkando para /universidade/faq
- Seguir exatamente o mesmo padrão de item de menu já existente na seção Universidade

---

MIDDLEWARE:
- Verificar src/lib/supabase/middleware.ts
- Garantir que /universidade/faq está na lista de rotas permitidas para `frank`
  (provavelmente /universidade já está coberto — confirmar antes de adicionar)

---

RESTRIÇÕES TÉCNICAS:
- Usar APENAS variáveis do moni-tokens.css para cores — nunca hex direto no código
- border-radius de cards: var(--moni-radius-lg) ou equivalente (12px)
- Bordas: var(--moni-border-width) (0.5px) ou 1.5px via Tailwind
- Fontes: var(--moni-font-display) para headings, var(--moni-font-sans) para corpo
- Nunca usar orange/laranja em nenhum elemento
- Mobile breakpoint: 640px
- O painel lateral deve usar position: fixed com z-index acima de sidebar
- Animações: apenas transition (não usar framer-motion a menos que já exista no projeto)

---

VERIFICAÇÃO FINAL ANTES DE COMMITAR:
1. Frank consegue acessar /universidade/faq sem erro de permissão
2. Busca retorna resultados para "carta fiança", "sirene", "alvará"
3. Painel abre e fecha corretamente (Escape, overlay click, botão ✕)
4. Em mobile (640px): grid vira 1 coluna, painel ocupa full width
5. Não há hex hardcoded no código — apenas variáveis CSS
6. Link "Abrir chamado no Sirene" no card dark aponta para /sirene/novo
```

---

## NOTAS DE CONTEXTO PARA OS DOIS PROMPTS

**Migration SQL pronta:** `CasaMoni-FAQ-Migration-2026.sql`
- 2 renomeações de categoria existentes
- 3 novas categorias inseridas
- 39 artigos novos (INSERT com WHERE NOT EXISTS)
- 2 artigos revisados (UPDATE + fallback INSERT)
- Aplicar em DEV primeiro: `bgaadvfucnrkpimaszjv.supabase.co`
- Confirmar antes de aplicar em PROD: `aydryzoxqnwnbybvgiug.supabase.co`

**Categorias após migration:**
| Slug | Nome | Artigos |
|------|------|---------|
| terrenos | Terrenos | 6 |
| aprovacoes | Aprovações e Pré-Obra | 5 |
| obra | Obra | 5 |
| tecnologia | Tecnologia e Hub Fly | 5 |
| entrega | Entrega e Pós-Obra | 5 |
| monicare | Moní Care | 4 |
| marca | Licenciamento e Marca | 4 |
| suporte | Suporte e Comunidade | 5 |
| contratos | Contratos e Garantias | 1 (revisado) |
| permuta | Permuta | 1 (revisado) |
| **Total** | | **41 artigos** |
