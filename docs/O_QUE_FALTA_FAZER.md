# O que falta ser feito

Todas as **6 sprints** e as **11 etapas** do Step One estão implementadas. O que resta são **integrações externas** (dependem de API/definição) e **melhorias opcionais**.

---

## 1. Integrações externas (quando você tiver API / fonte)

| O quê | Onde | Depende de |
|-------|------|-------------|
| **Atlas Brasil** (demografia, IDHM) | Etapa 1 | Fonte dos dados (não há API REST pública; CSV ou integração futura). |
| **Google Maps / Places** (parques, shoppings, eixos) | Etapa 1 | API key do Google (Places API). |
| **Referência de imagens** (escolas, hospitais, eixos, regiões por renda, praças, shoppings, parques) | Etapa 1 | Atlas Brasil, Google Maps ou outra base; a **tela já tem** o bloco “em breve” com a lista. |
| **Apify** (varredura ZAP de casas e lotes) | Etapas 4 e 5 | Você conectar a API do Apify e definir o fluxo (quando estiver disponível). Hoje a listagem é manual e a mensagem na tela deixa isso explícito. |

Nada disso bloqueia o uso atual do app; são evoluções quando as fontes/APIs estiverem definidas.

---

## 2. Melhorias opcionais

| O quê | Situação |
|-------|----------|
| **Alertas automáticos** | A tabela `alertas` e a página “Minhas alertas” existem. Hoje nenhum processo insere alertas (ex.: inatividade, PDF não enviado). Falta criar **triggers** ou **rotinas** no Supabase (ou no app) que insiram em `alertas` conforme regras de negócio. |
| **Uso Apify e relatórios no Painel** | Quando a integração Apify existir, dá para mostrar consumo e relatórios na página do Painel (tabela `apify_usage` já existe). |
| **Importação do catálogo** | A tabela `catalogo_casas` está pronta. Quando você tiver a **tabela/planilha** com as casas do catálogo, falta definir o fluxo de importação (CSV, planilha ou formulário em lote). Ver `docs/CATALOGO_CASAS_TABELA.md`. |
| **Logs de auditoria (audit_log)** | O schema tem `audit_log`; a policy atual permite apenas **service role** inserir. Se quiser registrar ações do app (ex.: “Frank concluiu etapa X”), é preciso usar a service role nas chamadas que gravam em `audit_log` ou ajustar RLS. |

---

## 3. Resumo

- **Já feito:** 11 etapas, Rede de contatos, Painel (consultor/admin + PDFs gerados), Minhas alertas, PDF com hash, condomínios + checklist, tabela resumo e conclusão.
- **Falta (depende de você/API):** Atlas Brasil, Google Maps e referência de imagens na Etapa 1; Apify nas Etapas 4 e 5.
- **Falta (opcional):** triggers/rotinas para alertas automáticos; relatórios Apify no Painel; fluxo de importação do catálogo; uso de `audit_log` nas ações do app.

Nenhuma migração nova é obrigatória para o que está em uso hoje.
