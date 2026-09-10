-- 565: Funil Jurídico — 8 fases + colunas específicas em kanban_cards.
-- Idempotente. Alinhado a KANBAN_IDS.JURIDICO (35fb5c8d-0000-0000-0000-000000000001).
-- Modelo estrutural: 419_kanban_funding.sql.
-- RLS: herda políticas existentes de kanban_cards / kanban_fases / kanban_fase_checklist_itens
-- (SELECT autenticados; INSERT/UPDATE admin/team). Sem tabelas novas.

-- ─── Colunas Jurídico em kanban_cards ────────────────────────────────────────
ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS juridico_tipo_contrato text,
  ADD COLUMN IF NOT EXISTS juridico_origem text,
  ADD COLUMN IF NOT EXISTS juridico_retroalimentar boolean,
  ADD COLUMN IF NOT EXISTS juridico_bolinha_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS juridico_link_autentique text;

-- Garante default/NOT NULL no contador mesmo se a coluna já existia nullable.
ALTER TABLE public.kanban_cards
  ALTER COLUMN juridico_bolinha_count SET DEFAULT 0;

UPDATE public.kanban_cards
SET juridico_bolinha_count = 0
WHERE juridico_bolinha_count IS NULL;

DO $$
BEGIN
  BEGIN
    ALTER TABLE public.kanban_cards
      ALTER COLUMN juridico_bolinha_count SET NOT NULL;
  EXCEPTION
    WHEN others THEN NULL;
  END;
END $$;

