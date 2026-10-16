# FAQ Moní — Referência Completa (pós-implementação)
**Hub Fly > Universidade > FAQ**
Atualizado: 2026-09-23 | Status: DEV ✅ PROD ✅ — Feature completa

---

## ⚠️ Diferenças críticas: prompt original → código real

Estas correções foram confirmadas durante a implementação no Cursor e aplicadas ao código final:

| Item | Prompt original (incorreto) | Implementado (correto) |
|------|-----------------------------|------------------------|
| `visibility` tipo | `text` enum | `text[]` array — usar `.contains('visibility', ['frank'])` |
| Coluna feedback | `helpful` | `was_helpful` |
| Coluna busca | `results_count` | `result_count` |
| Rota CTA Sirene | `/sirene/novo` | `/sirene/chamados` |
| Search | DB `ilike` | Client-side via `semAcento()` |
| Types TS | Nomes DB em inglês | Interface em português com `map*()` |
| PROD | Pendente | ✅ Aplicado (migrations 577–580) |

---

## 1. Status das Migrations

| Ambiente | Status | Migrations |
|----------|--------|-----------|
| DEV (`bgaadvfucnrkpimaszjv`) | ✅ Aplicado | 577, 578, 579, 580 |
| PROD (`aydryzoxqnwnbybvgiug`) | ✅ Aplicado | 577, 578, 579, 580 |

### O que cada migration fez

| Migration | Ação |
|-----------|------|
| `577_faq_rls.sql` | RLS: frank SELECT em artigos publicados e categorias ativas |
| `578_faq_conteudo_2026.sql` | 39 artigos novos + 2 revisados; 3 categorias novas; renomes de categoria; trigger slug auto |
| `579_faq_archive_contratos_permuta.sql` | Arquivou artigos antigos de Contratos (18 → 1) e Permuta (10 → 1); slugs preservados: `contrato-franquia-estrutura` e `permuta-como-funciona` |
| `580_faq_deactivate_categories.sql` | Desativou categorias sem artigos publicados |

**Totais pós-migração:** 10 categorias ativas, 41 artigos publicados.

---

## 2. Schema Real do Banco

> Os nomes de coluna abaixo são os nomes **reais no Supabase**. A camada de código mapeia para nomes em português (ver seção 4).

### `faq_categories`

```sql
id             uuid PRIMARY KEY DEFAULT gen_random_uuid()
name           text NOT NULL
description    text
icon           text                          -- nome Lucide ou emoji; pode ser null
slug           text UNIQUE NOT NULL
display_order  integer DEFAULT 0
is_active      boolean DEFAULT true
created_at     timestamptz DEFAULT now()
```

### `faq_articles`

```sql
id               uuid PRIMARY KEY DEFAULT gen_random_uuid()
category_id      uuid REFERENCES faq_categories(id)
question         text NOT NULL
short_answer     text
answer           text                        -- markdown completo (remark-gfm)
status           text DEFAULT 'draft'        -- 'draft' | 'published' | 'archived'
display_order    integer DEFAULT 0
responsible_area text
keywords         text[]
synonyms         text[]
is_featured      boolean DEFAULT false
visibility       text[]                      -- ⚠️ ARRAY: ['frank'], ['admin'], ['todos']
review_due_at    timestamptz
slug             text UNIQUE NOT NULL        -- OBRIGATÓRIO, não auto-gerado
created_at       timestamptz DEFAULT now()
updated_at       timestamptz DEFAULT now()
```

### `faq_related_articles`

```sql
article_id         uuid REFERENCES faq_articles(id)
related_article_id uuid REFERENCES faq_articles(id)
PRIMARY KEY (article_id, related_article_id)
```

### `faq_feedback`

```sql
id         uuid PRIMARY KEY DEFAULT gen_random_uuid()
article_id uuid REFERENCES faq_articles(id)
user_id    uuid
was_helpful boolean                         -- ⚠️ was_helpful, NÃO helpful
created_at timestamptz DEFAULT now()
```

### `faq_searches`

```sql
id           uuid PRIMARY KEY DEFAULT gen_random_uuid()
query        text
result_count integer                        -- ⚠️ result_count, NÃO results_count
user_id      uuid
searched_at  timestamptz DEFAULT now()
```

### RLS (migration 577)

