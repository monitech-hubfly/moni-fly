import { NextResponse } from 'next/server';
import {
  ensureProcessoStepOneForKanbanCard,
  resolverProcessoIdViaRedeFranqueado,
} from '@/lib/actions/kanban-mapa-competidores';
import { createClient } from '@/lib/supabase/server';
import { fetchZapCasasWithFallback } from '@/lib/zap-fetch-casas';
import { applyZapCasasUpdate, verifyProcessoCasasAccess } from '@/lib/zap-save-casas';

/** Apify: polling do run costuma levar 1,5–4 min. */
export const maxDuration = 300;

/**
 * POST /api/apify-zap
 * Body: { cidade, estado, condominio?, processoId?, cardId? }
 * Com processoId (ou cardId para criar/vincular processo): busca + grava no banco.
 * Sem processoId: devolve items (uso em etapas server-side).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const cidade = typeof body?.cidade === 'string' ? body.cidade.trim() : '';
    const estado = typeof body?.estado === 'string' ? body.estado.trim() : '';
    const condominio =
      typeof body?.condominio === 'string' ? body.condominio.trim() || undefined : undefined;
    const condominioVinculo =
      typeof body?.condominioVinculo === 'string'
        ? body.condominioVinculo.trim() || undefined
        : undefined;

    const processoId =
      typeof body?.processoId === 'string' ? body.processoId.trim() || undefined : undefined;
    const cardId = typeof body?.cardId === 'string' ? body.cardId.trim() || undefined : undefined;

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

    let effectiveProcessoId = processoId;
    if (!effectiveProcessoId && cardId) {
      const supabase = await createClient();
      const viaRede = await resolverProcessoIdViaRedeFranqueado(supabase, cardId);
      if (viaRede) {
        effectiveProcessoId = viaRede;
      } else {
        const ensured = await ensureProcessoStepOneForKanbanCard(cardId);
        if (!ensured.ok) {
          return NextResponse.json({ ok: false, error: ensured.error }, { status: 200 });
        }
        effectiveProcessoId = ensured.processoId;
      }
    }

    if (effectiveProcessoId) {
      const access = await verifyProcessoCasasAccess(effectiveProcessoId);
      if (!access.ok) {
        return NextResponse.json({ ok: false, error: access.error }, { status: 200 });
      }

      const { inserted, updated, despublicados } = await applyZapCasasUpdate(
        access.supabase,
        effectiveProcessoId,
        result.items,
        cidade,
        estado,
        { condominioVinculo },
      );

      return NextResponse.json({
        ok: true,
        saved: true,
        processoId: effectiveProcessoId,
        inserted,
        updated,
        despublicados,
        itemCount: result.items.length,
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
