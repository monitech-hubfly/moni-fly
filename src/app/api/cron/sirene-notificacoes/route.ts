import { NextResponse } from 'next/server';
import { enviarNotificacoesAtrasoTopicos } from '@/app/sirene/actions';

/**
 * Cron: notifica times sobre tópicos Sirene com > 2 dias úteis de atraso (TOP 10, dedup 24h).
 * GET /api/cron/sirene-notificacoes
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

  const result = await enviarNotificacoesAtrasoTopicos();
  return NextResponse.json(result);
}