```sql
-- Frank pode ler artigos publicados visíveis
CREATE POLICY "frank_can_read_faq" ON faq_articles
  FOR SELECT TO authenticated
  USING (
    status = 'published'
    AND (visibility @> ARRAY['frank'] OR visibility @> ARRAY['todos'])
  );

-- Frank pode ler categorias ativas
CREATE POLICY "frank_can_read_categories" ON faq_categories
  FOR SELECT TO authenticated
  USING (is_active = true);

-- Qualquer autenticado pode inserir feedback e buscas
CREATE POLICY "authenticated_insert_feedback" ON faq_feedback
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated_insert_searches" ON faq_searches
  FOR INSERT TO authenticated WITH CHECK (true);
```

---

## 3. Categorias e Artigos (41 publicados)

| # | Slug | Nome | Ícone | Artigos |
|---|------|------|-------|---------|
| 1 | `terrenos` | Terrenos | 🏗️ | 6 |
| 2 | `aprovacoes` | Aprovações e Pré-Obra | 📋 | 5 |
| 3 | `obra` | Obra | 🏠 | 5 |
| 4 | `tecnologia` | Tecnologia e Hub Fly | 💻 | 5 |
| 5 | `entrega` | Entrega e Pós-Obra | 🔑 | 5 |
| 6 | `monicare` | Moní Care | 🛡️ | 4 |
| 7 | `marca` | Licenciamento e Marca | ®️ | 4 |
| 8 | `suporte` | Suporte e Comunidade | 🤝 | 5 |
| 9 | `contratos` | Contratos e Garantias | 📝 | 1 |
| 10 | `permuta` | Permuta | 🔄 | 1 |
| | | **Total** | | **41** |

### Artigos por categoria

**Terrenos (6):** Como funciona a busca e seleção de terrenos pela Moní · Quais são os critérios mínimos para aprovação · O que é o estudo de viabilidade (BCA) · Qual é o prazo entre aprovação e assinatura do contrato · Posso usar um terreno que já possuo · O que acontece se o terreno for reprovado após a opção

**Aprovações e Pré-Obra (5):** Documentos para o alvará · Quanto tempo demora a aprovação na prefeitura · O que é o Habite-se e quando é emitido · Quem é responsável pelo projeto legal · O que é INSS de obra

**Obra (5):** Como funciona o acompanhamento da obra · Etapas padrão e prazos · O que é o Gbox e como é utilizado · Medição e liberação de crédito por tranche · O que fazer em caso de atraso

**Tecnologia e Hub Fly (5):** O que é o Hub Fly · Como faço login · Como uso o funil Step One · O que é o Sirene e como abro chamado · Como funciona a Universidade Moní

**Entrega e Pós-Obra (5):** Como funciona a entrega das unidades · Documentos para entrega · O que é o Moní Care · Prazo de garantia das unidades · Atendimento pós-entrega

**Moní Care (4):** O que está incluído no Moní Care · Como aciono o Moní Care · O que não está coberto · Como funciona o atendimento técnico

**Licenciamento e Marca (4):** Regras de uso da marca Moní · O que posso e não posso fazer com a identidade visual · Como funciona o contrato de franquia · O que acontece em descumprimento das regras

**Suporte e Comunidade (5):** Canais de suporte disponíveis · Como funciona a comunidade de franqueados · Como acesso os eventos de franqueados · Problema urgente, o que fazer · Como envio sugestões de melhoria

**Contratos e Garantias (1):** Como funciona a estrutura de contratos e garantias na operação Moní · slug: `contrato-franquia-estrutura`

**Permuta (1):** Como funciona a permuta na operação Moní · slug: `permuta-como-funciona`

---

## 4. Tipos TypeScript

**Arquivo:** `src/types/faq.ts`

A interface usa **nomes em português** — mapeados de colunas inglesas pelo `faq-actions.ts`.

```typescript
export interface FaqCategory {
  id: string;
  nome: string;            // DB: name
  descricao: string | null; // DB: description
  icone: string | null;    // DB: icon
  slug: string;
  ordem: number;           // DB: display_order
  ativo: boolean;          // DB: is_active
}

export interface FaqArticle {
  id: string;
  categoria_id: string;        // DB: category_id
  pergunta: string;            // DB: question
  resposta_resumida: string;   // DB: short_answer
  resposta_completa: string | null; // DB: answer
  status: 'draft' | 'published' | 'archived';
  ordem: number;               // DB: display_order
  area_responsavel: string | null; // DB: responsible_area
  palavras_chave: string[];    // DB: keywords (text[])
  sinonimos: string[];         // DB: synonyms (text[])
  destaque: boolean;           // DB: is_featured
  visibilidade: 'frank' | 'admin' | 'todos'; // DB: visibility (text[])
  proxima_revisao: string | null; // DB: review_due_at
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface FaqCategoryWithArticles extends FaqCategory {
  artigos: FaqArticle[];
}
```

