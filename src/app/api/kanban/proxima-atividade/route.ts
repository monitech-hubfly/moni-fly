import { NextResponse } from 'next/server';
import {
  adicionarProximaAtividadeItem,
  buscarAtividadesAbertasCard,
  concluirProximaAtividadeItem,
  salvarProximaAtividade,
} from '@/lib/actions/card-actions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * API JSON para próxima atividade no board.
 * Evita o refresh RSC automático das server actions ao adicionar/concluir.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      action?: string;
      cardId?: string;
      itemId?: string;
      descricao?: string;
      prazo?: string | null;
      basePath?: string;
    } | null;

    if (!body) {
      return NextResponse.json({ ok: false, error: 'Payload inválido.' }, { status: 400 });
    }

    const action = String(body.action ?? '').trim();
    const cardId = String(body.cardId ?? '').trim();
    const basePath = String(body.basePath ?? '/').trim() || '/';
    if (!cardId) {
      return NextResponse.json({ ok: false, error: 'Card inválido.' }, { status: 400 });
    }

    if (action === 'listar') {
      const items = await buscarAtividadesAbertasCard(cardId);
      return NextResponse.json({ ok: true, items }, { status: 200 });
    }

    if (action === 'adicionar') {
      const result = await adicionarProximaAtividadeItem({
        cardId,
        descricao: String(body.descricao ?? ''),
        prazo: body.prazo ?? null,
        basePath,
        skipRevalidate: true,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    if (action === 'concluir') {
      const itemId = String(body.itemId ?? '').trim();
      if (!itemId) {
        return NextResponse.json({ ok: false, error: 'Atividade inválida.' }, { status: 400 });
      }
      const result = await concluirProximaAtividadeItem({
        itemId,
        cardId,
        basePath,
        skipRevalidate: true,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    if (action === 'limpar') {
      const result = await salvarProximaAtividade({
        cardId,
        proxima_atividade: null,
        prazo_atividade: null,
        basePath,
        skipRevalidate: true,
      });
      if (!result.ok) {
        return NextResponse.json(result, { status: 400 });
      }
      return NextResponse.json(
        { ok: true, proxima_atividade: null, prazo_atividade: null },
        { status: 200 },
      );
    }

    return NextResponse.json({ ok: false, error: 'Ação inválida.' }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[api/kanban/proxima-atividade POST]', msg);
    return NextResponse.json(
      { ok: false, error: msg || 'Erro inesperado ao salvar próxima atividade.' },
      { status: 500 },
    );
  }
}
