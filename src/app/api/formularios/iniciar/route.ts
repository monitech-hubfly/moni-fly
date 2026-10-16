import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { lerTokenPublico } from '@/lib/formularios/token-publico';

export async function POST(req: NextRequest) {
  let body: { token?: string; numeroFranquia?: string; nomeFranqueado?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'Corpo inválido.' }, { status: 400 });
  }
  const token = String(body.token ?? '').trim();
  if (!token) return NextResponse.json({ ok: false, error: 'Token obrigatório.' }, { status: 400 });

  const lido = await lerTokenPublico(token);
  if (!lido.ok) return NextResponse.json({ ok: false, error: lido.error }, { status: lido.status });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('formulario_respostas')
    .insert({
      formulario_id: lido.token.formulario_id,
      token_id: lido.token.id,
      card_id: lido.token.card_id,
      rede_franqueado_id: lido.token.rede_franqueado_id,
      status: 'rascunho',
      numero_franquia: String(body.numeroFranquia ?? '').trim() || null,
      nome_franqueado: String(body.nomeFranqueado ?? '').trim() || null,
    })
    .select('id')
    .single();
  if (error || !data?.id) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Não foi possível abrir a resposta.' }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    respostaId: String(data.id),
    tokenId: lido.token.id,
    avulso: !lido.token.card_id && !lido.token.rede_franqueado_id,
  });
}