---

## 5. Server Actions

**Arquivo:** `src/lib/actions/faq-actions.ts`

```typescript
'use server';
import { createClient } from '@/lib/supabase/server';
import type { FaqCategory, FaqArticle } from '@/types/faq';

// Seletores alinhados com colunas reais do banco
const CATEGORY_SELECT = 'id, name, description, icon, slug, display_order, is_active';
const ARTICLE_SELECT  = 'id, category_id, question, short_answer, answer, status, ' +
  'display_order, responsible_area, keywords, synonyms, is_featured, ' +
  'visibility, review_due_at, slug, created_at, updated_at';

// Mappers: DB inglês → interface portuguesa
function mapCategory(row: any): FaqCategory {
  return {
    id:       row.id,
    nome:     row.name,
    descricao: row.description,
    icone:    row.icon,
    slug:     row.slug,
    ordem:    row.display_order,
    ativo:    row.is_active,
  };
}

function mapVisibilidade(vis: string[] | null): FaqArticle['visibilidade'] {
  if (!vis) return 'frank';
  if (vis.includes('todos')) return 'todos';
  if (vis.includes('admin')) return 'admin';
  return 'frank';
}

function mapArticle(row: any): FaqArticle {
  return {
    id:               row.id,
    categoria_id:     row.category_id,
    pergunta:         row.question,
    resposta_resumida: row.short_answer,
    resposta_completa: row.answer,
    status:           row.status,
    ordem:            row.display_order,
    area_responsavel: row.responsible_area,
    palavras_chave:   row.keywords ?? [],
    sinonimos:        row.synonyms ?? [],
    destaque:         row.is_featured,
    visibilidade:     mapVisibilidade(row.visibility),
    proxima_revisao:  row.review_due_at,
    slug:             row.slug,
    created_at:       row.created_at,
    updated_at:       row.updated_at,
  };
}

// Busca tudo de uma vez para o Server Component
// Retorna { categories, articles } FLAT — não nested
export async function getFaqAllPublished(): Promise<{
  categories: FaqCategory[];
  articles: FaqArticle[];
}> {
  const supabase = await createClient();
  const [{ data: cats }, { data: arts }] = await Promise.all([
    supabase.from('faq_categories')
      .select(CATEGORY_SELECT)
      .eq('is_active', true)
      .order('display_order'),
    supabase.from('faq_articles')
      .select(ARTICLE_SELECT)
      .eq('status', 'published')
      .contains('visibility', ['frank'])  // ⚠️ text[] — NÃO .in() ou .eq()
      .order('display_order'),
  ]);
  return {
    categories: (cats ?? []).map(mapCategory),
    articles:   (arts ?? []).map(mapArticle),
  };
}

// Busca artigos de uma categoria específica
export async function getFaqArticlesByCategory(categoryId: string): Promise<FaqArticle[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('faq_articles')
    .select(ARTICLE_SELECT)
    .eq('category_id', categoryId)
    .eq('status', 'published')
    .contains('visibility', ['frank'])
    .order('display_order');
  return (data ?? []).map(mapArticle);
}

// Search: fetch todos publicados + filter client-side (evita problema com text[] e keywords)
export async function searchFaqArticles(query: string): Promise<FaqArticle[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('faq_articles')
    .select(ARTICLE_SELECT)
    .eq('status', 'published')
    .contains('visibility', ['frank'])
    .order('display_order');
  const todos = (data ?? []).map(mapArticle);
  const q = semAcento(query.toLowerCase());
  return todos.filter(a =>
    semAcento(a.pergunta).includes(q) ||
    semAcento(a.resposta_resumida ?? '').includes(q) ||
    a.palavras_chave.some(k => semAcento(k).includes(q)) ||
    a.sinonimos.some(s => semAcento(s).includes(q))
  );
}

// Registrar busca (fire-and-forget) — coluna: result_count
export async function recordFaqSearch(query: string, result_count: number): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  supabase.from('faq_searches')
    .insert({ query, result_count, user_id: user?.id })
    .then(() => {});
}

// Registrar feedback — coluna: was_helpful
export async function recordFaqFeedback(articleId: string, was_helpful: boolean): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('faq_feedback')
    .insert({ article_id: articleId, was_helpful, user_id: user?.id });
}

// Normalização de acentos (helper — pode ser importado de @/lib/utils)
function semAcento(str: string): string {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
```

