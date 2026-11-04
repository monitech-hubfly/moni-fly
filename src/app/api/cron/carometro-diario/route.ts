import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { gerarSnapshotCarometro } from '@/lib/carometro/carometro-status-snapshot';

/**
 * Cron: snapshot diário do Carômetro (Sirene / Engajamento v2 / Indicadores v3)
 * para cada usuário em area_pessoas.
 *
 * GET /api/cron/carometro-diario
 * Header: Authorization: Bearer <CRON_SECRET>
 * Schedule: "59 23 * * *" (vercel.json)
 *
 * Processamento em lotes de 10 para evitar timeout da função Vercel.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET não configurado' }, { status: 500 });
  }
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const db   = createAdminClient();
  const hoje = new Date();

  const { data: pessoas, error } = await db
    .from('area_pessoas')
    .select('profile_id, area_id, nome')
    .eq('ativo', true)
    .not('profile_id', 'is', null)
    .not('area_id', 'is', null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const usuarios = (pessoas ?? []) as {
    profile_id: string;
    area_id: string;
    nome: string | null;
  }[];

  let ok = 0;
  const falhas: { profile_id: string; erro: string }[] = [];

  // Processa em lotes de 10 para evitar timeout e sobrecarga de conexões
  const LOTE_SIZE = 10;
  for (let i = 0; i < usuarios.length; i += LOTE_SIZE) {
    const lote = usuarios.slice(i, i + LOTE_SIZE);
    await Promise.all(
      lote.map(async u => {
        try {
          await gerarSnapshotCarometro(db, u.profile_id, u.area_id, u.nome, hoje);
          ok++;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`[carometro-diario] erro profile=${u.profile_id}:`, msg);
          falhas.push({ profile_id: u.profile_id, erro: msg });
        }
      }),
    );
  }

  console.log(`[carometro-diario] concluído: ${ok}/${usuarios.length} ok, ${falhas.length} falhas`);

  return NextResponse.json({
    ok,
    erros: falhas.length,
    total: usuarios.length,
    ...(falhas.length > 0 && { falhas }),
  });
}
