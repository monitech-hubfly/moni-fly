-- Bucket para anexos do canal jurídico.
-- Políticas: Frank acessa apenas arquivos dos próprios tickets; Moní (consultor/admin) acessa tudo.
-- Path no bucket: {ticket_id}/frank/{filename} ou {ticket_id}/moni/{filename}

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'juridico-anexos',
  'juridico-anexos',
  false,
  52428800,
  ARRAY['application/pdf','image/jpeg','image/png','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- Função: o usuário atual pode acessar (ler) um arquivo pelo path?
CREATE OR REPLACE FUNCTION public.juridico_can_access_path(object_path text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  first_seg text;
  ticket_uuid uuid;
BEGIN
  IF public.get_my_role() IN ('consultor', 'admin') THEN
    RETURN true;
  END IF;
  first_seg := split_part(object_path, '/', 1);
  IF first_seg IS NULL OR first_seg = '' THEN
    RETURN false;
  END IF;
  BEGIN
    ticket_uuid := first_seg::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
  RETURN EXISTS (
    SELECT 1 FROM public.juridico_tickets t
    WHERE t.id = ticket_uuid AND t.user_id = auth.uid()
  );
END;
$$;

-- Frank pode inserir apenas em path ticket_id/frank/... onde o ticket é dele
CREATE OR REPLACE FUNCTION public.juridico_can_insert_path(object_path text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  first_seg text;
  second_seg text;
  ticket_uuid uuid;
BEGIN
  IF public.get_my_role() IN ('consultor', 'admin') THEN
    RETURN true;
  END IF;
  first_seg := split_part(object_path, '/', 1);
  second_seg := split_part(object_path, '/', 2);
  IF first_seg IS NULL OR first_seg = '' OR second_seg <> 'frank' THEN
    RETURN false;
  END IF;
  BEGIN
    ticket_uuid := first_seg::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
  RETURN EXISTS (
    SELECT 1 FROM public.juridico_tickets t
    WHERE t.id = ticket_uuid AND t.user_id = auth.uid()
  );
END;
$$;

-- Políticas em storage.objects: no Supabase hospedado a tabela storage.objects
-- pertence a outro role; criar/alterar policies por aqui gera "must be owner of table objects".
-- Crie as políticas pelo Dashboard: Storage → juridico-anexos → Policies.
-- Ver docs/STORAGE_JURIDICO_POLICIES.md para os nomes e expressões.
