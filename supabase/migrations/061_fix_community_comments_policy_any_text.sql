-- Permitir comentários com qualquer texto (antes era restrito a "Bem-vindo").

DROP POLICY IF EXISTS "Comentario apenas Bem-vindo" ON public.community_comments;

CREATE POLICY "Comentario autenticado" 
  ON public.community_comments
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND texto IS NOT NULL
    AND length(trim(texto)) > 0
  );

