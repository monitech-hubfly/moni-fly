import { NextResponse } from 'next/server';
import { fetchZapCasasWithFallback } from '@/lib/zap-fetch-casas';
import { applyZapCasasUpdate, verifyProcessoCasasAccess } from '@/lib/zap-save-casas';

/** Apify: polling do run costuma levar 1,5–4 min. */
export const maxDuration = 300;

/**
 * POST /api/apify-zap
 * Body: { cidade, estado, condominio?, processoId? }
 * Com processoId: busca + grava no banco e devolve só contagens (evita payload > 1 MB no cliente).
 * Sem processoId: devolve items (uso em etapas server-side).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const cidade = typeof body?.cidade === 'string' ? body.cidade.trim() : '';
    const estado = typeof body?.estado === 'string' ? body.estado.trim() : '';
    const condominio =
      typeof body?.condominio === 'string' ? body.condominio.trim() || undefined : undefined;
    const processoId =
      typeof body?.processoId === 'string' ? body.processoId.trim() || undefined : undefined;

    if (!cidade || !estado) {
      return NextResponse.json(
        { ok: false, error: 'Corpo da requisição deve conter cidade e estado.' },
        { status: 400 },
      );
    }

    const cookieHeader = request.headers.get('cookie') ?? undefined;
    const result = await fetchZapCasasWithFallback({
      cidade,
      estado,
      condominio,
      cookie: cookieHeader,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 200 });
    }

    if (processoId) {
      const access = await verifyProcessoCasasAccess(processoId);
      if (!access.ok) {
        return NextResponse.json({ ok: false, error: access.error }, { status: 200 });
      }

      const { inserted, updated, despublicados } = await applyZapCasasUpdate(
        access.supabase,
        processoId,
        result.items,
        cidade,
        estado,
      );

      return NextResponse.json({
        ok: true,
        saved: true,
        inserted,
        updated,
        despublicados,
        source: result.source,
      });
    }

    return NextResponse.json({
      ok: true,
      items: result.items,
      source: result.source,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
