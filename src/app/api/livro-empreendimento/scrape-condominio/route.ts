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
import { scrapeSiteContent } from '@/lib/livro-empreendimento/scrape-site'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

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

    const supabase = createAdminClient()

    // Buscar condomínio
    const { data: cond, error: condErr } = await supabase
      .from('condominios')
      .select('id, nome, site_url')
      .eq('id', condominio_id)
      .single()

    if (condErr || !cond) {
      return NextResponse.json(
        { error: `Condomínio ${condominio_id} não encontrado` },
        { status: 404 },
      )
    }

    const siteUrl = bodySiteUrl ?? cond.site_url
    if (!siteUrl) {
      return NextResponse.json(
        { error: 'site_url não definida. Envie no body ou salve em condominios.site_url.' },
        { status: 422 },
      )
    }

    // Scraping
    const scraped = await scrapeSiteContent(siteUrl)

    // Salvar no banco
    const { error: upErr } = await supabase
      .from('condominios')
      .update({
        site_url: siteUrl,
        livro_foto_principal: scraped.fotoPrincipal ?? null,
        livro_foto_secundaria: scraped.fotoSecundaria ?? null,
        livro_frase_principal: scraped.frasePrincipal ?? null,
        livro_frase_secundaria: scraped.fraseSecundaria ?? null,
        livro_subtitulo: scraped.subtitulo ?? null,
        livro_vantagens_localizacao: scraped.vantagens,
      })
      .eq('id', condominio_id)

    if (upErr) {
      return NextResponse.json(
        { error: `Erro ao salvar: ${upErr.message}` },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ok: true,
      condominio: cond.nome,
      site_url: siteUrl,
      scraped,
    })
  } catch (err) {
    console.error('[scrape-condominio]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 },
    )
  }
}
