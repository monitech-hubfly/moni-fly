import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { gerarSnapshotCarometro } from '@/lib/carometro/carometro-status-snapshot';

/**
 * Recálculo retroativo dos snapshots do Carômetro com a lógica atualizada.
 * GET /api/admin/recalc-carometro?secret=<CRON_SECRET>
 * ARQUIVO TEMPORÁRIO — deletar após usar.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET não configurado' }, { status: 500 });

  const url = new URL(request.url);
  if (url.searchParams.get('secret') !== secret) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const db = createAdminClient();

  // Busca todos os (profile_id, area_id, data, nome) existentes
  const { data: rows, error } = await db
    .from('carometro_status_diario')
    .select('profile_id, area_id, data')
    .order('data', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const entries = (rows ?? []) as { profile_id: string; area_id: string; data: string }[];

  let ok = 0;
  const falhas: string[] = [];

  // Processa em série para não sobrecarregar o banco
  for (const entry of entries) {
    try {
      await gerarSnapshotCarometro(
        db,
        entry.profile_id,
        entry.area_id,
        null,
        new Date(entry.data + 'T12:00:00'),
      );
      ok++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      falhas.push(`${entry.profile_id}/${entry.data}: ${msg}`);
    }
  }

  return NextResponse.json({ ok, erros: falhas.length, total: entries.length, falhas: falhas.slice(0, 20) });
}