---

## 6. Estrutura de Arquivos

```
src/
  types/
    faq.ts                              ← interfaces PT (mapeia colunas EN)

  lib/
    actions/
      faq-actions.ts                    ← server actions com mappers
    faq/
      queries.ts                        ← layer mais antiga (admin + slug pages)

  app/
    universidade/
      faq/
        page.tsx                        ← Server Component
        FaqClient.tsx                   ← Client Component (busca, painel)
        FaqCategoryCard.tsx             ← Card de categoria
        FaqArticlePanel.tsx             ← Painel lateral deslizante
        [slug]/
          page.tsx                      ← Página individual por slug (existia antes)

    admin/
      universidade/
        faq/
          page.tsx                      ← Admin FAQ (usa lib/faq/queries, não faq-actions)
```

---

## 7. Componentes — Detalhes de Implementação

### `page.tsx` (Server Component)

```typescript
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getFaqAllPublished } from '@/lib/actions/faq-actions';
import { FaqClient } from './FaqClient';

export const dynamic = 'force-dynamic';

export default async function FaqPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/universidade/faq');

  let categories: FaqCategory[] = [];
  let articles: FaqArticle[] = [];
  let erro = false;
  try {
    const data = await getFaqAllPublished();
    categories = data.categories;
    articles   = data.articles;
  } catch { erro = true; }

  return <FaqClient categories={categories} articles={articles} erro={erro} />;
}
```

> `getFaqAllPublished` retorna `{ categories, articles }` — **flat**, não nested. O `FaqClient` monta o `Map<categoryId, articles>` client-side com `useMemo`.

### `FaqClient.tsx` — pontos críticos

```typescript
// Chips fixos
const CHIPS = ['Carta Fiança', 'Hub Fly', 'Alvará', 'Terrenista', 'Sirene', 'Habite-se'];

// Map de artigos por categoria (memoizado)
const porCategoria = useMemo(() => {
  const m = new Map<string, FaqArticle[]>();
  categories.forEach(c => m.set(c.id, []));
  articles.forEach(a => m.get(a.categoria_id)?.push(a));
  return m;
}, [categories, articles]);

// Keyboard shortcut: ⌘K / Ctrl+K foca a barra de busca
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      buscaRef.current?.focus();
    }
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}, []);

// Search: debounce 300ms → searchFaqArticles; 500ms inatividade → recordFaqSearch
// CTA card → /sirene/chamados  ⚠️ (NÃO /sirene/novo)

// Highlight de resultados
function destacar(texto: string, termo: string): React.ReactNode { /* regexTermo */ }
```

### `FaqCategoryCard.tsx`

```typescript
const LIMITE = 4; // artigos mostrados por padrão
const [expandido, setExpandido] = useState(false);

// Ícone: DB icon → Lucide component ou emoji
// emojiFallback(nome, slug): fallback por padrão no slug
const EMOJI_POR_CHAVE: Record<string, string> = {
  terreno: '🏗️', aprovac: '📋', obra: '🏠',
  tecnologia: '💻', entrega: '🔑', monicare: '🛡️',
  marca: '®️', suporte: '🤝', contratos: '📝', permuta: '🔄',
};
```

### `FaqArticlePanel.tsx`

```typescript
// Painel fixo à direita, 560px desktop / full width mobile
// Slide-in: translate-x-full → translate-x-0 via CSS transition
// Fecha: Escape, overlay, botão ✕
// body.style.overflow = 'hidden' enquanto aberto
// Markdown: ReactMarkdown + remarkGfm (tabelas, blockquotes, bold, listas)
// Feedback: votar(helpful) → recordFaqFeedback; estado: votos: Record<string, Voto>
// Reset enviando/erroVoto no change de artigo?.id (useEffect)

// Estilos markdown via Tailwind selectors:
// [&_th]:bg-[var(--moni-navy-800)]
// [&_blockquote]:border-[var(--moni-gold-400)]
// etc.
```

---

## 8. Design da Página

### Layout

