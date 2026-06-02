import { NextResponse } from 'next/server';
import { notificarCardsComSlaVencido } from '@/lib/kanban/sla-alertas';
import { notificarAtividadesComSlaCritico } from '@/lib/kanban/sla-atividade-alertas';

/**
 * Cron: alertas Sirene para cards com SLA da fase atual vencido
 * e atividades/chamados com SLA em atenção ou atrasado.
 * GET /api/cron/sla-alertas
 * Header: Authorization: Bearer <CRON_SECRET>
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

  await Promise.all([notificarCardsComSlaVencido(), notificarAtividadesComSlaCritico()]);
  return NextResponse.json({ ok: true });
}
