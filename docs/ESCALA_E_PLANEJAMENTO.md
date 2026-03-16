# Escala e planejamento — ~150 usuários

A ferramenta unifica processos de todos os times da empresa, incluindo franqueados. A escala esperada é da ordem de **~150 logins**, com **hierarquias diferentes** (franqueado, consultor, admin, supervisor).

---

## O que já está preparado

- **Autenticação e perfis:** Supabase Auth e tabela `profiles` com `role` (frank, consultor, admin, supervisor). Cada usuário vê apenas o que seu papel permite.
- **RLS (Row Level Security):** As políticas no banco garantem que cada usuário acesse só seus dados ou os dados permitidos pela hierarquia (ex.: consultor vê processos dos franqueados vinculados; admin vê tudo).
- **Paginação:** Listas grandes (ex.: Rede de Franqueados, Painel) usam paginação ou limite de “últimos itens” para não sobrecarregar a interface.
- **Sem limite de usuários no código:** Não há teto fixo de logins; o sistema escala com o plano do Supabase e do provedor de deploy.

---

## Recomendações para ~150 usuários

### Supabase

- **Plano:** O plano **gratuito** cobre até 50.000 MAU (Monthly Active Users). Com ~150 usuários ativos, você fica bem dentro do limite. Para mais margem e recursos (ex.: mais espaço, backups), avalie o **Pro**.
- **Conexões:** 150 usuários simultâneos é suportado; o Supabase gerencia o pool de conexões. Não é necessário alterar código para isso.

### Deploy (Vercel ou outro)

- **Vercel:** O plano **Hobby** pode ser suficiente para 150 usuários. Para uso corporativo e mais garantias (builds, bandwidth, suporte), o **Pro** é recomendado.
- **Variáveis de ambiente:** Mantenha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (e as demais já descritas no passo a passo) configuradas no painel do deploy.

### Monitoramento (opcional)

- Acompanhe no **Supabase Dashboard** o uso de API, armazenamento e auth.
- Em caso de picos (ex.: muitos acessos ao mesmo tempo), verifique se as listas pesadas usam paginação e limites adequados (já é o caso no Painel e em listagens como Rede de Franqueados).

---

## Limites internos (ajustáveis se precisar)

| Onde            | Valor atual | Observação |
|-----------------|------------|------------|
| Alertas por usuário | 100       | Últimos 100 alertas na tela Minhas alertas. |
| Painel (admin)  | 100 processos | Últimos 100 processos; se no futuro houver necessidade de ver mais, pode-se adicionar paginação. |
| Home (cards)    | 10 processos + 10 tickets | Apenas resumo na inicial; não limita o uso da ferramenta. |

Nenhum desses valores impede o uso por ~150 usuários; são limites de exibição por tela.

---

## Velocidade de carregamento

### O que já ajuda

- **Server Components (Next.js):** A maior parte das páginas busca dados no servidor; o HTML já vem preenchido, reduzindo “tela em branco” e uso de JavaScript no cliente.
- **Layout único:** O layout raiz carrega usuário e perfil uma vez; a sidebar e o shell aparecem de forma consistente.
- **Queries com limite:** Listas usam `.limit()` e paginação, evitando trazer dados desnecessários.

### O que foi adicionado

- **`loading.tsx` global** (`src/app/loading.tsx`): Durante a troca de rota, o Next.js exibe um indicador “Carregando…” em vez de deixar a tela parada até a página terminar. Melhora a **percepção** de velocidade.
- **`loading.tsx` nas etapas** (`src/app/step-one/[id]/etapa/loading.tsx`): As páginas de etapa (Steps) fazem várias consultas ao banco; enquanto carregam, aparece um skeleton no lugar do conteúdo. A navegação entre etapas fica mais fluida.

### Recomendações para manter a ferramenta rápida

1. **Rede:** Em produção, use HTTPS e, se possível, deploy em região próxima aos usuários (ex.: Vercel na América do Sul).
2. **Supabase:** O projeto na nuvem já fica em uma região (ex.: São Paulo); manter o projeto e o deploy na mesma região reduz latência.
3. **Índices no banco:** Para tabelas grandes (`processo_step_one`, `etapa_progresso`, `listings_casas`, etc.), garanta índices nas colunas usadas em filtros e ordenação (ex.: `user_id`, `processo_id`, `created_at`). As migrações já criam alguns; ao adicionar novas consultas pesadas, vale revisar.
4. **Imagens:** Se no futuro houver muitas imagens (ex.: fotos de casas), use o componente `Image` do Next.js com tamanhos adequados e, se aplicável, CDN/Storage com cache.
5. **Monitorar:** No Supabase Dashboard, verifique o tempo de resposta das queries; se alguma tela ficar lenta, analise a aba “Logs” ou “Database” para identificar consultas lentas.

Com ~150 usuários, a combinação de Server Components, loading states e boas práticas de query mantém a ferramenta responsiva. Se alguma tela específica ficar lenta, o próximo passo é medir (ferramentas do navegador, Lighthouse) e otimizar a página ou as consultas em questão.

---

## Resumo

Para **~150 logins e hierarquias diferentes**, não é obrigatório mudar a arquitetura da aplicação. As recomendações são: (1) manter RLS e roles bem configurados; (2) usar um plano Supabase (e, se aplicável, Vercel) adequado ao uso corporativo; (3) acompanhar o uso no dashboard do Supabase. O documento [PASSO_A_PASSO.md](PASSO_A_PASSO.md) continua sendo a referência para configuração e deploy.
