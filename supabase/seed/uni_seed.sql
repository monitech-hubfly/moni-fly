-- Seed Universidade — 12 casas + módulos (Casa 0–1 completos; casas 2–11 placeholder). Idempotente por slug / ordem.

insert into public.uni_casas (slug, numero, titulo, descricao, cor_tema, ativa)
values
  ('boas-vindas', 0, 'Boas-vindas', 'Setup, acessos e introdução ao ecossistema Moní', 'teal', true),
  ('ecossistema', 1, 'Ecossistema Moní', 'O que é incorporação, estrutura, glossário e modelos de negócio', 'teal', true),
  ('step-one', 2, 'Step One', 'Cidade, condomínios, lotes, corretores e mapa de competidores', 'purple', true),
  ('hipotese', 3, 'Hipótese de liquidez', 'BCA, configurador, batalha de casas e como pensar liquidez', 'purple', true),
  ('comite', 4, 'Comitê', 'Template, storytelling, critérios de aprovação e como defender', 'amber', true),
  ('negociacao', 5, 'Negociação', 'Permuta, carta proposta, pitch e objeções do terrenista', 'amber', true),
  ('check-legal', 6, 'Check legal', 'Matrícula, documentação, diligência, riscos e opção de compra', 'coral', true),
  ('credito', 7, 'Crédito', 'Análise, Moní Capital, carta fiança e crowdfunding', 'coral', true),
  ('contrato-final', 8, 'Contrato final', 'Permuta, SPE, abertura de conta e assinatura', 'green', true),
  ('pre-obra', 9, 'Pré-obra', 'Topografia, sondagem, aprovações de condomínio e prefeitura', 'green', true),
  ('operacao', 10, 'Operação', 'Gestão financeira, fluxo de caixa, qualidade e cronograma', 'blue', true),
  ('venda-liquidacao', 11, 'Venda e liquidação', 'Comercialização, recompra programada e encerramento', 'blue', true)
on conflict (slug) do update set
  titulo = excluded.titulo,
  descricao = excluded.descricao,
  cor_tema = excluded.cor_tema,
  numero = excluded.numero,
  ativa = excluded.ativa;

-- Casa 0: video, video, leitura, checklist
insert into public.uni_modulos (casa_id, tipo, titulo, conteudo, ordem, obrigatorio)
select c.id, v.tipo, v.titulo, v.conteudo::jsonb, v.ordem, true
from public.uni_casas c
cross join (values
  (1, 'video'::text, 'Boas-vindas ao Hub Fly', '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","duracao_min":8,"thumbnail":null}'::text),
  (2, 'video', 'Acessos e rotina', '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","duracao_min":6}'::text),
  (3, 'leitura', 'Leitura: ecossistema Moní', '{"markdown":"# Ecossistema Moní\\n\\nLeia com calma; use o botão ao final para concluir.","tempo_leitura_min":10}'::text),
  (4, 'checklist', 'Setup inicial', '{"itens":[{"id":"a1","texto":"Acessei o Hub Fly","dica":null},{"id":"a2","texto":"Revisei meus dados de perfil","dica":null},{"id":"a3","texto":"Entendi onde ficam os funis","dica":null}]}'::text)
) as v(ordem, tipo, titulo, conteudo)
where c.slug = 'boas-vindas'
  and not exists (select 1 from public.uni_modulos m where m.casa_id = c.id and m.ordem = v.ordem);

-- Casa 1: video, leitura, checklist, video, quiz
insert into public.uni_modulos (casa_id, tipo, titulo, conteudo, ordem, obrigatorio)
select c.id, v.tipo, v.titulo, v.conteudo::jsonb, v.ordem, true
from public.uni_casas c
cross join (values
  (1, 'video'::text, 'O que é incorporação', '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","duracao_min":12}'::text),
  (2, 'leitura', 'Glossário e modelos', '{"markdown":"# Glossário\\n\\nTermos principais do negócio.","tempo_leitura_min":15}'::text),
  (3, 'checklist', 'Checklist de alinhamento', '{"itens":[{"id":"b1","texto":"Li o glossário","dica":null},{"id":"b2","texto":"Consigo explicar o modelo Moní","dica":null}]}'::text),
  (4, 'video', 'Estrutura da operação', '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","duracao_min":10}'::text),
  (5, 'quiz', 'Quiz rápido', '{"perguntas":[{"id":"q1","texto":"Incorporação envolve principalmente:","opcoes":["Só construção","Viabilização e comercialização de empreendimento","Apenas marketing"],"correta":"Viabilização e comercialização de empreendimento"}]}'::text)
) as v(ordem, tipo, titulo, conteudo)
where c.slug = 'ecossistema'
  and not exists (select 1 from public.uni_modulos m where m.casa_id = c.id and m.ordem = v.ordem);

