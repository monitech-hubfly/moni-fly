import { getPublicAppUrl } from '@/lib/app-url'
import { enviarEmailComLinks, hojeSaoPaulo } from '@/lib/corretor-emails'
import { listarLinksJornadaPorCorretores } from '@/lib/corretor-links-jornada'
import { createAdminClient } from '@/lib/supabase/admin'

export function ehQuintaFeiraSaoPaulo(data = new Date()): boolean {
  const dia = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
  }).format(data)
  return dia === 'Thu'
}

export async function dispararLembreteLinksCorretores(): Promise<
  | { ok: true; enviados: number; pulados: number; falhas: number; total: number }
  | { ok: false; error: string }
> {
  let admin
  try {
    admin = createAdminClient()
  } catch {
    return { ok: false, error: 'Serviço indisponível.' }
  }

  const { data, error } = await admin
    .from('rede_corretores')
    .select('id, nome, email, status, links_lembrete_em')
    .in('status', ['aprovado', 'ativo'])
    .not('email', 'is', null)

  if (error) return { ok: false, error: error.message }

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
      console.error('[corretor-lembrete]', id, enviado.error)
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

  return { ok: true, enviados, pulados, falhas, total: corretores.length }
}
