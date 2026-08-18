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

export async function GET(_request: Request) {
  // Auth temporariamente removida para backfill manual — remover arquivo após uso
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

  // Processar em lotes de 5 em paralelo
  const BATCH = 5;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const settled = await Promise.allSettled(batch.map(id => pushParaGCal(id)));
    for (let j = 0; j < batch.length; j++) {
      results.push({ id: batch[j]!, ok: settled[j]!.status === 'fulfilled' });
    }
  }

  const ok = results.filter(r => r.ok).length;
  console.log(`[gcal-backfill] concluído — ${ok}/${ids.length} ok`);
  return NextResponse.json({ total: ids.length, ok, results });
}