```
[ HERO — fundo var(--bg) off-white ]
  "Como podemos ajudar?"
  "Base de conhecimento Moní para franqueados"
  [ Search pill — ícone lupa — hint ⌘K ]
  [ Chips: Carta Fiança | Hub Fly | Alvará | Terrenista | Sirene | Habite-se ]

[ GRID 3 col (desktop) / 2 col (tablet) / 1 col (≤640px) ]
  Cards de categoria: ícone + nome + seta | 4 perguntas + "Ver mais X →"
  Último slot: card navy — "Não encontrou o que precisa?" → /sirene/chamados

[ PAINEL LATERAL — slide-in direita, z-index > sidebar ]
  badge categoria · pergunta (weight 800)
  borda gold → resposta resumida
  markdown completo (remark-gfm)
  badge área responsável
  Sim / Não feedback
```

### Tokens usados

```css
--moni-navy-800      /* card CTA, headers painel, th markdown */
--moni-gold-400      /* borda resposta resumida, highlight busca, blockquote */
--moni-green-800     /* acentos secundários */
--moni-earth-800     /* texto corpo */
--moni-radius-lg     /* border-radius cards */
--moni-font-display  /* headings */
--moni-font-sans     /* corpo */
```

**Regras inegociáveis:** nunca hex direto, nunca laranja, bordas 0.5px via `--moni-border-width`.

---

## 9. Rota `/universidade/faq/[slug]` (existente, preservada)

- Usa `getFaqArtigoPorSlug` de `src/lib/faq/queries` (layer mais antiga, inglês direto)
- Breadcrumb: Universidade Moní → FAQ → [categoria] → [pergunta]
- Artigos relacionados via `getFaqRelacionados` ou `getFaqMesmaCategoria` como fallback
- Componente `FaqArtigoInteracoes` para feedback / copiar link / ver / chamar

---

## 10. Admin FAQ — `/admin/universidade/faq`

- Auth: `role === 'admin' || role === 'team'`
- Usa `getFaqArtigosAdmin` e `getFaqCategoriasAdmin` de `src/lib/faq/queries`
- Renderiza `AdminFaqClient`
- **Não usa** `faq-actions.ts` — mantém o layer antigo inglês

---

## 11. Dependências instaladas

```bash
npm install remark-gfm   # necessário para ReactMarkdown renderizar tabelas, blockquotes
```

---

## 12. Checklist de verificação (pós-deploy)

- [x] Migration 577 (RLS) — DEV e PROD
- [x] Migration 578 (conteúdo 41 artigos) — DEV e PROD
- [x] Migration 579 (arquivar antigos Contratos/Permuta) — DEV e PROD
- [x] Migration 580 (desativar categorias vazias) — DEV e PROD
- [x] remark-gfm instalado
- [x] TypeScript OK
- [x] Frank acessa `/universidade/faq` sem erro 403
- [ ] Confirmar search "carta fiança", "sirene", "alvará" retorna resultados
- [ ] Confirmar painel abre/fecha (Escape, overlay, X)
- [ ] Confirmar mobile 640px: grid 1 col, painel full width
- [ ] Confirmar zero hex hardcoded nos novos componentes
- [ ] Confirmar CTA aponta para `/sirene/chamados`
- [ ] Confirmar feedback insere em `was_helpful`
- [ ] Confirmar busca registra em `result_count`

---

## 13. Armadilhas para futuras manutenções

1. **`visibility` é `text[]`** — sempre `.contains('visibility', ['frank'])`, nunca `.eq()` ou `.in()`.
2. **Nomes de colunas no banco são inglês** — a interface TS usa português. Qualquer novo campo precisa de entrada no `mapArticle()` / `mapCategory()`.
3. **Search é client-side** — `searchFaqArticles` busca todos os artigos publicados e filtra em memória. Aceitável para ~41 artigos; se crescer muito, migrar para FTS no Postgres.
4. **`slug` é obrigatório** — a migration 578 incluiu um trigger temporário `tr_faq_article_slug_if_null` para auto-gerar durante o seed; foi descartado ao final. Inserções futuras precisam de slug explícito.
5. **Team redireciona para `/admin/universidade`** — middleware redireciona role `team` que acessa `/universidade`. Frank acessa normalmente.
6. **Artigos de Contratos/Permuta arquivados** — slugs preservados: `contrato-franquia-estrutura` e `permuta-como-funciona`. Não reusar esses slugs.
7. **Admin usa layer separado** — `src/lib/faq/queries.ts` (inglês direto) é usado por `[slug]/page.tsx` e `/admin/universidade/faq`. Não misturar com `faq-actions.ts`.
