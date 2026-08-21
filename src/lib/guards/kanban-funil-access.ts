import { guardLoginRequired } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';

/** Garante sessão autenticada em páginas de funil interno (acesso liberado por papel via middleware/RLS). */
export async function requireFunisInternosNegocioAccess(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  guardLoginRequired(user);
}

/** Garante sessão autenticada em `/funil-contratacoes` (acesso liberado por papel via middleware/RLS). */
export async function requireFunilContratacoesAccess(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  guardLoginRequired(user);
}
