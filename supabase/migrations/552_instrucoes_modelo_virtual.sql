-- 552: Instruções detalhadas do Funil Modelo Virtual (kanban_fases.instrucoes).
-- UUID: 92d0033b-fd8c-432d-a089-e78c41a7cf48

UPDATE public.kanban_fases
SET instrucoes = '<p>Modelar a estrutura completa da casa no software correspondente: paredes, lajes, cobertura, esquadrias, vedações, mobiliários, marcenaria, metais e louças.</p><ul><li>Exportar arquivos PLN, DWG, IFC e SKP ao concluir.</li><li>Enviar IFC, DWG e SKP para a Boss Panel gerar o orçamento de estrutura.</li><li>Acionar Karol e Fer para iniciar a validação de custos a partir do orçamento.</li><li>Ao concluir esta fase: o modelo está apto para a Liz iniciar acoplamentos, e Lari/Letícia podem iniciar os projetos iniciais do terreno.</li><li>Avançar para Modelagem e Infra após entrega dos arquivos à Boss Panel.</li></ul>'
WHERE kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48'
  AND slug = 'mv_modelagem_casa';

UPDATE public.kanban_fases
SET instrucoes = '<p>Modelar e documentar todos os pontos de infraestrutura da casa: elétrica/lógica, hidráulica, gás, iluminação, climatização, aspiração central e painel fotovoltaico.</p><ul><li>Exportar arquivos IFC, DWG e PDF ao concluir.</li><li>Enviar IFC, DWG e PDF para a Mtechne gerar o orçamento de infraestrutura (modelo novo).</li><li>Avançar para Aguardando Boss Panel enquanto aguarda os projetos da Boss Panel.</li></ul>'
WHERE kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48'
  AND slug = 'mv_modelagem_infra';

UPDATE public.kanban_fases
SET instrucoes = '<p>Fase de espera externa — aguardando projeto de estrutura da Boss Panel.</p><ul><li>Prazo estimado: ~1 semana para orçamento + ~2 semanas para projeto = ~3 semanas no total.</li><li>Acompanhar ativamente o cronograma da Boss Panel.</li><li>Ao receber o projeto: marcar os checklists e avançar para Compatibilização Moní x Boss.</li><li><strong>NÃO avançar</strong> antes de receber o projeto completo da Boss Panel.</li></ul>'
WHERE kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48'
  AND slug = 'mv_aguardar_boss';

UPDATE public.kanban_fases
SET instrucoes = '<p>Conferir com a Boss Panel: estrutura, cobertura, esquadrias, paredes externas e internas.</p><ul><li><strong>IMPORTANTE:</strong> esta fase pode acontecer várias vezes — a Boss Panel entrega em etapas (estrutura → paredes externas → paredes internas).</li><li>A cada nova entrega, mover o card de volta para esta fase, conferir e avançar novamente.</li><li>Se identificar produto novo não incluso na Gbox (estético ou técnico): abrir manualmente um card no Funil Homologações.</li><li>Ao concluir: Alef (exec local) já pode iniciar os primeiros estudos de fundação.</li><li>Avançar para Compatibilização Infra quando a estrutura estiver validada.</li></ul>'
WHERE kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48'
  AND slug = 'mv_compat_estrutura';

UPDATE public.kanban_fases
SET instrucoes = '<p>Conferir a estrutura aprovada com a Boss Panel em conjunto com a infraestrutura da casa.</p><ul><li>Enviar IFC, DWG e PDF para a Mtechne executar os projetos completos de infraestrutura.</li><li><strong>IMPORTANTE:</strong> esta fase pode acontecer várias vezes, conforme o cronograma da Mtechne — validar e, se necessário, devolver para revisão.</li><li>Registrar no card o parecer técnico do time de exec locais.</li><li>Ao concluir: Alef pode validar compatibilidade com a fundação; Lari/Letícia podem compatibilizar a casa com ambientes do terreno.</li><li>Produto novo não incluso na Gbox: abrir no Funil Homologações.</li><li><strong>NOTA:</strong> Fases 3, 4 e 5 podem ocorrer simultaneamente conforme o cronograma.</li></ul>'
WHERE kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48'
  AND slug = 'mv_compat_infra';

UPDATE public.kanban_fases
SET instrucoes = '<p>Documentação da 1ª fase de projetos, conforme cronograma dos Waysers.</p><ul><li>1410 — Esquadrias de alumínio</li><li>1110 — LightWall</li><li>1130 — Cimentícia</li><li>1220 — Revestimento externo</li><li>1320 — Brises</li><li>Exportar DWG, IFC e PDF para cada item documentado.</li><li><strong>NOTA:</strong> pode ocorrer simultaneamente com as Fases 3 e 4 (Compatibilizações).</li></ul>'
WHERE kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48'
  AND slug = 'mv_doc_fase1';

UPDATE public.kanban_fases
SET instrucoes = '<p>Documentação da 2ª fase de projetos, conforme cronograma dos Waysers.</p><ul><li>1100 — Estrutura cobertura, telha e acabamentos</li><li>1330 — Forro</li><li>1510 — Piso, contrapiso e impermeabilização</li><li>110 — Layout e fachadas</li><li>1120 — Deck</li><li>Exportar DWG, IFC e PDF para cada item.</li><li>Esta fase inicia quando necessário conforme cronograma — não precisa aguardar a 1ª fase 100% concluída.</li></ul>'
WHERE kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48'
  AND slug = 'mv_doc_fase2';

UPDATE public.kanban_fases
SET instrucoes = '<p>Documentação da 3ª fase de projetos, conforme cronograma dos Waysers.</p><ul><li>330 — Estrutura casa</li><li>340 — Escada</li><li>1200 — Reforço cobertura para lareira</li><li>1210 — Parede Boss Panel</li><li>1230 — Reforço para marmoraria e marcenaria</li><li>1310 — MDF paredes e portas + Drywall</li><li>1520 — Revestimentos internos</li><li>Exportar DWG, IFC e PDF para cada item.</li></ul>'
WHERE kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48'
  AND slug = 'mv_doc_fase3';

UPDATE public.kanban_fases
SET instrucoes = '<p>Documentação da 4ª fase de projetos — itens de acabamento final.</p><ul><li>1530 — Louças e metais</li><li>1610 — Projeto de marmoraria</li><li>1620 — Projeto de marcenaria</li><li>1630 — Projeto de box e espelhos</li><li>SLA base: 5 dias úteis; SLA ampliado: 8 dias quando inclui marcenaria, box e espelhos (1620/1630).</li><li>Exportar DWG, IFC e PDF para cada item.</li><li>Ao concluir todos os itens: avançar para Concluído.</li></ul>'
WHERE kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48'
  AND slug = 'mv_doc_fase4';

UPDATE public.kanban_fases
SET instrucoes = '<p>Todos os projetos foram entregues aos Waysers conforme cronograma.</p><ul><li>Organizar e arquivar a pasta completa de arquivos do modelo.</li><li>Verificar que todos os anexos estão salvos no card antes de arquivar.</li><li>Card pode ser arquivado após confirmação da entrega final.</li></ul>'
WHERE kanban_id = '92d0033b-fd8c-432d-a089-e78c41a7cf48'
  AND slug = 'mv_concluido';

NOTIFY pgrst, 'reload schema';
