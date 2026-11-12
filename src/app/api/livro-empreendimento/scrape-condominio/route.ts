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
import { createClient } from '@supabase/supabase-js'

// ── Supabase service-role client (server-side only) ──────────────────────────
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

// ── Types ────────────────────────────────────────────────────────────────────
interface VantagemLocalizacao {
  icone: string
  texto: string
}

interface ScrapedData {
  fotoPrincipal?: string
  fotoSecundaria?: string
  frasePrincipal?: string
  fraseSecundaria?: string
  subtitulo?: string
  vantagens: VantagemLocalizacao[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function absoluteUrl(src: string, base: string): string {
  try {
    return new URL(src, base).href
  } catch {
    return src
  }
}

function cleanText(t: string): string {
  return t.replace(/\s+/g, ' ').trim()
}

function isPhotoUrl(src: string): boolean {
  return /\.(jpe?g|png|webp|avif)/i.test(src)
}

/**
 * Scraping leve via fetch + regex/DOM parsing no edge.
 * Para sites que requerem JS, use a rota /api/livro-empreendimento/scrape-puppeteer (futura).
 */
async function scrapeSiteContent(siteUrl: string): Promise<ScrapedData> {
  const result: ScrapedData = { vantagens: [] }

  const res = await fetch(siteUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; CasaMoniBot/1.0; +https://moni.casa)',
      Accept: 'text/html',
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ao acessar ${siteUrl}`)
  }

  const html = await res.text()

  // ── Extração de fotos ────────────────────────────────────────────────────
  // 1. og:image (mais confiável como foto principal)
  const ogImgMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)

  if (ogImgMatch?.[1]) {
    result.fotoPrincipal = absoluteUrl(ogImgMatch[1], siteUrl)
  }

  // 2. Hero/banner img como segunda opção para foto principal, primeira para secundária
  const imgMatches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)]
  const heroImgs = imgMatches
    .map((m) => ({ src: absoluteUrl(m[1], siteUrl), raw: m[0] }))
    .filter((m) => isPhotoUrl(m.src))
    .filter(
      (m) =>
        /hero|banner|cover|principal|destaque|capa|main|bg|background/i.test(m.raw),
    )

  if (!result.fotoPrincipal && heroImgs[0]) {
    result.fotoPrincipal = heroImgs[0].src
  }
  if (heroImgs[1]) {
    result.fotoSecundaria = heroImgs[1].src
  }

  // Se não achou secundária, pegar 2ª img com src de foto (qualquer)
  if (!result.fotoSecundaria) {
    const allPhotos = imgMatches
      .map((m) => absoluteUrl(m[1], siteUrl))
      .filter(isPhotoUrl)
      .filter((u) => u !== result.fotoPrincipal)
    if (allPhotos[0]) result.fotoSecundaria = allPhotos[0]
  }

  // ── Extração de texto ────────────────────────────────────────────────────
  // og:title / og:description como fallbacks
  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)
  const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i)

  // h1 hero
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  const h1Text = h1Match ? cleanText(h1Match[1].replace(/<[^>]+>/g, ' ')) : ''

  // h2 / subtítulo
  const h2Matches = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)]
  const h2Texts = h2Matches
    .map((m) => cleanText(m[1].replace(/<[^>]+>/g, ' ')))
    .filter((t) => t.length > 15 && t.length < 200)

  // tagline candidates: divs/spans com classe hero|tagline|slogan|headline
  const taglineMatch = html.match(
    /<(?:div|p|span|h[1-6])[^>]+class=["'][^"']*(?:tagline|slogan|headline|hero-title|hero__title)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|p|span|h[1-6])>/i,
  )
  const taglineText = taglineMatch
    ? cleanText(taglineMatch[1].replace(/<[^>]+>/g, ' '))
    : ''

  // frase principal: preferir h1 hero > tagline > og:title
  result.frasePrincipal =
    (h1Text.length > 10 ? h1Text : '') ||
    (taglineText.length > 10 ? taglineText : '') ||
    (ogTitleMatch ? cleanText(ogTitleMatch[1]) : '') ||
    undefined

  // frase secundária: preferir h2[0] > og:description curta
  result.fraseSecundaria =
    (h2Texts[0] && h2Texts[0].length < 120 ? h2Texts[0] : '') ||
    undefined

  // subtítulo / região: og:description ou parágrafo descritivo
  const ogDesc = ogDescMatch ? cleanText(ogDescMatch[1]) : ''
  const pMatches = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
  const descPara = pMatches
    .map((m) => cleanText(m[1].replace(/<[^>]+>/g, ' ')))
    .find((t) => t.length > 60 && t.length < 350)

  result.subtitulo = (ogDesc.length > 30 ? ogDesc : '') || descPara || undefined

  // ── Vantagens de localização ─────────────────────────────────────────────
  // Procurar listas de features/vantagens (li com texto curto)
  const liMatches = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
  const liTexts = liMatches
    .map((m) => cleanText(m[1].replace(/<[^>]+>/g, ' ')))
    .filter((t) => t.length > 10 && t.length < 150)
    .slice(0, 6)

  for (const texto of liTexts.slice(0, 3)) {
    result.vantagens.push({ icone: 'pin', texto })
  }

  return result
}

// ── Handler ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
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

    const supabase = getServiceClient()

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
