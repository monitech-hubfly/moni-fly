import { NextResponse } from 'next/server'
import { dispararLembreteLinksCorretores } from '@/lib/corretor-lembrete-semanal'

/**
 * Disparo manual do lembrete. Na quinta ele também roda dentro de /api/cron/sla-alertas,
 * no cron diário que já existe, para não criar outro agendamento na Vercel.
 *
 * GET /api/cron/corretores-links-jornada
 * Header: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET não configurado' }, { status: 500 })
  }
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const resultado = await dispararLembreteLinksCorretores()
  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: 500 })
  }
  return NextResponse.json(resultado)
}
