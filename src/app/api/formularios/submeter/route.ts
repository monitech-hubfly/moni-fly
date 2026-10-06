import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolverRedeFranqueadoPorNumero } from '@/lib/formularios/resolver-franqueado';

type ValorEntrada = {
  campo_id?: string;
  campoId?: string;
  valor?: string | string[] | null;
  valorTexto?: string | null;
  valorNumero?: number | null;
  valorData?: string | null;
  valorJson?: unknown;
  arquivos?: unknown;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      resposta_id?: string;
      respostaId?: string;
      numero_franquia?: string;
      numeroFranquia?: string;
      nome_franqueado?: string;
      nomeFranqueado?: string;
      valores?: ValorEntrada[];
    };
    const respostaId = String(body.resposta_id ?? body.respostaId ?? '').trim();
    if (!respostaId || !Array.isArray(body.valores)) {
      return NextResponse.json({ error: 'resposta_id e valores são obrigatórios.' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: resposta, error: rErr } = await admin
      .from('formulario_respostas')
      .select('id, status, token_id, card_id, rede_franqueado_id, formulario_id, numero_franquia')
      .eq('id', respostaId)
      .single();

    if (rErr || !resposta) return NextResponse.json({ error: 'Resposta não encontrada.' }, { status: 404 });
    if (resposta.status === 'enviado') return NextResponse.json({ error: 'Formulário já enviado.' }, { status: 409 });

    const linhas = body.valores
      .map((valor) => {
        const campoId = String(valor.campo_id ?? valor.campoId ?? '').trim();
        if (!campoId) return null;
        const lista = Array.isArray(valor.valor)
          ? valor.valor
          : Array.isArray(valor.valorJson)
            ? valor.valorJson
            : null;
        const texto =
          typeof valor.valor === 'string'
            ? valor.valor
            : (valor.valorTexto ?? (valor.valorNumero != null ? String(valor.valorNumero) : null));
        return {
          resposta_id: respostaId,
          campo_id: campoId,
          valor_texto: texto,
          valor_numero: valor.valorNumero ?? null,
          valor_data: valor.valorData || null,
          valor_json: lista,
        };
      })
      .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha));

    if (linhas.length > 0) {
      const { error: delErr } = await admin.from('formulario_resposta_valores').delete().eq('resposta_id', respostaId);
      if (delErr) return NextResponse.json({ error: 'Erro ao salvar respostas.' }, { status: 500 });
      const { error: vErr } = await admin.from('formulario_resposta_valores').insert(linhas);
      if (vErr) {
        console.error('Erro ao salvar valores:', vErr);
        return NextResponse.json({ error: 'Erro ao salvar respostas.' }, { status: 500 });
      }
    }

    const numero = String(body.numero_franquia ?? body.numeroFranquia ?? resposta.numero_franquia ?? '').trim();
    const nome = String(body.nome_franqueado ?? body.nomeFranqueado ?? '').trim();
    let redeId = (resposta.rede_franqueado_id as string | null) ?? null;
    if (!redeId && !resposta.card_id && numero) {
      redeId = await resolverRedeFranqueadoPorNumero(admin, numero);
    }
    if (!resposta.card_id && !redeId) {
      return NextResponse.json(
        { ok: false, error: 'Não encontramos a franquia informada. Confira o número e envie de novo.' },
        { status: 422 },
      );
    }

    const { error: upErr } = await admin
      .from('formulario_respostas')
      .update({
        status: 'enviado',
        enviado_em: new Date().toISOString(),
        rede_franqueado_id: redeId,
        numero_franquia: numero || null,
        nome_franqueado: nome || null,
      })
      .eq('id', respostaId);

    if (upErr) return NextResponse.json({ error: 'Erro ao finalizar envio.' }, { status: 500 });

    if (resposta.token_id) {
      await admin.from('formulario_tokens').update({ usado: true }).eq('id', resposta.token_id);
    }

    if (resposta.card_id) {
      await admin.from('kanban_historico').insert({
        card_id: resposta.card_id,
        acao: 'formulario_enviado',
        tipo: 'formulario_enviado',
        detalhe: { formulario_id: resposta.formulario_id, resposta_id: respostaId },
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
