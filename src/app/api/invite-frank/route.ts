import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST — gera convite para o portal do franqueado (admin/consultor).
 * Body: { email?: string, franqueado_id: string } (franqueado_id = rede_franqueados.id, obrigatório)
 */

const ERRO_FRANQUEADO_ID_OBRIGATORIO =
  'franqueado_id é obrigatório — o convite só pode ser gerado para um franqueado já cadastrado na Rede';

type InviteFrankBody = {
  email?: string | null;
  franqueado_id?: unknown;
};

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

    const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    const role = String((me as { role?: string | null } | null)?.role ?? '');
    if (role !== 'admin' && role !== 'team' && role !== 'consultor') {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as InviteFrankBody;

    const email = body.email != null ? String(body.email).trim().toLowerCase() : null;
    const franqueadoId = typeof body.franqueado_id === 'string' ? body.franqueado_id.trim() : '';
    if (!franqueadoId) {
      return NextResponse.json({ error: ERRO_FRANQUEADO_ID_OBRIGATORIO }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('convites_frank')
      .insert({
        email: email || null,
        franqueado_id: franqueadoId,
        criado_por: user.id,
      } as never)
      .select('token')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const token = String((data as { token?: string }).token ?? '').trim();
    if (!token) return NextResponse.json({ error: 'Falha ao gerar token.' }, { status: 500 });

    const origin = new URL(req.url).origin;
    const url = `${origin}/portal-frank/cadastro?token=${encodeURIComponent(token)}`;

    return NextResponse.json({ ok: true, url, token });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
