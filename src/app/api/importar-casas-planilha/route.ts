import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import {
  ensureProcessoStepOneForKanbanCard,
  resolverProcessoIdViaRedeFranqueado,
} from '@/lib/actions/kanban-mapa-competidores';
import { createClient } from '@/lib/supabase/server';
import {
  applyPlanilhaCasasImport,
  parsePlanilhaCasasFile,
  validarStatusLinksListingsCasas,
  verifyProcessoCasasAccess,
} from '@/lib/zap-save-casas';

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * POST /api/importar-casas-planilha
 * multipart/form-data: arquivo (.xlsx|.csv), processoId?, cardId, condominioVinculo
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const arquivo = formData.get('arquivo');
    const processoIdRaw =
      typeof formData.get('processoId') === 'string'
        ? String(formData.get('processoId')).trim()
        : '';
    const cardId =
      typeof formData.get('cardId') === 'string' ? String(formData.get('cardId')).trim() : '';
    const condominioVinculo =
      typeof formData.get('condominioVinculo') === 'string'
        ? String(formData.get('condominioVinculo')).trim()
        : '';

    if (!(arquivo instanceof File)) {
      return NextResponse.json(
        { ok: false, error: 'Envie um arquivo .xlsx ou .csv no campo arquivo.' },
        { status: 400 },
      );
    }

    if (!condominioVinculo) {
      return NextResponse.json(
        { ok: false, error: 'condominioVinculo é obrigatório.' },
        { status: 400 },
      );
    }

    const nome = arquivo.name.toLowerCase();
    if (!nome.endsWith('.xlsx') && !nome.endsWith('.xls') && !nome.endsWith('.csv')) {
      return NextResponse.json(
        { ok: false, error: 'Formato não suportado. Use .xlsx ou .csv.' },
        { status: 400 },
      );
    }

    if (arquivo.size <= 0 || arquivo.size > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: 'Arquivo vazio ou maior que 10 MB.' },
        { status: 400 },
      );
    }

    let effectiveProcessoId = processoIdRaw || undefined;
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

    const buffer = await arquivo.arrayBuffer();
    let records: Record<string, unknown>[];
    try {
      records = parsePlanilhaCasasFile(buffer, arquivo.name);
    } catch (parseErr) {
      const message = parseErr instanceof Error ? parseErr.message : String(parseErr);
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }

    if (records.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Planilha vazia ou sem linhas de dados.' },
        { status: 400 },
      );
    }

    const { inserted, updated, erros } = await applyPlanilhaCasasImport(
      access.supabase,
      effectiveProcessoId,
      records,
      condominioVinculo,
      {
        cidadePadrao:
          typeof formData.get('cidadePadrao') === 'string'
            ? String(formData.get('cidadePadrao')).trim()
            : null,
        estadoPadrao:
          typeof formData.get('estadoPadrao') === 'string'
            ? String(formData.get('estadoPadrao')).trim()
            : null,
      },
    );

    const validacao = await validarStatusLinksListingsCasas(access.supabase, effectiveProcessoId);

    revalidatePath('/');

    return NextResponse.json({
      ok: true,
      processoId: effectiveProcessoId,
      inserted,
      updated,
      erros,
      validacao,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
