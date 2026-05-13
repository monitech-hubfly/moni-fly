import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST — gera convite para o portal do franqueado (admin/consultor).
 * Body: { email?: string, franqueado_id?: string } (franqueado_id = rede_franqueados.id, opcional)
 */
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

    const body = (await req.json().catch(() => ({}))) as {
      email?: string | null;
      franqueado_id?: string | null;
    };

    const email = body.email != null ? String(body.email).trim().toLowerCase() : null;
    const franqueadoId =
      body.franqueado_id != null && String(body.franqueado_id).trim() !== ''
        ? String(body.franqueado_id).trim()
        : null;

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
