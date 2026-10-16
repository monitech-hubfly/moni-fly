import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      token?: string;
      nome_franqueado?: string;
      numero_franquia?: string;
      nomeFranqueado?: string;
      numeroFranquia?: string;
    };
    const token = String(body.token ?? '').trim();
    if (!token) return NextResponse.json({ error: 'Token obrigatório.' }, { status: 400 });

    const admin = createAdminClient();
    const { data: tokenData, error: tErr } = await admin
      .from('formulario_tokens')
      .select('id, formulario_id, card_id, rede_franqueado_id, usado, expira_em')
      .eq('token', token)
      .single();

    if (tErr || !tokenData) return NextResponse.json({ error: 'Token inválido.' }, { status: 404 });
    if (tokenData.usado) return NextResponse.json({ error: 'Link já utilizado.' }, { status: 410 });
    if (tokenData.expira_em && new Date(tokenData.expira_em) < new Date()) {
      return NextResponse.json({ error: 'Este link expirou.' }, { status: 410 });
    }

    const nome = String(body.nome_franqueado ?? body.nomeFranqueado ?? '').trim() || null;
    const numero = String(body.numero_franquia ?? body.numeroFranquia ?? '').trim() || null;

    const { data: resposta, error: rErr } = await admin
      .from('formulario_respostas')
      .insert({
        formulario_id: tokenData.formulario_id,
        token_id: tokenData.id,
        card_id: tokenData.card_id ?? null,
        rede_franqueado_id: tokenData.rede_franqueado_id ?? null,
        nome_franqueado: nome,
        numero_franquia: numero,
        status: 'em_preenchimento',
      })
      .select('id')
      .single();

    if (rErr || !resposta) {
      console.error('Erro ao criar resposta:', rErr);
      return NextResponse.json({ error: 'Erro ao iniciar formulário.' }, { status: 500 });
    }

    return NextResponse.json({
      resposta_id: resposta.id,
      respostaId: resposta.id,
      tokenId: tokenData.id,
      ok: true,
    });
  } catch {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
