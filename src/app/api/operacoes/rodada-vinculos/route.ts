import { NextResponse } from 'next/server';
import {
  abrirRodadaVinculo,
  listarRodadaVinculos,
} from '@/lib/operacoes/rodada-vinculos-service';
import { rolePodeAbrirRodadaVinculosOperacoes } from '@/lib/operacoes/rodada-vinculos-config';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * API JSON (fora do flight RSC) para vínculos de rodada Operações → Funil Divify.
 * Evita o digest de produção que mascara o retorno das server actions no modal.
 * Sem revalidatePath.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const cardId = String(searchParams.get('cardId') ?? '').trim();
    if (!cardId) {
      return NextResponse.json({ ok: false, error: 'Card inválido.' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Faça login.' }, { status: 401 });
    }

    const result = await listarRodadaVinculos(cardId);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[api/operacoes/rodada-vinculos GET]', msg);
    return NextResponse.json(
      { ok: false, error: msg || 'Erro ao listar vínculos de rodada.' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      cardId?: string;
      rodadaIndex?: number;
    } | null;

    const cardId = String(body?.cardId ?? '').trim();
    const rodadaIndex = Number(body?.rodadaIndex);
    if (!cardId || !Number.isFinite(rodadaIndex)) {
      return NextResponse.json({ ok: false, error: 'Dados inválidos.' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Faça login.' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    const role = (profile as { role?: string } | null)?.role ?? '';
    if (!rolePodeAbrirRodadaVinculosOperacoes(role)) {
      return NextResponse.json(
        { ok: false, error: 'Sem permissão para abrir rodadas.' },
        { status: 403 },
      );
    }

    const result = await abrirRodadaVinculo(cardId, rodadaIndex, user.id);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[api/operacoes/rodada-vinculos POST]', msg);
    return NextResponse.json(
      { ok: false, error: msg || 'Erro inesperado ao abrir rodada.' },
      { status: 500 },
    );
  }
}
