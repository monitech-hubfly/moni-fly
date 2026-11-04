import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { gerarSnapshotCarometro } from '@/lib/carometro/carometro-status-snapshot';

/**
 * POST /api/carometro/snapshot-agora
 *
 * Trigger de snapshot em tempo real: recalcula e salva o snapshot do usuário
 * imediatamente após qualquer ação que altere o score (concluir meta, relançar, etc.).
 *
 * Body: { profile_id?: string; area_id: string }
 * - Se profile_id não for informado, usa o usuário autenticado.
 * - Requer autenticação (cookies de sessão).
 */
export async function POST(request: Request) {
  try {
    // Valida sessão
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await request.json() as { profile_id?: string; area_id?: string };
    const profileId = body.profile_id ?? user.id;
    const areaId    = body.area_id;

    if (!areaId) {
      return NextResponse.json({ error: 'area_id obrigatório' }, { status: 400 });
    }

    // Usa admin client para contornar RLS (mesmo padrão do cron)
    const db = createAdminClient();
    await gerarSnapshotCarometro(db, profileId, areaId, null, new Date());

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[snapshot-agora]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
