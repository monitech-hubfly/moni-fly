import { createAdminClient } from '@/lib/supabase/admin';

export type TokenPublico = {
  id: string;
  formulario_id: string;
  card_id: string | null;
  rede_franqueado_id: string | null;
  expira_em: string | null;
  ativo: boolean;
};

export async function lerTokenPublico(
  token: string,
): Promise<{ ok: true; token: TokenPublico } | { ok: false; error: string; status: number }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('formulario_tokens')
    .select('id, formulario_id, card_id, rede_franqueado_id, expira_em, formularios(ativo)')
    .eq('token', token.trim())
    .maybeSingle();
  if (error) return { ok: false, error: error.message, status: 500 };
  if (!data) return { ok: false, error: 'Link inválido.', status: 404 };
  const row = data as {
    id: string;
    formulario_id: string;
    card_id: string | null;
    rede_franqueado_id: string | null;
    expira_em: string | null;
    formularios: { ativo?: boolean } | { ativo?: boolean }[] | null;
  };
  if (row.expira_em && new Date(row.expira_em).getTime() < Date.now()) {
    return { ok: false, error: 'Este link expirou.', status: 410 };
  }
  const form = Array.isArray(row.formularios) ? row.formularios[0] : row.formularios;
  if (!form?.ativo) return { ok: false, error: 'Este formulário não está disponível.', status: 403 };
  return {
    ok: true,
    token: {
      id: row.id,
      formulario_id: row.formulario_id,
      card_id: row.card_id,
      rede_franqueado_id: row.rede_franqueado_id,
      expira_em: row.expira_em,
      ativo: true,
    },
  };
}