-- Casas 2–11: leitura + vídeo (placeholder). Substituir URLs e textos pelo conteúdo oficial.

insert into public.uni_modulos (casa_id, tipo, titulo, conteudo, ordem, obrigatorio)
select c.id, v.tipo, v.titulo, v.conteudo::jsonb, v.ordem, true
from public.uni_casas c
cross join (values
  (1, 'leitura'::text, 'Step One — visão da região', '{"markdown":"# Step One\\n\\nCidade, condomínios, lotes, corretores e mapa de competidores. Conteúdo placeholder.","tempo_leitura_min":12}'::text),
  (2, 'video', 'Introdução ao mapeamento', '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","duracao_min":10}'::text)
) as v(ordem, tipo, titulo, conteudo)
where c.slug = 'step-one'
  and not exists (select 1 from public.uni_modulos m where m.casa_id = c.id and m.ordem = v.ordem);

insert into public.uni_modulos (casa_id, tipo, titulo, conteudo, ordem, obrigatorio)
select c.id, v.tipo, v.titulo, v.conteudo::jsonb, v.ordem, true
from public.uni_casas c
cross join (values
  (1, 'leitura'::text, 'Hipótese de liquidez', '{"markdown":"# Hipótese de liquidez\\n\\nBCA, configurador e batalha de casas. Conteúdo placeholder.","tempo_leitura_min":14}'::text),
  (2, 'video', 'Como pensar liquidez', '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","duracao_min":11}'::text)
) as v(ordem, tipo, titulo, conteudo)
where c.slug = 'hipotese'
  and not exists (select 1 from public.uni_modulos m where m.casa_id = c.id and m.ordem = v.ordem);

insert into public.uni_modulos (casa_id, tipo, titulo, conteudo, ordem, obrigatorio)
select c.id, v.tipo, v.titulo, v.conteudo::jsonb, v.ordem, true
from public.uni_casas c
cross join (values
  (1, 'leitura'::text, 'Comitê de aprovação', '{"markdown":"# Comitê\\n\\nTemplate, storytelling e critérios. Conteúdo placeholder.","tempo_leitura_min":10}'::text),
  (2, 'video', 'Como defender o projeto', '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","duracao_min":9}'::text)
) as v(ordem, tipo, titulo, conteudo)
where c.slug = 'comite'
  and not exists (select 1 from public.uni_modulos m where m.casa_id = c.id and m.ordem = v.ordem);

insert into public.uni_modulos (casa_id, tipo, titulo, conteudo, ordem, obrigatorio)
select c.id, v.tipo, v.titulo, v.conteudo::jsonb, v.ordem, true
from public.uni_casas c
cross join (values
  (1, 'leitura'::text, 'Negociação com terrenista', '{"markdown":"# Negociação\\n\\nPermuta, carta proposta e objeções. Conteúdo placeholder.","tempo_leitura_min":13}'::text),
  (2, 'video', 'Pitch e fechamento', '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","duracao_min":10}'::text)
) as v(ordem, tipo, titulo, conteudo)
where c.slug = 'negociacao'
  and not exists (select 1 from public.uni_modulos m where m.casa_id = c.id and m.ordem = v.ordem);

