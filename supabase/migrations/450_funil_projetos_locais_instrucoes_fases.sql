-- 450: Funil Projetos Locais — instruções das fases 100–900
--   Baseado na coluna "FLUXO DE TRABALHO" da planilha "DEMANDAS - PROJETO EXECUTIVO LOCAL".
--   Preenche kanban_fases.instrucoes para cada grupo. Idempotente (UPDATE por slug).

-- 100 — Projeto Layout casa + terreno
UPDATE public.kanban_fases kf SET instrucoes = $instr$Ponto de partida do Projeto Executivo Local. A demanda chega quando os Wayzers avisam que o projeto foi aprovado e podemos iniciar os projetos iniciais.

Itens desta fase:
- 110 Layout geral (casa + terreno) — base para todas as etapas seguintes.

Contatos:
- Acoplamento: double check de todas as exigências do condomínio.
- Produto: validação de escadas, rampas e passeios.

Reuniões frequentes do time (ao longo de todo o projeto):
- Interna time exec local — 1h, semanal (Lari, Alef, Letícia) — quando necessário
- Warroom — 1h30, semanal
- Cronograma time exec geral — 1h, semanal (Lari, Alef, Letícia, Bru) — quando necessário
- Alinhamento com fornecedores — 1h, semanal — quando necessário
- HDM — 1h, semanal — quando necessário
- Compatibilização complementares — 1h, semanal — quando necessário
- Compatibilização times — 1h, semanal — quando necessário$instr$
FROM public.kanbans k WHERE kf.kanban_id = k.id AND k.nome = 'Funil Projetos Locais' AND kf.slug = 'pl_100_layout';

-- 200 — Preparação terreno
UPDATE public.kanban_fases kf SET instrucoes = $instr$Projetos iniciais + preparação do terreno. Os projetos iniciais são liberados como anteprojeto para os Wayzers orçarem; após a análise de estrutura, são liberados para obra.

Itens desta fase:
- 250 Pontos de sondagem no solo — responsável: Alef
- 210 Terraplanagem, 220 Muros simples, 230 Canteiros e tapumes — responsável: Lari
- 221 Muros completo (divisa e arrimo), 222 Muros de contenção, 240 Impermeabilização (muros, casa de máquinas e garagem) — seguem junto com o estudo de estrutura
- 260 Análise arquitetura × estrutura

Obs: validar com Acoplamento as exigências do condomínio e com Produto as escadas/rampas/passeios. Após liberar os projetos iniciais, o Alef avança nos estudos de estrutura do terreno.$instr$
FROM public.kanbans k WHERE kf.kanban_id = k.id AND k.nome = 'Funil Projetos Locais' AND kf.slug = 'pl_200_preparacao_terreno';

-- 300 — Estruturas
UPDATE public.kanban_fases kf SET instrucoes = $instr$Etapa de estrutura, desenvolvida pelo Alef após a liberação dos projetos iniciais.

Itens desta fase:
- 310 Fundação completa
- 311 Fundação simples (quando aplicável)
- 320 Casa de máquinas

Obs: acontece em paralelo com a Infraestrutura (400) — enquanto o Alef desenvolve as estruturas, os pontos de infra vão sendo inseridos no terreno.
1ª Compatibilização (eng × arq): após a entrega dos projetos de estrutura, conferir arquitetura, normas, infras e custos antes de avançar. Com isso, os Wayzers já têm material para contratar os projetos complementares com terceiros.$instr$
FROM public.kanbans k WHERE kf.kanban_id = k.id AND k.nome = 'Funil Projetos Locais' AND kf.slug = 'pl_300_estruturas';

-- 400 — Infraestrutura
UPDATE public.kanban_fases kf SET instrucoes = $instr$Inserção dos pontos de infraestrutura no terreno — acontece em paralelo com a Estrutura (300).

Itens desta fase:
- Pontos internos: 410 Hidráulica, 420 Elétrica e lógica, 430 Gás, 440 Iluminação, 450 Circuitos, 460 Climatização, 470 Fotovoltaico, 480 Aspiração central
- Projetos completos (411, 421, 431, 441, 451, 461, 471, 481): contratados como terceirizados via Wayzers; internamente fazemos a compatibilização.

