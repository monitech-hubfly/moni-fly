-- 465: Funil Divify — nomes curtos das fases + instruções alinhadas à spec Hub Fly.
-- UUID: 724aef36-37de-4454-bf6f-ec481693aeeb (KANBAN_IDS.MONI_CAPITAL)
-- Não altera slugs nem bastões (capital_recebimento / capital_concluido / capital_nao_elegivel).

UPDATE public.kanban_fases kf
SET
  nome = v.nome,
  ordem = v.ordem,
  sla_dias = v.sla_dias,
  sla_tipo = 'uteis',
  ativo = true
FROM public.kanbans k,
  (VALUES
    ('capital_recebimento',              'Recebimento',                                   1, 1),
    ('capital_abertura_spe',             'Abertura da SPE e Imagens',                     2, 3),
    ('capital_abertura_conta',           'Conta Bancária',                                3, 3),
    ('capital_cadastro_plataforma',      'Cadastro na plataforma',                        4, 2),
    ('capital_materiais_projeto',        'Materiais do projeto',                          5, 2),
    ('capital_informacoes_obrigatorias', 'Informações obrigatórias',                      6, 2),
    ('capital_formalizacao',             'Formalização / Contrato',                       7, 2),
    ('capital_concluido',                'Oferta publicada',                              8, NULL::integer),
    ('capital_nao_elegivel',             'Não elegível',                                  9, NULL::integer)
  ) AS v(slug, nome, ordem, sla_dias)
WHERE kf.kanban_id = k.id
  AND (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid
    OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND kf.slug = v.slug;

UPDATE public.kanban_fases kf
SET instrucoes = $instr$Lead entra no funil via bastão capital_recebimento.
Moní avalia elegibilidade do projeto.
SLA de 1 dia útil para triagem e decisão de avanço ou descarte.
Se não elegível: mover para Não elegível (capital_nao_elegivel).$instr$
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND kf.slug = 'capital_recebimento';

UPDATE public.kanban_fases kf
SET instrucoes = $instr$Primeiro passo operacional; sem CNPJ da SPE nada avança.
O emissor recebe um documento orientativo com o passo a passo da abertura.
Junto com a SPE, já coletar as imagens: logo, cabeçalho e carrossel.
Prazo estimado pelo cartório/junta comercial: até 3 dias úteis.
O time Moní acompanha a finalização.

Documento orientativo:
https://docs.google.com/document/d/1gcwz3EiDYyATKDcB112ey8J6Tih0ls4Yuag4NEGCENQ/edit?tab=t.0

Bastão → Conta Bancária: CNPJ da SPE emitido.$instr$
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND kf.slug = 'capital_abertura_spe';

UPDATE public.kanban_fases kf
SET instrucoes = $instr$A conta deve ser aberta no nome da SPE (CNPJ da fase Abertura da SPE).
Preferência por conta digital (fintech) para agilidade.
Confirmar agência, conta e titularidade antes de avançar.
Prazo: até 3 dias úteis.

Bastão → Cadastro na plataforma: conta bancária ativa.$instr$
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND kf.slug = 'capital_abertura_conta';

UPDATE public.kanban_fases kf
SET instrucoes = $instr$Emissor acessa: https://monicapital.divify.com.br/

Cria conta com o tipo investidor (não emissor — ajuste feito manualmente pela Moní).
Após criação, Moní converte internamente o perfil para emissor da oferta.
Confirmar e-mail de cadastro com o emissor antes de qualquer ajuste.

Bastão → Materiais: perfil de emissor ativo na plataforma.$instr$
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND kf.slug = 'capital_cadastro_plataforma';

UPDATE public.kanban_fases kf
SET instrucoes = $instr$A Moní é responsável por estruturar todos os materiais.
Itens obrigatórios: resumo, descrição, logo, cabeçalho, carrossel, OnePager.
Itens opcionais: equipe, FAQ.
O acoplamento do projeto pode ser iniciado em paralelo com fases anteriores.
Materiais precisam de aprovação do emissor antes de avançar.

Bastão → Formalização: materiais aprovados + dados das Informações preenchidos.$instr$
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND kf.slug = 'capital_materiais_projeto';

UPDATE public.kanban_fases kf
SET instrucoes = $instr$Emissor fornece os dados definitivos da oferta.
Valor-alvo e valor mínimo devem ser múltiplos exatos de R$ 10.
Limite máximo: 50 investidores por oferta.
CNPJ da SPE deve coincidir com o emitido na Abertura da SPE.

Bastão → Formalização: todos os campos obrigatórios preenchidos.$instr$
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND kf.slug = 'capital_informacoes_obrigatorias';

UPDATE public.kanban_fases kf
SET instrucoes = $instr$Moní prepara o contrato com base nos dados das fases Materiais e Informações.
Emissor assina o contrato (digital ou físico).
Taxa de publicação: R$ 2.500 (pagamento obrigatório).
Após assinatura + pagamento confirmados, a oferta é agendada para publicação.
Agendamento mínimo: 1 hora após confirmação.

Bastão → Oferta publicada: contrato assinado + pagamento confirmado.$instr$
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND kf.slug = 'capital_formalizacao';

UPDATE public.kanban_fases kf
SET instrucoes = $instr$Fase de conclusão operacional do funil.
Registrar data, URL e confirmação de publicação.
Bastão de saída: flag capital_ok no card pai (slug da fase: capital_concluido).
Não há SLA — é resultado das fases anteriores.$instr$
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND kf.slug = 'capital_concluido';

UPDATE public.kanban_fases kf
SET instrucoes = $instr$Fase de descarte; pode ser acionada a partir de qualquer fase.
Registrar motivo do descarte.
Bastão de saída capital_nao_elegivel preservado (também seta capital_ok no card pai).$instr$
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '724aef36-37de-4454-bf6f-ec481693aeeb'::uuid OR k.nome IN ('Funil Divify', 'Funil Moní Capital'))
  AND kf.slug = 'capital_nao_elegivel';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('465', 'funil_divify_nomes_instrucoes')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
