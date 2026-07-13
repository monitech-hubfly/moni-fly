-- 451_uni_remove_faq_franks_tabuleiro.sql
-- Remove a FAQ da estrutura acadêmica do Tabuleiro (casa "faq-franks" + seus módulos).
-- O conteúdo já foi migrado para faq_categories/faq_articles em 450_faq_seed_conteudo.sql.
-- Seguro: não há progresso de usuário nessa casa (verificado em DEV e PROD = 0 linhas);
-- a FK uni_progresso.modulo_id é ON DELETE CASCADE, então eventual progresso seria removido junto.
-- Idempotente. Reversível: re-executar 450 recria o conteúdo na FAQ; para restaurar a casa,
-- reverter via seed antigo da casa (uni_casas/uni_modulos) — ver histórico do repositório.

-- Rede de proteção: só remove se o conteúdo já existir migrado na nova FAQ.
do $$
declare
  v_casa_id uuid;
  v_faq_count int;
begin
  select id into v_casa_id from public.uni_casas where slug = 'faq-franks';
  if v_casa_id is null then
    raise notice 'Casa faq-franks já removida — nada a fazer.';
    return;
  end if;

  select count(*) into v_faq_count from public.faq_articles;
  if v_faq_count = 0 then
    raise exception 'Abortado: não há artigos em faq_articles. Rode 450_faq_seed_conteudo.sql antes de remover a casa.';
  end if;

  -- módulos saem por CASCADE ao remover a casa; removo explicitamente por clareza.
  delete from public.uni_modulos where casa_id = v_casa_id;
  delete from public.uni_casas where id = v_casa_id;
  raise notice 'Casa faq-franks e módulos removidos do tabuleiro.';
end $$;

notify pgrst, 'reload schema';