insert into public.uni_modulos (casa_id, tipo, titulo, conteudo, ordem, obrigatorio)
select c.id, v.tipo, v.titulo, v.conteudo::jsonb, v.ordem, true
from public.uni_casas c
cross join (values
  (1, 'leitura'::text, 'Check legal', '{"markdown":"# Check legal\\n\\nMatrícula, diligência e riscos. Conteúdo placeholder.","tempo_leitura_min":15}'::text),
  (2, 'video', 'Documentação essencial', '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","duracao_min":12}'::text)
) as v(ordem, tipo, titulo, conteudo)
where c.slug = 'check-legal'
  and not exists (select 1 from public.uni_modulos m where m.casa_id = c.id and m.ordem = v.ordem);

insert into public.uni_modulos (casa_id, tipo, titulo, conteudo, ordem, obrigatorio)
select c.id, v.tipo, v.titulo, v.conteudo::jsonb, v.ordem, true
from public.uni_casas c
cross join (values
  (1, 'leitura'::text, 'Crédito e estruturação', '{"markdown":"# Crédito\\n\\nMoní Capital, fiança e crowdfunding. Conteúdo placeholder.","tempo_leitura_min":12}'::text),
  (2, 'video', 'Fluxo de análise', '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","duracao_min":10}'::text)
) as v(ordem, tipo, titulo, conteudo)
where c.slug = 'credito'
  and not exists (select 1 from public.uni_modulos m where m.casa_id = c.id and m.ordem = v.ordem);

insert into public.uni_modulos (casa_id, tipo, titulo, conteudo, ordem, obrigatorio)
select c.id, v.tipo, v.titulo, v.conteudo::jsonb, v.ordem, true
from public.uni_casas c
cross join (values
  (1, 'leitura'::text, 'Contrato final', '{"markdown":"# Contrato final\\n\\nPermuta, SPE e assinatura. Conteúdo placeholder.","tempo_leitura_min":11}'::text),
  (2, 'video', 'Checklist de fechamento', '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","duracao_min":9}'::text)
) as v(ordem, tipo, titulo, conteudo)
where c.slug = 'contrato-final'
  and not exists (select 1 from public.uni_modulos m where m.casa_id = c.id and m.ordem = v.ordem);

insert into public.uni_modulos (casa_id, tipo, titulo, conteudo, ordem, obrigatorio)
select c.id, v.tipo, v.titulo, v.conteudo::jsonb, v.ordem, true
from public.uni_casas c
cross join (values
  (1, 'leitura'::text, 'Pré-obra', '{"markdown":"# Pré-obra\\n\\nTopografia, sondagem e aprovações. Conteúdo placeholder.","tempo_leitura_min":12}'::text),
  (2, 'video', 'Cronograma de aprovações', '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","duracao_min":8}'::text)
) as v(ordem, tipo, titulo, conteudo)
where c.slug = 'pre-obra'
  and not exists (select 1 from public.uni_modulos m where m.casa_id = c.id and m.ordem = v.ordem);

insert into public.uni_modulos (casa_id, tipo, titulo, conteudo, ordem, obrigatorio)
select c.id, v.tipo, v.titulo, v.conteudo::jsonb, v.ordem, true
from public.uni_casas c
cross join (values
  (1, 'leitura'::text, 'Operação', '{"markdown":"# Operação\\n\\nFinanceiro, qualidade e cronograma. Conteúdo placeholder.","tempo_leitura_min":13}'::text),
  (2, 'video', 'Gestão de obra e caixa', '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","duracao_min":10}'::text)
) as v(ordem, tipo, titulo, conteudo)
where c.slug = 'operacao'
  and not exists (select 1 from public.uni_modulos m where m.casa_id = c.id and m.ordem = v.ordem);

insert into public.uni_modulos (casa_id, tipo, titulo, conteudo, ordem, obrigatorio)
select c.id, v.tipo, v.titulo, v.conteudo::jsonb, v.ordem, true
from public.uni_casas c
cross join (values
  (1, 'leitura'::text, 'Venda e liquidação', '{"markdown":"# Venda e liquidação\\n\\nComercialização e encerramento. Conteúdo placeholder.","tempo_leitura_min":10}'::text),
  (2, 'video', 'Recompra e encerramento', '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","duracao_min":8}'::text)
) as v(ordem, tipo, titulo, conteudo)
where c.slug = 'venda-liquidacao'
  and not exists (select 1 from public.uni_modulos m where m.casa_id = c.id and m.ordem = v.ordem);