Obs: contato com Modelo Virtual para checar as ligações com a casa. Em paralelo, iniciar uma modelagem mais avançada da garagem quando necessário.$instr$
FROM public.kanbans k WHERE kf.kanban_id = k.id AND k.nome = 'Funil Projetos Locais' AND kf.slug = 'pl_400_infraestrutura';

-- 500 — Garagem + demais ambientes
UPDATE public.kanban_fases kf SET instrucoes = $instr$Anteprojeto — após tudo validado, modelamos os detalhes e documentamos todas as etapas por completo. Gera projetos para os Wayzers orçarem mão de obra e material.

Itens desta fase:
- 510 Paredes internas + reforços, 511 Parede MDF, 520 Contrapiso e piso, 530 Esquadrias, 540 Revestimentos e pinturas, 550 Forro + estrutura de forro, 560 Louças e metais, 570 Marmoraria, 580 Marcenaria

Obs: muito contato com Produto para alinhar e definir todos os itens; Modelo Virtual e Homologações quando necessário.
2ª Compatibilização (infras × eng × arq × custos): após receber os projetos complementares dos terceiros, compatibilizar tudo.
Projeto executivo: liberação para obra 1 por 1, conforme demanda e prazos dos Wayzers, após pente fino com os times — evita liberar algo que depois seja alterado.$instr$
FROM public.kanbans k WHERE kf.kanban_id = k.id AND k.nome = 'Funil Projetos Locais' AND kf.slug = 'pl_500_garagem';

-- 600 — Piscina
UPDATE public.kanban_fases kf SET instrucoes = $instr$Parte do anteprojeto / projeto executivo.

Itens desta fase:
- 610 Projeto piscina

Obs: liberação para obra conforme demanda, após pente fino com os times (Produto, Homologações, Modelo Virtual).$instr$
FROM public.kanbans k WHERE kf.kanban_id = k.id AND k.nome = 'Funil Projetos Locais' AND kf.slug = 'pl_600_piscina';

-- 700 — Deck
UPDATE public.kanban_fases kf SET instrucoes = $instr$Parte do anteprojeto / projeto executivo.

Itens desta fase:
- 710 Projeto Deck

Obs: liberação para obra conforme demanda, após pente fino com os times (Produto, Homologações, Modelo Virtual).$instr$
FROM public.kanbans k WHERE kf.kanban_id = k.id AND k.nome = 'Funil Projetos Locais' AND kf.slug = 'pl_700_deck';

-- 800 — Escada e Pisantes
UPDATE public.kanban_fases kf SET instrucoes = $instr$Parte do anteprojeto / projeto executivo.

Itens desta fase:
- 810 Escada e Pisantes

Obs: liberação para obra conforme demanda, após pente fino com os times (Produto, Homologações, Modelo Virtual).$instr$
FROM public.kanbans k WHERE kf.kanban_id = k.id AND k.nome = 'Funil Projetos Locais' AND kf.slug = 'pl_800_escada_pisantes';

-- 900 — Paisagismo
UPDATE public.kanban_fases kf SET instrucoes = $instr$Parte do anteprojeto / projeto executivo (última entrega da série).

Itens desta fase:
- 910 Paisagismo simples
- 920 Paisagismo completo (quando necessário)

Obs: liberação para obra conforme demanda, após pente fino com os times (Produto, Homologações, Modelo Virtual).$instr$
FROM public.kanbans k WHERE kf.kanban_id = k.id AND k.nome = 'Funil Projetos Locais' AND kf.slug = 'pl_900_paisagismo';

-- Verificação
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT kf.ordem, kf.slug, length(kf.instrucoes) AS chars
    FROM public.kanban_fases kf JOIN public.kanbans k ON k.id = kf.kanban_id
    WHERE k.nome = 'Funil Projetos Locais' AND kf.slug LIKE 'pl_%'
    ORDER BY kf.ordem
  LOOP
    RAISE NOTICE '450: % (%) → instrucoes % chars', r.ordem, r.slug, r.chars;
  END LOOP;
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('450', 'funil_projetos_locais_instrucoes_fases')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
