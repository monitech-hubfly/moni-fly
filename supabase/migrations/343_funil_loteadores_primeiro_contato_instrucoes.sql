-- 343: Funil Loteadores — instruções da fase «Primeiro Contato».

DO $$
DECLARE
  v_kanban_id UUID;
  v_instr TEXT := $instr$
Entrar em contato com o loteador, apresentar as premissas do negócio/pitch comercial e convidá-lo para uma reunião.

Também deve ser enviado ao loteador o link externo do cadastro complementar, para que ele visualize os dados já preenchidos e finalize as informações faltantes.
$instr$;
BEGIN
  SELECT id
  INTO v_kanban_id
  FROM public.kanbans
  WHERE id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid
     OR nome = 'Funil Loteadores'
  ORDER BY CASE WHEN id = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c'::uuid THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_kanban_id IS NULL THEN
    RAISE NOTICE '343: kanban Funil Loteadores não encontrado; pulando.';
    RETURN;
  END IF;

  UPDATE public.kanban_fases
  SET instrucoes = v_instr
  WHERE kanban_id = v_kanban_id
    AND slug = 'primeiro_contato_moni_inc'
    AND COALESCE(ativo, true) = true;

  IF NOT FOUND THEN
    RAISE NOTICE '343: fase primeiro_contato_moni_inc não encontrada.';
  END IF;
END;
$$;