DO $$
BEGIN
  -- Compat: 564 usava 'operacoes'; mapear para 'comercial' antes do novo CHECK.
  UPDATE public.kanban_cards
  SET juridico_origem = 'comercial'
  WHERE juridico_origem = 'operacoes';

  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kanban_cards_juridico_origem_check'
  ) THEN
    ALTER TABLE public.kanban_cards DROP CONSTRAINT kanban_cards_juridico_origem_check;
  END IF;
  ALTER TABLE public.kanban_cards
    ADD CONSTRAINT kanban_cards_juridico_origem_check
    CHECK (
      juridico_origem IS NULL
      OR juridico_origem IN ('portfolio', 'loteadores', 'comercial')
    );
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kanban_cards_juridico_tipo_contrato_check'
  ) THEN
    ALTER TABLE public.kanban_cards
      ADD CONSTRAINT kanban_cards_juridico_tipo_contrato_check
      CHECK (
        juridico_tipo_contrato IS NULL
        OR juridico_tipo_contrato IN (
          'opcao',
          'cto_com_permuta',
          'cto_sem_permuta',
          'showroom',
          'parceria',
          'franquia',
          'cof'
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.kanban_cards.juridico_tipo_contrato IS
  'Funil Jurídico — tipo: opcao | cto_com_permuta | cto_sem_permuta | showroom | parceria | franquia | cof.';
COMMENT ON COLUMN public.kanban_cards.juridico_origem IS
  'Funil Jurídico — origem: portfolio | loteadores | comercial.';
COMMENT ON COLUMN public.kanban_cards.juridico_retroalimentar IS
  'Funil Jurídico — decisão de retroalimentação (null = ainda não decidido; gate na Pós-Assinatura).';
COMMENT ON COLUMN public.kanban_cards.juridico_bolinha_count IS
  'Funil Jurídico — contador de revisões (retrocessos Fase 5/6 → Fase 3).';
COMMENT ON COLUMN public.kanban_cards.juridico_link_autentique IS
  'Funil Jurídico — link do envelope Autentique.';

-- cor_hex opcional em kanbans (alguns ambientes não têm a coluna).
ALTER TABLE public.kanbans
  ADD COLUMN IF NOT EXISTS cor_hex text;

-- ─── Kanban Funil Jurídico (UUID fixo — alinhado a kanban-ids.ts) ────────────
INSERT INTO public.kanbans (id, nome, descricao, ativo, cor_hex)
SELECT
  '35fb5c8d-0000-0000-0000-000000000001'::uuid,
  'Funil Jurídico',
  'Gestão de contratos: Opção, Cto c/Permuta, Cto s/Permuta, Showroom, Parceria, Franquia, COF.',
  true,
  '#1E3A5F'
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanbans
  WHERE id = '35fb5c8d-0000-0000-0000-000000000001'::uuid
     OR nome = 'Funil Jurídico'
);

-- Reativa / atualiza se já existia (ex.: desativado na 501 com UUID legado).
UPDATE public.kanbans
SET
  descricao = 'Gestão de contratos: Opção, Cto c/Permuta, Cto s/Permuta, Showroom, Parceria, Franquia, COF.',
  ativo = true,
  cor_hex = COALESCE(cor_hex, '#1E3A5F')
WHERE id = '35fb5c8d-0000-0000-0000-000000000001'::uuid
   OR nome = 'Funil Jurídico';

-- ─── Fases (8 etapas, sla_tipo = uteis) ──────────────────────────────────────
INSERT INTO public.kanban_fases (
  kanban_id, nome, slug, ordem, sla_dias, sla_tipo, fase_conversao, ativo, instrucoes, materiais
)
SELECT
  k.id,
  f.nome,
  f.slug,
  f.ordem,
  f.sla_dias,
  'uteis',
  f.fase_conversao,
  true,
  f.instrucoes,
  '[]'::jsonb
FROM public.kanbans k
CROSS JOIN (
  VALUES
    (
      'Recebimento',
      'juridico_recebimento',
      1,
      NULL::integer,
      false,
      'Card recebido via bastão (Portfólio/Loteadores) ou manualmente (Comercial). Confirmar tipo de contrato e origem antes de avançar.'
    ),
    (
      'Análise Inicial',
      'juridico_analise_inicial',
      2,
      2,
      false,
      'Analisar viabilidade jurídica. Confirmar documentos necessários. Verificar pendências no checklist do card pai.'
    ),
    (
      'Em alterações e respostas',
      'juridico_alteracoes_respostas',
      3,
      7,
      false,
      'Conduzir tratativas. Documentar rodadas. Registrar versões nos comentários. Se o parceiro retornar com alterações após o envio, retroceder para cá — contador de revisões será incrementado.'
    ),
    (
      'Enviado ao Parceiro',
      'juridico_enviado_parceiro',
      4,
      3,
      false,
      'Enviar minuta ao parceiro. Registrar data e confirmação de recebimento. Se houver novas alterações, retroceder para Fase 3.'
    ),
    (
      'Subir p/ Assinatura',
      'juridico_subir_assinatura',
      5,
      2,
      false,
      'Gerar versão final no Autentique. Colar link do envelope no card. Confirmar que todas as partes receberam o convite.'
    ),
    (
      'Aguardando Assinaturas',
      'juridico_aguardando_assinaturas',
      6,
      10,
      false,
      'Aguardar assinaturas. Monitorar no Autentique. Cobrar partes pendentes. Avançar somente quando 100% assinado.'
    ),
    (
      'Pós-Assinatura / Retroalimentação',
      'juridico_pos_assinatura',
      7,
      5,
      false,
      'Baixar contrato assinado e anexar ao card. Avaliar aprendizados. Marcar decisão sobre retroalimentação (obrigatória antes de avançar — gate ativo). Se sim: atualizar template e FAQ.'
    ),
    (
      'Atendimentos Concluídos',
      'juridico_atendimentos_concluidos',
      8,
      NULL::integer,
      true,
      'Terminal. Nenhuma ação adicional. Card é registro histórico.'
    )
) AS f(nome, slug, ordem, sla_dias, fase_conversao, instrucoes)
WHERE (k.id = '35fb5c8d-0000-0000-0000-000000000001'::uuid OR k.nome = 'Funil Jurídico')
  AND NOT EXISTS (
    SELECT 1
    FROM public.kanban_fases kf
    WHERE kf.kanban_id = k.id
      AND kf.slug = f.slug
  );

UPDATE public.kanban_fases kf
SET
  nome = v.nome,
  ordem = v.ordem,
  sla_dias = v.sla_dias,
  sla_tipo = 'uteis',
  fase_conversao = v.fase_conversao,
  ativo = true,
  instrucoes = v.instrucoes
FROM public.kanbans k,
  (VALUES
    (
      'juridico_recebimento',
      'Recebimento',
      1,
      NULL::integer,
      false,
      'Card recebido via bastão (Portfólio/Loteadores) ou manualmente (Comercial). Confirmar tipo de contrato e origem antes de avançar.'
    ),
    (
      'juridico_analise_inicial',
      'Análise Inicial',
      2,
      2,
      false,
      'Analisar viabilidade jurídica. Confirmar documentos necessários. Verificar pendências no checklist do card pai.'
    ),
    (
      'juridico_alteracoes_respostas',
      'Em alterações e respostas',
      3,
      7,
      false,
      'Conduzir tratativas. Documentar rodadas. Registrar versões nos comentários. Se o parceiro retornar com alterações após o envio, retroceder para cá — contador de revisões será incrementado.'
    ),
    (
      'juridico_enviado_parceiro',
      'Enviado ao Parceiro',
      4,
      3,
      false,
      'Enviar minuta ao parceiro. Registrar data e confirmação de recebimento. Se houver novas alterações, retroceder para Fase 3.'
    ),
    (
      'juridico_subir_assinatura',
      'Subir p/ Assinatura',
      5,
      2,
      false,
      'Gerar versão final no Autentique. Colar link do envelope no card. Confirmar que todas as partes receberam o convite.'
    ),
    (
      'juridico_aguardando_assinaturas',
      'Aguardando Assinaturas',
      6,
      10,
      false,
      'Aguardar assinaturas. Monitorar no Autentique. Cobrar partes pendentes. Avançar somente quando 100% assinado.'
    ),
    (
      'juridico_pos_assinatura',
      'Pós-Assinatura / Retroalimentação',
      7,
      5,
      false,
      'Baixar contrato assinado e anexar ao card. Avaliar aprendizados. Marcar decisão sobre retroalimentação (obrigatória antes de avançar — gate ativo). Se sim: atualizar template e FAQ.'
    ),
    (
      'juridico_atendimentos_concluidos',
      'Atendimentos Concluídos',
      8,
      NULL::integer,
      true,
      'Terminal. Nenhuma ação adicional. Card é registro histórico.'
    )
  ) AS v(slug, nome, ordem, sla_dias, fase_conversao, instrucoes)
WHERE kf.kanban_id = k.id
  AND (k.id = '35fb5c8d-0000-0000-0000-000000000001'::uuid OR k.nome = 'Funil Jurídico')
  AND kf.slug = v.slug;

-- Desativa fases legadas fora das 8 canônicas.
UPDATE public.kanban_fases kf
SET ativo = false
FROM public.kanbans k
WHERE kf.kanban_id = k.id
  AND (k.id = '35fb5c8d-0000-0000-0000-000000000001'::uuid OR k.nome = 'Funil Jurídico')
  AND kf.slug NOT IN (
    'juridico_recebimento',
    'juridico_analise_inicial',
    'juridico_alteracoes_respostas',
    'juridico_enviado_parceiro',
    'juridico_subir_assinatura',
    'juridico_aguardando_assinaturas',
    'juridico_pos_assinatura',
    'juridico_atendimentos_concluidos'
  );

-- ─── Checklists por fase ─────────────────────────────────────────────────────
INSERT INTO public.kanban_fase_checklist_itens (
  fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json, placeholder
)
SELECT f.id, i.ordem, i.label, i.tipo, i.obrigatorio, false, i.campo_slug, '{}'::jsonb, NULL
FROM public.kanban_fases f
INNER JOIN public.kanbans k ON k.id = f.kanban_id
CROSS JOIN (
  VALUES
    (1, 'Origem do card identificada (Portfólio / Loteadores / Comercial)', 'checkbox', true, 'juridico_origem_identificada'),
    (2, 'Tipo de contrato confirmado', 'checkbox', true, 'juridico_tipo_contrato_confirmado'),
    (3, 'Documentos necessários para as tratativas', 'texto_longo', false, 'juridico_docs_necessarios')
) AS i(ordem, label, tipo, obrigatorio, campo_slug)
WHERE (k.id = '35fb5c8d-0000-0000-0000-000000000001'::uuid OR k.nome = 'Funil Jurídico')
  AND f.slug = 'juridico_analise_inicial'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens x
    WHERE x.fase_id = f.id AND (x.campo_slug = i.campo_slug OR x.label = i.label)
  );

