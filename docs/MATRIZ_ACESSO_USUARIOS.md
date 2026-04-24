# Matriz de acesso e lógica de usuários

Referência alinhada ao código (`src/lib/authz.ts`, `src/lib/access-matrix.ts`, `src/lib/supabase/middleware.ts`, `src/app/login/page.tsx`, `src/app/api/invite/route.ts`).

---

## 1. Papéis em `profiles.role` e normalização

| Valor típico no banco | Após `normalizeAccessRole` | Notas |
|----------------------|----------------------------|--------|
| `admin` | `admin` | Acesso amplo; rotas “só admin” abaixo. |
| `team` | `team` | Só prefixos em `TEAM_ALLOWED_PATH_PREFIXES`. |
| `frank`, `franqueado` | `frank` | Hub principal: só `FRANK_ALLOWED_*`; fora → `/portal-frank`. |
| `pending` | `pending` | Preso em `/login?status=pending`. |
| `blocked` | `blocked` | Preso em `/login?status=blocked`. |
| `consultor`, `supervisor` | `admin` | Legado tratado como admin na matriz. |
| vazio / desconhecido | `pending` | Comportamento conservador. |

---

## 2. O que cada papel acessa (resumo)

| Papel | Rotas do app (resumo) | Bloqueio típico |
|-------|----------------------|-----------------|
| **admin** | Todas as rotas não públicas, incluindo `ADMIN_ONLY_PATH_PREFIXES` | — |
| **team** | Rede, comunidade, repositório, novos negócios (dashboard, painéis, portfolio, funis step one / moní inc, acoplamento, operações), perfil, sirene, `/` | Fora da lista → redirect `/rede-franqueados` |
| **frank** | `FRANK_ALLOWED_PATH_PREFIXES` + detalhe `/rede-franqueados/:uuid` | Fora → `/portal-frank`; prefixos em `FRANK_FORBIDDEN_*` sempre bloqueados |
| **pending** / **blocked** | Só fluxo de login com status | Qualquer outra rota → volta ao login |

---

## 3. Prefixos por matriz (código)

### `TEAM_ALLOWED_PATH_PREFIXES` (time)

| Prefixo |
|---------|
| `/rede-franqueados` |
| `/comunidade` |
| `/repositorio` |
| `/painel-novos-negocios` |
| `/portfolio` |
| `/funil-acoplamento` |
| `/operacoes` |
| `/funil-stepone` |
| `/funil-moni-inc` |
| `/dashboard-novos-negocios` |
| `/perfil` |
| `/sirene` |
| `/` (home exata em `isTeamAllowedPath`) |

### `FRANK_ALLOWED_PATH_PREFIXES` (franqueado no hub)

| Prefixo |
|---------|
| `/portal-frank` |
| `/painel-novos-negocios` |
| `/portfolio` |
| `/operacoes` |
| `/funil-acoplamento` |
| `/funil-stepone` |
| `/funil-moni-inc` |
| `/dashboard-novos-negocios` |
| `/perfil` |

### `FRANK_FORBIDDEN_PATH_PREFIXES` (sempre negado ao frank)

| Prefixo |
|---------|
| `/meus-processos` |
| `/iniciar-processo` |
| `/pre-obra` |
| `/saude-unidade` |
| `/unidade-franquia` |
| `/catalogo-produtos-moni` |
| `/alertas` |
| `/obra-ways` |

### `ADMIN_ONLY_PATH_PREFIXES` (só `admin`; team e frank caem fora)

| Prefixo |
|---------|
| `/admin` |
| `/painel-contabilidade` |
| `/painel-credito` |
| `/financeiro` |
| `/juridico` |
| `/processo-seletivo-candidatos` |
| `/credito-terreno` |
| `/credito-checklist` |
| `/credito-obra` |
| `/credito-abertura-conta` |
| `/due-diligence-frank` |
| `/due-diligence-empresas` |

---

## 4. Sirene (regra extra no middleware)

| `profiles.role` (raw, minúsculo) | Comportamento em `/sirene/*` |
|----------------------------------|------------------------------|
| `frank`, `franqueado` | Redirect `/portal-frank` |
| `parceiro`, `fornecedor`, `cliente` | Redirect `/rede-franqueados` |
| Demais (admin, team, etc.) | Acesso conforme restante do middleware |

---

## 5. Fluxos de criação / ativação

| Fluxo | Onde | Resultado no perfil |
|-------|------|---------------------|
| Cadastro aba **Cadastro** (`/login`) | E-mail no domínio permitido; lista `TEAM_SEED_BY_EMAIL` | `admin` ou `team` + `aprovado_em` preenchido |
| Cadastro aba **Cadastro** (e-mail fora da seed) | Idem | `role = pending`, `aprovado_em` null → `/login?status=pending` |
| Convite admin | `POST /api/invite` (só admin) | Atualiza `role`, `cargo`, `departamento`, `funis_acesso` (se time+estagiário), token de convite |
| Aceitar convite | `/aceitar-convite` + API | Senha + nome; limpa token; `invite_accepted_at` |
| Portal franqueado | `/portal-frank/*` (rotas públicas de login/cadastro no middleware) | Fluxo paralelo ao hub matriz |

---

## 6. Redirecionamento pós-login (cliente)

| Papel (normalizado) | Destino típico |
|--------------------|----------------|
| `pending` | `/login?status=pending` |
| `blocked` | `/login?status=blocked` |
| `admin` | `next` da query ou `/dashboard-novos-negocios` |
| `frank` | `/portal-frank` |
| `team` (e equivalentes admin por login) | `/rede-franqueados` (middleware restringe URLs depois) |

---

## 7. Dados auxiliares em `profiles`

| Coluna | Uso |
|--------|-----|
| `cargo` | Time: `adm` \| `analista` \| `estagiario` (convite / cadastro seed). |
| `departamento` | Texto livre / área. |
| `funis_acesso` | Array de `kanbans.nome`; preenchido no convite para **team + estagiário**; `NULL` = sem restrição por essa lista (ver comentário na migration `134_profiles_funis_acesso.sql`). |
| `aprovado_em` | Cadastro seed já aprovado; pending sem data até ação admin. |
| `invite_token` / `invite_*` | Fluxo de convite por link. |

---

*Última revisão: alinhada ao repositório; ao mudar `access-matrix` ou o middleware, atualize este ficheiro.*
