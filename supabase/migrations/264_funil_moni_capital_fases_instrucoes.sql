-- 264: Funil Moní Capital — alinhar fases, SLAs e instruções ao fluxo operacional (5 etapas + recebimento + terminais).

INSERT INTO public.kanbans (nome, descricao, ativo)
SELECT 'Funil Moní Capital', 'Captação privada via plataforma Moní Capital', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanbans WHERE nome = 'Funil Moní Capital'
);

-- Renomeia slugs legados preservando fase_id (cards existentes).
UPDATE public.kanban_fases kf
SET slug = v.novo_slug
FROM public.kanbans k,
  (VALUES
    ('capital_elegibilidade',  'capital_abertura_spe'),
    ('capital_estruturacao',   'capital_cadastro_plataforma'),
    ('capital_ativo',          'capital_materiais_projeto')
  ) AS v(slug_antigo, novo_slug)
WHERE kf.kanban_id = k.id
  AND k.nome = 'Funil Moní Capital'
  AND kf.slug = v.slug_antigo;

-- Nomes, ordem e SLA (dias úteis).
UPDATE public.kanban_fases kf
SET
  nome = v.nome,
  ordem = v.ordem,
  sla_dias = v.sla_dias
FROM public.kanbans k,
  (VALUES
    ('capital_recebimento',           'Recebimento',                                      1,  1),
    ('capital_abertura_spe',          'Abertura da SPE',                                  2, 10),
    ('capital_cadastro_plataforma',   'Cadastro na plataforma',                           3,  3),
    ('capital_materiais_projeto',     'Materiais do projeto',                             4, 10),
    ('capital_informacoes_obrigatorias', 'Informações obrigatórias para subir a oferta',  5,  5),
    ('capital_formalizacao',          'Formalização',                                     6,  5),
    ('capital_concluido',             'Concluído',                                        7, NULL::integer),
    ('capital_nao_elegivel',          'Não elegível',                                     8, NULL::integer)
  ) AS v(slug, nome, ordem, sla_dias)
WHERE kf.kanban_id = k.id
  AND k.nome = 'Funil Moní Capital'
  AND kf.slug = v.slug;

-- Novas fases (se ainda não existirem).
INSERT INTO public.kanban_fases (kanban_id, nome, slug, ordem, sla_dias, ativo, instrucoes, materiais)
SELECT
  k.id,
  f.nome,
  f.slug,
  f.ordem,
  f.sla_dias,
  true,
  NULL,
  '[]'::jsonb
FROM public.kanbans k
CROSS JOIN (
  VALUES
    ('Informações obrigatórias para subir a oferta', 'capital_informacoes_obrigatorias', 5, 5),
    ('Formalização', 'capital_formalizacao', 6, 5)
) AS f(nome, slug, ordem, sla_dias)
WHERE k.nome = 'Funil Moní Capital'
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases kf
    WHERE kf.kanban_id = k.id
      AND kf.slug = f.slug
  );

-- Instruções por fase (kanban_fases.instrucoes — modal "Editar instruções").
UPDATE public.kanban_fases kf
SET instrucoes = v.instrucoes
FROM public.kanbans k,
  (VALUES
    (
      'capital_recebimento',
      $instr$Card recebido da esteira Portfólio (Captação Moní Capital). Confira elegibilidade e encaminhe para Abertura da SPE quando o franqueado estiver pronto para estruturar a oferta.$instr$
    ),
    (
      'capital_abertura_spe',
      $instr$Primeiro passo para estruturar a oferta. Quando a SPE estiver em andamento ou com os dados básicos definidos, já é possível avançar para a próxima fase.

Documento orientativo — passo a passo de abertura da SPE:
https://docs.google.com/document/d/1gcwz3EiDYyATKDcB112ey8J6Tih0ls4Yuag4NEGCENQ/edit?tab=t.0$instr$
    ),
    (
      'capital_cadastro_plataforma',
      $instr$Crie uma conta como investidor em https://monicapital.divify.com.br

Após o cadastro, a equipe Moní ajusta o perfil para emissor da oferta.$instr$
    ),
    (
      'capital_materiais_projeto',
      $instr$Envie os materiais que o investidor verá na oferta (logo, imagens, textos de apoio).

A Moní estrutura profissionalmente:
• Resumo da oferta
• Descrição
• Equipe (opcional)
• FAQ (opcional)
• Logo e cabeçalho
• Carrossel de imagens
• OnePager$instr$
    ),
    (
      'capital_informacoes_obrigatorias',
      $instr$Além dos materiais do projeto, informe:
• Nome da oferta
• CNPJ da SPE (obtido na etapa Abertura da SPE)
• Valor-alvo de captação (múltiplo de R$ 10)
• Valor mínimo de investimento por CPF (múltiplo de R$ 10)

Limite: até 50 investidores por oferta.$instr$
    ),
    (
      'capital_formalizacao',
      $instr$A Moní prepara o contrato para assinatura.

Taxa de R$ 2.500 para subida da oferta.

Após assinatura e pagamento, a oferta é publicada com agendamento mínimo de 1 hora.$instr$
    ),
    (
      'capital_concluido',
      $instr$Oferta publicada. Acompanhe a captação e indique investidores qualificados (CPFs cadastrados na plataforma).$instr$
    ),
    (
      'capital_nao_elegivel',
      $instr$Projeto não elegível para captação via Moní Capital. Registre o motivo e comunique o franqueado.$instr$
    )
  ) AS v(slug, instrucoes)
WHERE kf.kanban_id = k.id
  AND k.nome = 'Funil Moní Capital'
  AND kf.slug = v.slug;
