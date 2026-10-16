import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { resolverRedeFranqueadoPorNumero } from '@/lib/formularios/resolver-franqueado';
import { lerTokenPublico } from '@/lib/formularios/token-publico';
import type { FormularioValorSubmit } from '@/types/formularios';

export async function POST(req: NextRequest) {
  let body: {
    token?: string;
    tokenId?: string;
    respostaId?: string;
    numeroFranquia?: string;
    nomeFranqueado?: string;
    valores?: FormularioValorSubmit[];
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'Corpo inválido.' }, { status: 400 });
  }

  const token = String(body.token ?? '').trim();
  const respostaId = String(body.respostaId ?? '').trim();
  const tokenId = String(body.tokenId ?? '').trim();
  if (!token || !respostaId || !tokenId) {
    return NextResponse.json({ ok: false, error: 'Token e resposta são obrigatórios.' }, { status: 400 });
  }

  const lido = await lerTokenPublico(token);
  if (!lido.ok) return NextResponse.json({ ok: false, error: lido.error }, { status: lido.status });
  if (lido.token.id !== tokenId) {
    return NextResponse.json({ ok: false, error: 'Token não confere.' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: resposta, error: respErr } = await admin
    .from('formulario_respostas')
    .select('id, token_id, formulario_id, card_id, rede_franqueado_id, status')
    .eq('id', respostaId)
    .maybeSingle();
  if (respErr) return NextResponse.json({ ok: false, error: respErr.message }, { status: 500 });
  if (!resposta || String((resposta as { token_id?: string }).token_id) !== lido.token.id) {
    return NextResponse.json({ ok: false, error: 'Resposta não encontrada.' }, { status: 404 });
  }
  if ((resposta as { status?: string }).status === 'enviado') {
    return NextResponse.json({ ok: true });
  }

  const valores = Array.isArray(body.valores) ? body.valores : [];
  const linhas = valores
    .map((valor) => ({
      resposta_id: respostaId,
      campo_id: String(valor.campoId ?? '').trim(),
      valor_texto: valor.valorTexto ?? null,
      valor_numero: valor.valorNumero ?? null,
      valor_data: valor.valorData || null,
      valor_json: valor.valorJson ?? null,
    }))
    .filter((linha) => linha.campo_id);
  if (linhas.length > 0) {
    const { error: delErr } = await admin.from('formulario_resposta_valores').delete().eq('resposta_id', respostaId);
    if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });
    const { error: insErr } = await admin.from('formulario_resposta_valores').insert(linhas);
    if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
  }

  const avulso = !lido.token.card_id && !lido.token.rede_franqueado_id;
  const numero = String(body.numeroFranquia ?? '').trim();
  const nome = String(body.nomeFranqueado ?? '').trim();
  let redeId = (resposta as { rede_franqueado_id?: string | null }).rede_franqueado_id ?? lido.token.rede_franqueado_id;
  const cardId = (resposta as { card_id?: string | null }).card_id ?? lido.token.card_id;

  if (avulso) {
    if (!numero || !nome) {
      return NextResponse.json(
        { ok: false, error: 'Informe o número e o nome do franqueado.' },
        { status: 400 },
      );
    }
    redeId = await resolverRedeFranqueadoPorNumero(admin, numero);
  }

  if (!cardId && !redeId) {
    return NextResponse.json(
      { ok: false, error: 'Não encontramos a franquia informada. Confira o número e envie de novo.' },
      { status: 422 },
    );
  }

  let preenchidoPor: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    preenchidoPor = user?.id ?? null;
  } catch {
    preenchidoPor = null;
  }

  const { error: updErr } = await admin
    .from('formulario_respostas')
    .update({
      status: 'enviado',
      enviado_em: new Date().toISOString(),
      card_id: cardId,
      rede_franqueado_id: redeId,
      numero_franquia: numero || null,
      nome_franqueado: nome || null,
      preenchido_por_user_id: preenchidoPor,
    })
    .eq('id', respostaId);
  if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });

  if (cardId) {
    let usuarioNome: string | null = null;
    if (preenchidoPor) {
      const { data: prof } = await admin.from('profiles').select('full_name').eq('id', preenchidoPor).maybeSingle();
      usuarioNome = String((prof as { full_name?: string | null } | null)?.full_name ?? '').trim() || null;
    }
    const { error: histErr } = await admin.from('kanban_historico').insert({
      card_id: cardId,
      usuario_id: preenchidoPor,
      usuario_nome: usuarioNome,
      acao: 'formulario_enviado',
      tipo: 'formulario_enviado',
      detalhe: {
        formulario_id: lido.token.formulario_id,
        resposta_id: respostaId,
        token_id: lido.token.id,
      },
    });
    if (histErr) {
      return NextResponse.json({ ok: false, error: histErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
