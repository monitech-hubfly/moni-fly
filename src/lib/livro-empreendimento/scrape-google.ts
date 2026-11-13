import type { Browser, Page } from 'puppeteer'

const FOTO_PAINEL = /^data:image\/(?:jpeg|jpg|webp);/i
const FOTO_REMOTA = /googleusercontent\.com|ggpht\.com/i
const FOTO_LIXO = /\/maps\/vt|gstatic\.com|logo|favicon|avatar|profile/i

export interface CandidataFotoPainel {
  src: string
  largura: number
  altura: number
  href?: string
}

export function ehLinkGoogle(siteUrl: string): boolean {
  try {
    const url = new URL(siteUrl)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    if (host === 'maps.app.goo.gl') return true
    if (host === 'goo.gl') return url.pathname.startsWith('/maps')
    const google = host === 'google.com'
      || host.endsWith('.google.com')
      || host === 'google.com.br'
      || host.endsWith('.google.com.br')
    if (!google) return false
    return url.pathname.startsWith('/search') || url.pathname.startsWith('/maps') || host.startsWith('maps.')
  } catch {
    return false
  }
}

export function ampliarFotoGoogle(url: string): string {
  if (url.startsWith('data:')) return url
  if (!FOTO_REMOTA.test(url)) return url
  const semTamanho = url.replace(/=(?:w\d+|s\d+).*$/i, '')
  return `${semTamanho}=w1400`
}

/** As duas fotos do painel à direita (a área do lugar), na ordem em que aparecem. */
export function escolherFotosDoPainel(candidatos: CandidataFotoPainel[]): string[] {
  const vistos = new Set<string>()
  const fotos: string[] = []
  for (const item of candidatos) {
    const src = item.src.trim()
    if (!src || FOTO_LIXO.test(src)) continue
    if (item.largura > 0 && item.largura < 80) continue
    if (item.altura > 0 && item.altura < 60) continue
    if (!FOTO_PAINEL.test(src) && !FOTO_REMOTA.test(src)) continue
    if (FOTO_REMOTA.test(src) && /\/a\/|=s(?:16|32|40|48|64)\b/i.test(src)) continue
    if (src.startsWith('data:') && src.length > 2_500_000) continue
    // O recorte do mapa no painel vem como miniatura (poucos KB). As fotos do lugar não.
    if (src.startsWith('data:') && src.length < 6_000) continue
    if (/\/maps(?:\/|\?|$)|maps\.google/i.test(item.href ?? '') && src.startsWith('data:') && src.length < 12_000) continue
    const chave = src.startsWith('data:') ? src : src.replace(/=(?:w\d+|s\d+).*$/i, '')
    if (vistos.has(chave)) continue
    vistos.add(chave)
    fotos.push(ampliarFotoGoogle(src))
    if (fotos.length === 2) break
  }
  return fotos
}

async function abrirChrome(): Promise<Browser> {
  const puppeteer = (await import('puppeteer')).default
  try {
    return await puppeteer.launch({
      headless: true,
      channel: 'chrome',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--lang=pt-BR',
      ],
    })
  } catch {
    if (process.env.VERCEL) {
      const chromium = (await import('@sparticuz/chromium')).default
      const core = (await import('puppeteer-core')).default
      chromium.setGraphicsMode = false
      const browser = await core.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true,
      })
      return browser as unknown as Browser
    }
    return puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--lang=pt-BR',
      ],
    })
  }
}

async function lerPainel(page: Page): Promise<{ bloqueado: boolean; imgs: CandidataFotoPainel[] }> {
  return page.evaluate(() => {
    const bloqueado = location.pathname.indexOf('/sorry') === 0
    const painel = document.querySelector('#rhs')
    const raiz = painel || document.body
    const imgs = Array.from(raiz.querySelectorAll('img')).slice(0, 40).map((img) => ({
      src: img.currentSrc || img.src || '',
      largura: img.naturalWidth || 0,
      altura: img.naturalHeight || 0,
      href: img.closest('a')?.getAttribute('href') || '',
    }))
    return { bloqueado, imgs }
  })
}

/**
 * O HTML estático da busca não traz o painel. As fotos circuladas
 * (as duas imagens do lugar, à direita) só existem depois que a página abre.
 */
export async function fotosDoPainelGoogle(siteUrl: string): Promise<string[]> {
  const browser = await abrirChrome()
  try {
    const page = await browser.newPage()
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    })
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    )
    await page.setViewport({ width: 1440, height: 1000 })
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForFunction(() => {
      const painel = document.querySelector('#rhs')
      if (painel && painel.querySelector('img')) return true
      return location.pathname.indexOf('/sorry') === 0
    }, { timeout: 12_000 }).catch(() => undefined)

    const lido = await lerPainel(page)
    if (lido.bloqueado) {
      throw new Error('O Google pediu uma verificação e não liberou as fotos do painel. Tente gerar de novo em alguns minutos.')
    }
    const fotos = escolherFotosDoPainel(lido.imgs)
    if (fotos.length === 0) {
      throw new Error('Não encontrei as fotos do condomínio no painel do Google.')
    }
    return fotos
  } finally {
    await browser.close()
  }
}
