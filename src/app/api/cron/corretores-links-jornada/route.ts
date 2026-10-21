import { NextResponse } from 'next/server'
import { getPublicAppUrl } from '@/lib/app-url'
import { enviarEmailComLinks, hojeSaoPaulo } from '@/lib/corretor-emails'
import { listarLinksJornadaPorCorretores } from '@/lib/corretor-links-jornada'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Toda quinta-feira, 8h em São Paulo (11h UTC).
 * Manda para corretores ativos e aprovados a lista de links da jornada.
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

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const { data, error } = await admin
    .from('rede_corretores')
    .select('id, nome, email, status, links_lembrete_em')
    .in('status', ['aprovado', 'ativo'])
    .not('email', 'is', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const hoje = hojeSaoPaulo()
  const corretores = ((data ?? []) as {
    id?: string
    nome?: string | null
    email?: string | null
    links_lembrete_em?: string | null
  }[]).filter((row) => {
    const email = String(row.email ?? '').trim()
    if (!email.includes('@')) return false
    const quando = row.links_lembrete_em ? new Date(row.links_lembrete_em) : null
    const lembrete = quando && !Number.isNaN(quando.getTime()) ? hojeSaoPaulo(quando) : null
    return lembrete !== hoje
  })

  const mapa = await listarLinksJornadaPorCorretores(
    admin,
    corretores.map((row) => String(row.id ?? '')),
    getPublicAppUrl(),
  )

  let enviados = 0
  let pulados = 0
  let falhas = 0

  for (const row of corretores) {
    const id = String(row.id ?? '').trim()
    const links = mapa.get(id) ?? []
    if (!id || links.length === 0) {
      pulados += 1
      continue
    }
    const enviado = await enviarEmailComLinks({
      nome: String(row.nome ?? ''),
      email: String(row.email ?? ''),
      assunto: 'Seus links de jornada — Casa Moní',
      titulo: 'Links da semana',
      intro:
        'Este é o lembrete de quinta-feira com os empreendimentos vinculados a você e os links para compartilhar com os seus clientes.',
      links,
    })
    if (!enviado.ok) {
      falhas += 1
      console.error('[cron corretores-links]', id, enviado.error)
      continue
    }
    if (enviado.skipped) {
      pulados += 1
      continue
    }
    enviados += 1
    await admin
      .from('rede_corretores')
      .update({ links_lembrete_em: new Date().toISOString() })
      .eq('id', id)
  }

  return NextResponse.json({ ok: true, enviados, pulados, falhas, total: corretores.length })
}
