import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { carregarCardPortfolio } from '@/lib/formularios/cards-portfolio-busca';

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
      .select('id, status, token_id, card_id, formulario_id')
      .eq('id', respostaId)
      .single();

    if (rErr || !resposta) return NextResponse.json({ error: 'Resposta não encontrada.' }, { status: 404 });
    if (resposta.status === 'enviado') return NextResponse.json({ error: 'Formulário já enviado.' }, { status: 409 });

    const linhas = body.valores
      .map((valor) => {
        const campoId = String(valor.campo_id ?? valor.campoId ?? '').trim();
        if (!campoId) return null;
        const lista = Array.isArray(valor.valor) ? valor.valor : Array.isArray(valor.valorJson) ? valor.valorJson : null;
        const json =
          lista ??
          (valor.valorJson && typeof valor.valorJson === 'object' ? valor.valorJson : null);
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
          valor_json: json,
        };
      })
      .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha));

    const cardInformado = await cardIdDasLinhas(admin, linhas);
    if (cardInformado === false) {
      return NextResponse.json({ error: 'O card vinculado não está no Funil Portfólio.' }, { status: 400 });
    }

    if (linhas.length > 0) {
      const { error: delErr } = await admin.from('formulario_resposta_valores').delete().eq('resposta_id', respostaId);
      if (delErr) return NextResponse.json({ error: 'Erro ao salvar respostas.' }, { status: 500 });
      const { error: vErr } = await admin.from('formulario_resposta_valores').insert(linhas);
      if (vErr) {
        console.error('Erro ao salvar valores:', vErr);
        return NextResponse.json({ error: 'Erro ao salvar respostas.' }, { status: 500 });
      }
    }

    const cardIdFinal = cardInformado?.id ?? (resposta.card_id as string | null) ?? null;
    let kanbanId: string | null = null;
    if (cardIdFinal) {
      const { data: cardRow } = await admin
        .from('kanban_cards')
        .select('kanban_id')
        .eq('id', cardIdFinal)
        .maybeSingle();
      kanbanId = (cardRow as { kanban_id?: string | null } | null)?.kanban_id ?? null;
    }

    const patch: {
      status: 'enviado';
      enviado_em: string;
      card_id?: string | null;
      kanban_id?: string | null;
      rede_franqueado_id?: string | null;
      nome_franqueado?: string | null;
      numero_franquia?: string | null;
    } = {
      status: 'enviado',
      enviado_em: new Date().toISOString(),
    };
    if (cardIdFinal) {
      patch.card_id = cardIdFinal;
      patch.kanban_id = kanbanId;
    }
    if (cardInformado) {
      patch.rede_franqueado_id = cardInformado.rede_franqueado_id;
      patch.nome_franqueado = cardInformado.franqueado || null;
      patch.numero_franquia = cardInformado.numero_franquia;
    }

    const { error: upErr } = await admin.from('formulario_respostas').update(patch).eq('id', respostaId);

    if (upErr) return NextResponse.json({ error: 'Erro ao finalizar envio.' }, { status: 500 });

    if (cardIdFinal) {
      await gravarRespostaNoCard(admin, {
        cardId: cardIdFinal,
        formularioId: String(resposta.formulario_id),
        respostaId,
      });
    }

    const cardHistorico = cardIdFinal;
    if (cardHistorico) {
      await admin.from('kanban_historico').insert({
        card_id: cardHistorico,
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

async function gravarRespostaNoCard(
  admin: ReturnType<typeof createAdminClient>,
  params: { cardId: string; formularioId: string; respostaId: string },
) {
  const agora = new Date().toISOString();
  const { data: pendente } = await admin
    .from('kanban_card_formularios')
    .select('id')
    .eq('card_id', params.cardId)
    .eq('formulario_id', params.formularioId)
    .is('resposta_id', null)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pendente?.id) {
    const { error } = await admin
      .from('kanban_card_formularios')
      .update({ status: 'enviado', resposta_id: params.respostaId, atualizado_em: agora })
      .eq('id', pendente.id);
    if (error) console.error('Erro ao atualizar formulário do card:', error.message);
    return;
  }
  const { error } = await admin.from('kanban_card_formularios').insert({
    card_id: params.cardId,
    formulario_id: params.formularioId,
    resposta_id: params.respostaId,
    status: 'enviado',
  });
  if (error) console.error('Erro ao gravar formulário no card:', error.message);
}

const UUID_CARD = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cardIdDoJson(valor: unknown): string | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;
  const id = String((valor as { card_id?: unknown }).card_id ?? '').trim();
  return UUID_CARD.test(id) ? id : null;
}

async function cardIdDasLinhas(
  admin: ReturnType<typeof createAdminClient>,
  linhas: Array<{ campo_id: string; valor_json: unknown }>,
): Promise<
  | { id: string; rede_franqueado_id: string | null; franqueado: string; numero_franquia: string | null }
  | null
  | false
> {
  if (linhas.length === 0) return null;
  const { data: tipos } = await admin
    .from('formulario_campos')
    .select('id, tipo, config')
    .in(
      'id',
      linhas.map((linha) => linha.campo_id),
    );
  const idsCard = new Set(
    (tipos ?? [])
      .filter((campo) => {
        const row = campo as { tipo?: string; config?: { widget?: string } | null };
        return row.tipo === 'card_portfolio' || row.config?.widget === 'card_portfolio';
      })
      .map((campo) => String((campo as { id: string }).id)),
  );
  if (idsCard.size === 0) return null;
  const linha = linhas.find((item) => idsCard.has(item.campo_id));
  const cardId = linha ? cardIdDoJson(linha.valor_json) : null;
  if (!cardId) return null;
  const card = await carregarCardPortfolio(admin, cardId);
  if (!card) return false;
  const nome = card.franqueado.includes(' — ')
    ? card.franqueado.split(' — ').slice(1).join(' — ')
    : card.franqueado;
  return {
    id: card.id,
    rede_franqueado_id: card.rede_franqueado_id,
    franqueado: nome || card.franqueado,
    numero_franquia: card.numero_franquia,
  };
}
