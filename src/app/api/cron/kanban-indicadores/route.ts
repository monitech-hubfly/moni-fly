import { NextResponse } from 'next/server';
import { processarKanbanIndicadores } from '@/lib/kanban/kanban-indicadores-auto';

/**
 * Cron: preenche automaticamente indicadores de KANBAN / SLA's (Automático)
 * com dados da semana ISO anterior.
 *
 * GET /api/cron/kanban-indicadores
 * Header: Authorization: Bearer <CRON_SECRET>
 * Schedule: toda segunda-feira às 12:00 UTC (vercel.json)
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

  const resultados = await processarKanbanIndicadores(new Date());

  const ok     = resultados.filter(r => !r.erro).length;
  const erros  = resultados.filter(r =>  r.erro).length;
  const skips  = resultados.filter(r => r.operacao === 'skip').length;

  return NextResponse.json({
    ok,
    erros,
    skips,
    total: resultados.length,
    resultados,
  });
}
