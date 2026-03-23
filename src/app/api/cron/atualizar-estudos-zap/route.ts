import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runZapScraper } from '@/lib/apify-zap';
import { applyZapCasasUpdate } from '@/app/step-one/[id]/etapa/actions';
import type { createClient } from '@/lib/supabase/server';

/**
 * Atualização mensal das listagens ZAP (casas) dos estudos Step 1 finalizados.
 * - Não remove itens: os que não aparecem mais na ZAP são marcados como despublicado.
 * - Registros manuais não são alterados.
 * - Gera alerta para o Franqueado quando há atualização.
 *
 * Configure um cron (ex.: Vercel Cron ou agendador externo) para chamar mensalmente:
 * POST /api/cron/atualizar-estudos-zap
 * Header: Authorization: Bearer <CRON_SECRET>
 *
 * Variáveis de ambiente: CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY, APIFY_API_TOKEN (ou VITE_APIFY_TOKEN).
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET não configurado' }, { status: 500 });
  }
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (e) {
    return NextResponse.json(
      { error: 'Admin client não disponível. Configure SUPABASE_SERVICE_ROLE_KEY.' },
      { status: 500 },
    );
  }

  const { data: processos } = await supabase
    .from('processo_step_one')
    .select('id, user_id, cidade, estado')
    .eq('status', 'concluido');

  if (!processos?.length) {
    return NextResponse.json({
      ok: true,
      message: 'Nenhum estudo finalizado para atualizar.',
      updated: 0,
    });
  }

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalDespublicados = 0;
  const usersToAlert = new Set<string>();

  for (const p of processos) {
    const cidade = (p.cidade ?? '').trim();
    const estado = (p.estado ?? '').trim().slice(0, 2).toUpperCase();
    if (!cidade || !estado) continue;

    const result = await runZapScraper(cidade, estado, undefined, 300, 120_000);
    if (!result.ok || !result.items?.length) continue;

    const counts = await applyZapCasasUpdate(
      supabase as Awaited<ReturnType<typeof createClient>>,
      p.id,
      result.items,
      cidade,
      estado,
    );
    totalInserted += counts.inserted;
    totalUpdated += counts.updated;
    totalDespublicados += counts.despublicados;
    if (counts.inserted + counts.updated + counts.despublicados > 0 && p.user_id) {
      usersToAlert.add(p.user_id);
    }
  }

  for (const userId of Array.from(usersToAlert)) {
    await supabase.from('alertas').insert({
      user_id: userId,
      tipo: 'Atualização mensal ZAP',
      mensagem:
        'As listagens de casas dos seus estudos Step 1 finalizados foram atualizadas. Itens que não aparecem mais na ZAP foram marcados como despublicado.',
      lido: false,
    });
  }

  return NextResponse.json({
    ok: true,
    processos: processos.length,
    inserted: totalInserted,
    updated: totalUpdated,
    despublicados: totalDespublicados,
    alertasGerados: usersToAlert.size,
  });
}
