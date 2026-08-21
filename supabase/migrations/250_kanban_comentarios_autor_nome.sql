-- 250: nome do autor desnormalizado em comentários kanban (leitura sem depender de RLS em profiles)

ALTER TABLE public.kanban_card_comentarios
  ADD COLUMN IF NOT EXISTS autor_nome TEXT;

COMMENT ON COLUMN public.kanban_card_comentarios.autor_nome IS
  'Nome exibido do autor no comentário (desnormalizado; evita RLS em profiles na UI).';

-- Backfill via função SECURITY DEFINER (migration 220)
UPDATE public.kanban_card_comentarios k
SET autor_nome = public.fn_resolve_usuario_nome(k.autor_id)
WHERE k.autor_id IS NOT NULL
  AND (k.autor_nome IS NULL OR trim(k.autor_nome) = '' OR trim(k.autor_nome) = 'Usuário');

-- Comentários legados do painel (processo_card_comentarios) — mesmo card_id = processo_id
UPDATE public.kanban_card_comentarios k
SET
  autor_id = COALESCE(k.autor_id, p.autor_id),
  autor_nome = COALESCE(
    NULLIF(trim(k.autor_nome), ''),
    NULLIF(trim(p.autor_nome), ''),
    public.fn_resolve_usuario_nome(COALESCE(k.autor_id, p.autor_id))
  )
FROM public.processo_card_comentarios p
WHERE k.card_id = p.processo_id
  AND (k.autor_nome IS NULL OR trim(k.autor_nome) = '' OR trim(k.autor_nome) = 'Usuário')
  AND (
    k.created_at = p.created_at
    OR abs(extract(epoch FROM (k.created_at - p.created_at))) < 5
  );
