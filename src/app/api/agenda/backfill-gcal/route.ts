import { NextResponse } from 'next/server';
import { pushParaGCal } from '@/lib/actions/agenda-gcal';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/agenda/backfill-gcal
 * Sincroniza todos os eventos futuros do HubFly que ainda não foram enviados ao GCal.
 * Requer: Authorization: Bearer <CRON_SECRET>
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET não configurado' }, { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const adminDb = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: rows, error } = await (adminDb.from('gantt_planejamento') as any)
    .select('id')
    .gte('data', today)
    .neq('origem', 'google_calendar')
    .is('gcal_hubfly_push_id', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids: string[] = ((rows ?? []) as { id: string }[]).map(r => r.id);
  console.log(`[gcal-backfill] ${ids.length} evento(s) para sincronizar`);

  const results: { id: string; ok: boolean }[] = [];

  for (const id of ids) {
    try {
      await pushParaGCal(id);
      results.push({ id, ok: true });
    } catch {
      results.push({ id, ok: false });
    }
    // Pequena pausa para não estourar rate limit do GCal
    await new Promise(r => setTimeout(r, 300));
  }

  const ok = results.filter(r => r.ok).length;
  console.log(`[gcal-backfill] concluído — ${ok}/${ids.length} ok`);
  return NextResponse.json({ total: ids.length, ok, results });
}