INSERT INTO public.kanban_fase_checklist_itens (
  fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json, placeholder
)
SELECT f.id, i.ordem, i.label, i.tipo, i.obrigatorio, false, i.campo_slug, '{}'::jsonb, NULL
FROM public.kanban_fases f
INNER JOIN public.kanbans k ON k.id = f.kanban_id
CROSS JOIN (
  VALUES
    (1, 'Link Autentique', 'texto_curto', true, 'juridico_link_autentique_checklist'),
    (2, 'Convite de assinatura enviado a todas as partes', 'checkbox', true, 'juridico_convite_assinatura_enviado')
) AS i(ordem, label, tipo, obrigatorio, campo_slug)
WHERE (k.id = '35fb5c8d-0000-0000-0000-000000000001'::uuid OR k.nome = 'Funil Jurídico')
  AND f.slug = 'juridico_subir_assinatura'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens x
    WHERE x.fase_id = f.id AND (x.campo_slug = i.campo_slug OR x.label = i.label)
  );

INSERT INTO public.kanban_fase_checklist_itens (
  fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json, placeholder
)
SELECT f.id, i.ordem, i.label, i.tipo, i.obrigatorio, false, i.campo_slug, '{}'::jsonb, NULL
FROM public.kanban_fases f
INNER JOIN public.kanbans k ON k.id = f.kanban_id
CROSS JOIN (
  VALUES
    (1, 'Todas as partes assinaram', 'checkbox', true, 'juridico_todas_partes_assinaram')
) AS i(ordem, label, tipo, obrigatorio, campo_slug)
WHERE (k.id = '35fb5c8d-0000-0000-0000-000000000001'::uuid OR k.nome = 'Funil Jurídico')
  AND f.slug = 'juridico_aguardando_assinaturas'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens x
    WHERE x.fase_id = f.id AND (x.campo_slug = i.campo_slug OR x.label = i.label)
  );

