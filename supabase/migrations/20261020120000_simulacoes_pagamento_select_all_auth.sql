-- Libera SELECT de simulacoes_pagamento para qualquer usuário autenticado.
-- Antes: restrito a admin/team (simulacoes_pagamento_select_staff).
-- Motivo: o botão "Acessar Jornada" no Funil Loteadores deve funcionar para
--   qualquer login, não só para staff.

DROP POLICY IF EXISTS "simulacoes_pagamento_select_staff" ON public.simulacoes_pagamento;

CREATE POLICY "simulacoes_pagamento_select_auth"
  ON public.simulacoes_pagamento
  FOR SELECT
  TO authenticated
  USING (true);

NOTIFY pgrst, 'reload schema';
