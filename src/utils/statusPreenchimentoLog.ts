import { createClient } from '@/lib/supabase/client';
import { isAdminRole } from '@/lib/authz';

/**
 * Grava eventos na tabela `audit_log` (aba Log do Carômetro).
 * Mapeia o campo `tipo` da especificação para `entidade`.
 */
export async function registrarEventoStatusPreenchimento(
  tipo:
    | 'status_preenchimento'
    | 'status_preenchimento_bloqueado'
    | 'status_preenchimento_desfeito'
    | 'email_status_preenchimento',
  descricao: string,
  areaNome?: string | null,
  operacao: 'INSERT' | 'DELETE' = 'INSERT',
) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let isAdmin = false;
    if (user?.id) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      isAdmin = isAdminRole(profile?.role);
    }
    const usuario = user?.email ?? user?.user_metadata?.name ?? 'Sistema';
    await supabase.from('audit_log').insert({
      usuario,
      is_admin: isAdmin,
      modulo: 'Status de Preenchimento',
      area: areaNome ?? null,
      entidade: tipo,
      entidade_id: null,
      operacao,
      descricao,
    });
  } catch (e) {
    console.error('[StatusPreenchimento] Falha ao registrar log:', e);
  }
}
