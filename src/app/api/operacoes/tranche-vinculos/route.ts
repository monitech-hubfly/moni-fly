import { NextResponse } from 'next/server';
import {
  abrirTrancheVinculoOperacoes,
  listarTrancheVinculosOperacoes,
} from '@/lib/operacoes/tranche-vinculos-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * API JSON (fora do flight RSC) para vínculos de tranche Operações → Crédito Obra.
 * Evita o digest de produção que mascara o retorno das server actions no modal.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const operacoesCardId = String(searchParams.get('operacoesCardId') ?? '').trim();
    if (!operacoesCardId) {
      return NextResponse.json({ ok: false, error: 'Card inválido.' }, { status: 400 });
    }
    const result = await listarTrancheVinculosOperacoes(operacoesCardId);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[api/operacoes/tranche-vinculos GET]', msg);
    return NextResponse.json(
      { ok: false, error: msg || 'Erro ao listar vínculos de tranche.' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      operacoesCardId?: string;
      trancheIndex?: number;
      basePath?: string;
    } | null;

    const operacoesCardId = String(body?.operacoesCardId ?? '').trim();
    const trancheIndex = Number(body?.trancheIndex);
    if (!operacoesCardId || !Number.isFinite(trancheIndex)) {
      return NextResponse.json({ ok: false, error: 'Dados inválidos.' }, { status: 400 });
    }

    const result = await abrirTrancheVinculoOperacoes({
      operacoesCardId,
      trancheIndex,
      basePath: body?.basePath,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[api/operacoes/tranche-vinculos POST]', msg);
    return NextResponse.json(
      { ok: false, error: msg || 'Erro inesperado ao abrir tranche.' },
      { status: 500 },
    );
  }
}
