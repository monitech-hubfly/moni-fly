import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import {
  ensureProcessoStepOneForKanbanCard,
  resolverProcessoIdViaRedeFranqueado,
} from '@/lib/actions/kanban-mapa-competidores';
import { createClient } from '@/lib/supabase/server';
import {
  fetchAllZapCasas,
  parseCityStateFromZapSearchUrl,
} from '@/lib/zap-glue-server-fetch';
import { applyZapCasasUpdate, verifyProcessoCasasAccess } from '@/lib/zap-save-casas';

/**
 * POST /api/buscar-casas-por-link
 * Body: { linkZap, processoId?, cardId?, condominioVinculo? }
 * Busca listagens via glue-api usando URL de pesquisa ZAP colada pelo usuário.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const linkZap = typeof body?.linkZap === 'string' ? body.linkZap.trim() : '';
    const processoId =
      typeof body?.processoId === 'string' ? body.processoId.trim() || undefined : undefined;
    const cardId = typeof body?.cardId === 'string' ? body.cardId.trim() || undefined : undefined;
    const condominioVinculo =
      typeof body?.condominioVinculo === 'string'
        ? body.condominioVinculo.trim() || undefined
        : undefined;

    if (!linkZap.startsWith('https://www.zapimoveis.com.br')) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Cole um link válido de busca da ZAP (https://www.zapimoveis.com.br/...).',
        },
        { status: 400 },
      );
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

    if (!effectiveProcessoId) {
      return NextResponse.json(
        { ok: false, error: 'Informe processoId ou cardId válido.' },
        { status: 400 },
      );
    }

    const access = await verifyProcessoCasasAccess(effectiveProcessoId);
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: 200 });
    }

    const cookieHeader = request.headers.get('cookie') ?? undefined;
    const result = await fetchAllZapCasas({
      cidade: '',
      estado: '',
      startUrl: linkZap,
      cookie: cookieHeader,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 200 });
    }

    const parsed = parseCityStateFromZapSearchUrl(linkZap);
    const { data: processo } = await access.supabase
      .from('processo_step_one')
      .select('cidade, estado')
      .eq('id', effectiveProcessoId)
      .maybeSingle();

    const cidade =
      parsed.cidade ||
      (typeof processo?.cidade === 'string' ? processo.cidade.trim() : '') ||
      '—';
    const estado =
      parsed.estado ||
      (typeof processo?.estado === 'string' ? processo.estado.trim().slice(0, 2).toUpperCase() : '') ||
      'SP';

    const { inserted, updated, despublicados } = await applyZapCasasUpdate(
      access.supabase,
      effectiveProcessoId,
      result.items,
      cidade,
      estado,
      { condominioVinculo },
    );

    revalidatePath('/');

    return NextResponse.json({
      ok: true,
      saved: true,
      processoId: effectiveProcessoId,
      inserted,
      updated,
      despublicados,
      itemCount: result.items.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