INSERT INTO public.kanban_fase_checklist_itens (
  fase_id, ordem, label, tipo, obrigatorio, visivel_candidato, campo_slug, config_json, placeholder
)
SELECT f.id, i.ordem, i.label, i.tipo, i.obrigatorio, false, i.campo_slug, '{}'::jsonb, NULL
FROM public.kanban_fases f
INNER JOIN public.kanbans k ON k.id = f.kanban_id
CROSS JOIN (
  VALUES
    (1, 'Contrato assinado anexado ao card', 'checkbox', true, 'juridico_contrato_anexado'),
    (2, 'Retroalimentação necessária? (define juridico_retroalimentar)', 'checkbox', true, 'juridico_retroalimentar_checklist'),
    (3, 'Pontos para retroalimentar', 'texto_longo', false, 'juridico_pontos_retroalimentar'),
    (4, 'Template de contrato atualizado', 'checkbox', false, 'juridico_template_atualizado'),
    (5, 'FAQ jurídica atualizada', 'checkbox', false, 'juridico_faq_atualizada')
) AS i(ordem, label, tipo, obrigatorio, campo_slug)
WHERE (k.id = '35fb5c8d-0000-0000-0000-000000000001'::uuid OR k.nome = 'Funil Jurídico')
  AND f.slug = 'juridico_pos_assinatura'
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_fase_checklist_itens x
    WHERE x.fase_id = f.id AND (x.campo_slug = i.campo_slug OR x.label = i.label)
  );

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('565', 'funil_juridico_8_fases')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
