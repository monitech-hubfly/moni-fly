/**
 * POST /api/livro-empreendimento/scrape-condominio
 *
 * Faz scraping do site do condomínio, extrai:
 *   - foto principal e secundária
 *   - frase principal (tagline/hero)
 *   - frase secundária (subtítulo/slogan)
 *   - subtítulo da região (descrição localização)
 *   - 3 vantagens de localização
 *
 * Salva no campo `livro_*` de `condominios` (DEV ou PROD conforme env).
 *
 * Requer: role admin ou team.
 *
 * Body: { condominio_id: string, site_url?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { isAdminRole, normalizeAccessRole } from '@/lib/authz'
import { ehLinkGoogle } from '@/lib/livro-empreendimento/scrape-google'
import { scrapeSiteContent, type ScrapedData } from '@/lib/livro-empreendimento/scrape-site'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

function colunaLivroAusente(error: { code?: string; message?: string }): boolean {
  return error.code === '42703'
    || error.code === 'PGRST204'
    || /does not exist|schema cache/i.test(error.message ?? '')
}

export const runtime = 'nodejs'
export const maxDuration = 60

// ── Handler ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const userClient = await createClient()
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const { data: profile } = await userClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    const role = normalizeAccessRole((profile as { role?: string } | null)?.role)
    if (!isAdminRole(role) && role !== 'team') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const body = await req.json()
    const { condominio_id, site_url: bodySiteUrl } = body as {
      condominio_id?: string
      site_url?: string
    }

    if (!condominio_id) {
      return NextResponse.json(
        { error: 'condominio_id é obrigatório' },
        { status: 400 },
      )
    }

    const condominioId = condominio_id.trim()

    // A lista da tela usa a sessão do usuário. A service role pode apontar para outro banco
    // e a coluna site_url pode ainda não existir; os dois casos viravam "não encontrado".
    const { data: cond, error: condErr } = await userClient
      .from('condominios')
      .select('id, nome')
      .eq('id', condominioId)
      .maybeSingle()

    if (condErr) {
      return NextResponse.json({ error: condErr.message }, { status: 500 })
    }
    if (!cond) {
      return NextResponse.json(
        { error: `Condomínio ${condominioId} não encontrado` },
        { status: 404 },
      )
    }

    const siteUrl = bodySiteUrl?.trim()
    if (!siteUrl) {
      return NextResponse.json(
        { error: 'Informe a URL do site do condomínio.' },
        { status: 422 },
      )
    }

    const scraped = await scrapeSiteContent(siteUrl)
    const googleSemFotos = ehLinkGoogle(siteUrl) && !scraped.fotoPrincipal && Boolean(scraped.aviso)
    const patch = googleSemFotos
      ? { site_url: siteUrl }
      : ehLinkGoogle(siteUrl)
      ? {
          site_url: siteUrl,
          livro_foto_principal: scraped.fotoPrincipal ?? null,
          livro_foto_secundaria: scraped.fotoSecundaria ?? null,
        }
      : {
          site_url: siteUrl,
          livro_foto_principal: scraped.fotoPrincipal ?? null,
          livro_foto_secundaria: scraped.fotoSecundaria ?? null,
          livro_frase_principal: scraped.frasePrincipal ?? null,
          livro_frase_secundaria: scraped.fraseSecundaria ?? null,
          livro_subtitulo: scraped.subtitulo ?? null,
          livro_vantagens_localizacao: scraped.vantagens,
        }

    let upErr: { code?: string; message: string } | null = null
    try {
      const admin = createAdminClient()
      const saved = await admin.from('condominios').update(patch).eq('id', condominioId)
      upErr = saved.error
    } catch (adminErr) {
      upErr = { message: adminErr instanceof Error ? adminErr.message : 'Falha na service role' }
    }

    let persisted = !upErr
    if (upErr && !colunaLivroAusente(upErr)) {
      const fallback = await userClient.from('condominios').update(patch).eq('id', condominioId)
      if (!fallback.error) {
        persisted = true
      } else if (!colunaLivroAusente(fallback.error)) {
        return NextResponse.json(
          { error: `Erro ao salvar: ${upErr.message}` },
          { status: 500 },
        )
      }
    }

    return NextResponse.json({
      ok: true,
      persisted,
      condominio: cond.nome,
      site_url: siteUrl,
      scraped: scraped satisfies ScrapedData,
    })
  } catch (err) {
    console.error('[scrape-condominio]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 },
    )
  }
}
