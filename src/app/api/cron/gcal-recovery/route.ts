import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { pushParaGCal } from '@/lib/actions/agenda-gcal';

/**
 * Rota de recovery ONE-TIME: re-envia para o GCal todos os eventos HUB-FLY
 * futuros que têm gcal_hubfly_push_id gravado.
 *
 * Finalidade: restaurar convidados que tiveram o evento removido do GCal pelo
 * bug do cron (cleanup sem check de organizador — deployado em 2026-11-11).
 *
 * Chamar uma vez com: GET /api/cron/gcal-recovery
 * Header: Authorization: Bearer <CRON_SECRET>
 *
 * REMOVER esta rota após a execução do recovery.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET não configurado' }, { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const hoje = new Date().toISOString().slice(0, 10);

  const { data: eventos, error } = await supabase
    .from('gantt_planejamento')
    .select('id, titulo, data')
    .not('gcal_hubfly_push_id', 'is', null)
    .neq('origem', 'google_calendar')
    .gte('data', hoje)
    .order('data') as { data: { id: string; titulo: string | null; data: string }[] | null; error: unknown };

  if (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }

  const ids = (eventos ?? []).map(e => e.id);
  console.log(`[gcal-recovery] ${ids.length} eventos futuros para re-push`);

  const results: { id: string; titulo: string | null; data: string; ok: boolean; error?: string }[] = [];

  for (const ev of (eventos ?? [])) {
    try {
      await pushParaGCal(ev.id);
      results.push({ id: ev.id, titulo: ev.titulo, data: ev.data, ok: true });
      console.log(`[gcal-recovery] ✓ ${ev.id} | ${ev.data} | ${ev.titulo ?? ''}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ id: ev.id, titulo: ev.titulo, data: ev.data, ok: false, error: msg });
      console.warn(`[gcal-recovery] ✗ ${ev.id}: ${msg}`);
    }
  }

  const ok   = results.filter(r => r.ok).length;
  const fail = results.filter(r => !r.ok).length;
  console.log(`[gcal-recovery] concluído: ${ok} ok, ${fail} falhas`);

  return NextResponse.json({ ok: true, total: ids.length, pushed: ok, failed: fail, results });
}
